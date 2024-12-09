import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FaHeart, FaComment } from "react-icons/fa";

const Saved = () => {
  const [savedPosts, setSavedPosts] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchSavedPosts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/saved", {
          withCredentials: true,
        });
        setSavedPosts(response.data);
      } catch (err) {
        console.error("Error fetching saved posts:", err);
        toast.error("Failed to fetch saved posts");
      }
    };

    const fetchUser = async () => {
      try {
        const userId = localStorage.getItem("userId");
        if (userId) {
          const response = await axios.get(
            `http://localhost:5000/user/${userId}`,
            {
              withCredentials: true,
            }
          );
          setUser(response.data);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };

    fetchUser();
    fetchSavedPosts();
  }, []);

  const handleLike = async (postId) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        {
          withCredentials: true,
        }
      );

      setSavedPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post._id === postId) {
            const isLiked = post.likes.includes(user._id);
            return {
              ...post,
              likes: isLiked
                ? post.likes.filter((id) => id !== user._id)
                : [...post.likes, user._id],
            };
          }
          return post;
        })
      );
    } catch (err) {
      console.error("Error liking post:", err);
      toast.error("Failed to like post");
    }
  };

  const handleSave = async (postId) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/save`,
        {},
        {
          withCredentials: true,
        }
      );

      setSavedPosts((prevPosts) => {
        return prevPosts.map((post) => {
          if (post._id === postId) {
            const isSaved = post.savedBy?.includes(user._id);
            return {
              ...post,
              savedBy: isSaved
                ? post.savedBy.filter((id) => id !== user._id)
                : [...(post.savedBy || []), user._id],
            };
          }
          return post;
        });
      });
    } catch (err) {
      console.error("Error saving/unsaving post:", err);
      toast.error("Failed to update saved status");
    }
  };

  return (
    <div className="max-w-full mx-auto py-8 px-4 bg-myblack text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-center">Saved Posts</h1>
      {savedPosts.length === 0 ? (
        <p className="text-gray-400 text-center">No saved posts yet</p>
      ) : (
        <div className="flex flex-col gap-4">
          {savedPosts.map((post) => (
            <div
              key={post._id}
              className="bg-mygray p-5 w-[600px] mx-auto rounded-lg mb-4"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <img
                    src={post.author.profilePicture}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="font-semibold">{post.author.username}</div>
                </div>
                <button
                  onClick={() => handleSave(post._id)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  {post.savedBy?.includes(user._id) ? "Unsave" : "Save"}
                </button>
              </div>
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  alt="Post"
                  className="w-full h-auto rounded-lg mb-2"
                />
              )}
              <p className="text-gray-300 mb-2">{post.content}</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleLike(post._id)}
                  className={`flex items-center gap-1 text-gray-400 hover:text-red-400 ${
                    post.likes.includes(user._id) ? "text-red-400" : ""
                  }`}
                >
                  <FaHeart />
                  <span>{post.likes.length} Likes</span>
                </button>
                <span className="flex items-center gap-1 text-gray-400">
                  <FaComment />
                  {post.comments.length} Comments
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Saved;
