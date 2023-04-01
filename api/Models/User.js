const mongoose = require("mongoose");
// defining schema
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true },
    password: String,
  },
  { timestamps: true }
);

// creating model
// model_name,user_schema
const UserModel = mongoose.model("User", UserSchema);
module.exports = UserModel;
