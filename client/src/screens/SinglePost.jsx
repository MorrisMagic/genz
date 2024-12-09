import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { FaHeart, FaComment } from "react-icons/fa";

const SinglePost = () => {
  const [post, setPost] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const { postId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await axios.get(
          `http://localhost:5000/posts/${postId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setPost(response.data);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch post");
      }
    };

    fetchPost();
  }, [postId, navigate]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/comments`,
        { content: comment },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPost(response.data);
      setComment("");
      toast.success("Comment added successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add comment");
      toast.error("Failed to add comment");
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `http://localhost:5000/posts/${postId}/like`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPost(response.data);
      toast.success("Post liked successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update like");
      toast.error("Failed to update like");
    }
  };

  const handleDeletePost = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      navigate("/");
      toast.success("Post deleted successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete post");
      toast.error("Failed to delete post");
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `http://localhost:5000/posts/${postId}/comments/${commentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPost(response.data);
      toast.success("Comment deleted successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete comment");
      toast.error("Failed to delete comment");
    }
  };

  if (!post)
    return <div className="text-center mt-8 text-white">Loading...</div>;

  return (
    <div className="w-full flex justify-center p-4 bg-myblack text-white min-h-screen">
      {error && <div className="mb-4 text-red-500 text-center">{error}</div>}

      <div className="bg-myblack border border-gray-700 rounded-lg w-[600px] shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <img
              src={post.author.profilePicture}
              alt="Profile"
              className="w-10 h-10 rounded-full"
            />
            <h2 className="text-xl font-bold">{post.author.username}</h2>
          </div>
        </div>

        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt="Post"
            className="w-full h-auto rounded-lg mb-4"
          />
        )}

        <p className="text-gray-300 mb-4">{post.content}</p>

        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-gray-400 hover:text-red-400 ${
              post.likes.includes(localStorage.getItem("userId"))
                ? "text-red-400"
                : ""
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

        <form onSubmit={handleComment} className="mb-6">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full p-2 border border-gray-700 bg-gray-800 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
          />
          <button
            type="submit"
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Comment
          </button>
        </form>

        <div className="flex flex-col gap-4">
          {post.comments.map((comment) => (
            <div key={comment._id} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img
                    src={comment.author.profilePicture}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="font-semibold">{comment.author.username}</div>
                </div>
                {comment.author._id === localStorage.getItem("userId") && (
                  <button
                    onClick={() => handleDeleteComment(comment._id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-gray-300 mt-1">{comment.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SinglePost;
