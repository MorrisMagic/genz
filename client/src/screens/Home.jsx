import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import Posts from "../components/Posts";

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [image, setImage] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    // Socket.io event listeners
    newSocket.on("newPost", (post) => {
      setPosts((prevPosts) => [post, ...prevPosts]);
    });

    newSocket.on("postUpdated", (updatedPost) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    newSocket.on("postDeleted", (postId) => {
      setPosts((prevPosts) => prevPosts.filter((post) => post._id !== postId));
    });

    newSocket.on("newRepost", (repost) => {
      setPosts((prevPosts) => [repost, ...prevPosts]);
    });

    // Check authentication
    const checkAuth = async () => {
      try {
        const response = await axios.get("http://localhost:5000/user", {
          withCredentials: true,
        });
        setUser(response.data);
      } catch (err) {
        navigate("/login");
      }
    };

    // Fetch initial posts
    const fetchPosts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/posts", {
          withCredentials: true,
        });
        setPosts(response.data);
      } catch (err) {
        console.error("Error fetching posts:", err);
      }
    };

    checkAuth();
    fetchPosts();

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [navigate]);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !image) return;

    try {
      const formData = new FormData();
      formData.append("content", newPost);
      if (image) {
        formData.append("image", image);
      }

      await axios.post("http://localhost:5000/posts", formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setNewPost("");
      setImage(null);
    } catch (err) {
      console.error("Error creating post:", err);
    }
  };

  const handleLike = async (postId) => {
    try {
      await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        {
          withCredentials: true,
        }
      );
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  return (
    <div className="min-h-screen bg-myblack text-white">
      <div className="max-w-xl mx-auto py-4 px-4 sm:px-6 lg:max-w-2xl lg:px-8">
        <div className="bg-mygray rounded-xl p-4 mb-6">
          <form onSubmit={handleSubmitPost} className="space-y-4">
            <div className="flex items-start space-x-3">
              <img
                src={
                  user?.profilePicture ||
                  `https://ui-avatars.com/api/?name=${user?.username}`
                }
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
              />
              <textarea
                className="flex-1 bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder-gray-500 text-white"
                rows="3"
                placeholder="Start a thread..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between border-t border-gray-700 pt-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-400 hover:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </label>

              {image && (
                <span className="text-sm text-gray-400 truncate max-w-[200px]">
                  {image.name}
                </span>
              )}

              <button
                type="submit"
                className="px-4 py-1.5 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-200 transition-colors focus:outline-none"
                disabled={!newPost.trim() && !image}
              >
                Post
              </button>
            </div>
          </form>
        </div>

        <Posts posts={posts} onLike={handleLike} user={user} />
      </div>
    </div>
  );
};

export default Home;
