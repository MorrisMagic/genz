import { Routes, Route } from 'react-router-dom';
import Register from './screens/Register';
import Login from './screens/Login';
import axios from 'axios';
import Home from './screens/Home';
import SinglePost from './screens/SinglePost';
import Profile from './screens/Profile';
import Chat from './screens/chat';
import Saved from './screens/Saved';
import Search from './screens/Search';
import Sidebar from './components/Sidebar';
axios.defaults.withCredentials = true;  
function App() {
  return (
    <div className="App">
      <Sidebar />
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/posts/:postId" element={<SinglePost />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </div>
  );
}

export default App;
