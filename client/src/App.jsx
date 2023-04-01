// import Register from "./Register";
import axios from "axios";
import { UserContextProvider } from "../UserContext";
import Routes from "./Routes";
function App() {
  // const [count, setCount] = useState(0);
  axios.defaults.baseURL = "http://localhost:5000";
  axios.defaults.withCredentials = true;
  return (
    <>
      <UserContextProvider>
        <Routes />
      </UserContextProvider>
    </>
  );
}

export default App;
