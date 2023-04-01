const express = require("express");
// connect db
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const User = require("./Models/User");
const ws = require("ws");
const Message = require("./Models/Message");
const fs = require("fs");
dotenv.config();

const Url = `mongodb+srv://${process.env.MONGO_USERNAME}:${encodeURIComponent(
  process.env.MONGO_PWD
)}
@cluster0.zopmrrm.mongodb.net/?retryWrites=true&w=majority`;

mongoose
  .connect(Url)
  .then(() => {
    console.log("connected");
  })
  .catch((err) => {
    console.log(err);
  });
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);
// console.log(process.env.MONGO_URL);
const app = express();

app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true, origin: process.env.CLIENT_URL }));

app.get("/test", (req, res) => {
  res.json("test ok");
});
async function getUserDataFromRequest(req) {
  return new Promise((resolve, reject) => {
    const { token } = req.body;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        resolve(userData);
      });
    } else {
      reject("no token");
    }
  });
}
app.post("/messages/:userId", async (req, res) => {
  const { userId } = req.params;
  // console.log(userId);
  const userData = await getUserDataFromRequest(req);
  // console.log(userData);
  const ourUserId = userData.userId;
  const messages = await Message.find({
    sender: { $in: [userId, ourUserId] },
    recipient: { $in: [userId, ourUserId] },
  }).sort({ createdAt: 1 });
  console.log("messages");
  res.json(messages);
});

app.get("/people", async (req, res) => {
  const users = await User.find({}, { _id: 1, username: 1 });
  res.json(users);
});

app.post("/profile", (req, res) => {
  const { token } = req.body;
  if (token) {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err;
      res.json(userData);
    });
  } else {
    res.status(422).json("no token");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });
  if (foundUser) {
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      const token = jwt.sign(
        { userId: foundUser._id, username },
        jwtSecret,
        {}
      );
      res.status(201).json({ token, id: foundUser._id });
    }
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "", { sameSite: "none", secure: true }).json("ok");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body; //grab data from req
  try {
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
    const createdUser = await User.create({
      username: username,
      password: hashedPassword,
    }); //create user
    const token = jwt.sign(
      { userId: createdUser._id, username },
      jwtSecret,
      {}
    );
    res.status(201).json({ token, id: createdUser._id });
  } catch (err) {
    if (err) throw err;
    res.status(500).json("error");
  }
});
const server = app.listen(5000);

const wss = new ws.WebSocketServer({ server });
wss.on("connection", (connection, req) => {
  function notifyAboutOnlinePeople() {
    [...wss.clients].forEach((client) => {
      client.send(
        JSON.stringify({
          online: [...wss.clients].map((c) => {
            return {
              userId: c.userId,
              username: c.username,
            };
          }),
        })
      );
    });
  }
  connection.isAlive = true;

  connection.timer = setInterval(() => {
    connection.ping();
    connection.deathTimer = setTimeout(() => {
      connection.isAlive = false;
      clearInterval(connection.timer);
      connection.terminate();
      notifyAboutOnlinePeople();
    }, 1000);
  }, 5000);

  connection.on("pong", () => {
    clearTimeout(connection.deathTimer);
  });

  const cookies = req.headers["sec-websocket-protocol"];
  if (cookies) {
    const token = cookies;
    if (token) {
      jwt.verify(token, jwtSecret, {}, (err, userData) => {
        if (err) throw err;
        const { userId, username } = userData;
        connection.userId = userId;
        connection.username = username;
      });
    }
  }
  connection.on("message", async (message) => {
    const messageData = JSON.parse(message.toString());
    const {
      message: { recipient, text, file },
    } = messageData;
    let filename = null;
    if (file) {
      const parts = file.name.split(".");
      const ext = parts[parts.length - 1];
      filename = Date.now() + "." + ext;
      const path = __dirname + "/uploads/" + filename;
      const bufferData = new Buffer(file.data.split(",")[1], "base64");
      fs.writeFile(path, bufferData, () => {
        // console.log(path);
        console.log("file saved");
      });
    }
    if (recipient && (text || file)) {
      const messageDoc = await Message.create({
        sender: connection.userId,
        recipient,
        text,
        file: file ? filename : null,
      });
      console.log("i am messageDoc");
      // console.log(wss.clients);
      [...wss.clients]
        .filter((c) => c.userId === recipient)
        .forEach((c) => {
          // console.log(c);
          c.send(
            JSON.stringify({
              text,
              sender: connection.userId,
              recipient,
              file: file ? filename : null,
              _id: messageDoc._id,
            })
          );
        });
    }
  });

  [...wss.clients].forEach((client) => {
    client.send(
      JSON.stringify({
        online: [...wss.clients].map((c) => ({
          userId: c.userId,
          username: c.username,
        })),
      })
    );
  });
  // const cookies = req.headers["sec-websocket-protocol"];
  // // console.log(req.headers);
  // if (cookies) {
  //   const token = cookies;
  //   if (token) {
  //     jwt.verify(token, jwtSecret, {}, (err, userData) => {
  //       if (err) throw err;
  //       const { userId, username } = userData;
  //       connection.userId = userId;
  //       connection.username = username;
  //     });
  //   }
  // }
  // notifyAboutOnlinePeople();
});
// wss.on("close", (data) => {});
// const wss = new ws.WebSocketServer({ server });
// wss.on("connection", (connection, req) => {
//   const cookies = req.headers.cookie;
//   if (cookies) {
//     const tokenCookieString = cookies
//       .split(";")
//       .find((str) => str.startsWith("token"));
//     if (tokenCookieString) {
//       const token = tokenCookieString.split("=")[1];
//       if (token) {
//         jwt.verify(token, jwtSecret, {}, (err, userData) => {
//           if (err) throw err;
//           const { userId, username } = userData;
//           connection.userId = userId;
//           connection.username = username;
//         });
//       }
//     }
//   }
//   [...wss.clients].forEach((client) => {
//     client.send(
//       JSON.stringify({
//         online: [...wss.clients].map((c) => ({
//           userId: c.userId,
//           username: c.username,
//         })),
//       })
//     );
//   });
// });
// hello@12345
