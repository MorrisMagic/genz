import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import io from "socket.io-client";

const Post = ({ post, onLike, user, onDelete, onSave }) => {
  const [comment, setComment] = useState("");
  const [repostCount, setRepostCount] = useState(post.repostsCount || 0);
  const [hasReposted, setHasReposted] = useState(
    post.reposts ? post.reposts.includes(user?._id) : false
  );
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(
    post.savedBy ? post.savedBy.includes(user?._id) : false
  );
  const [isLiked, setIsLiked] = useState(
    post.likes ? post.likes.includes(user?._id) : false
  );
  const navigate = useNavigate();

  useEffect(() => {
    const socket = io("http://localhost:5000", {
      withCredentials: true,
    });

    socket.on("postUpdated", (updatedPost) => {
      if (updatedPost._id === post._id) {
        setRepostCount(updatedPost.repostsCount || 0);
        setHasReposted(
          updatedPost.reposts ? updatedPost.reposts.includes(user?._id) : false
        );
        setIsSaved(
          updatedPost.savedBy ? updatedPost.savedBy.includes(user?._id) : false
        );
        setIsLiked(
          updatedPost.likes ? updatedPost.likes.includes(user?._id) : false
        );
      }
    });

    socket.on("newRepost", (newRepost) => {
      if (newRepost.originalPost === post._id) {
        setRepostCount((prev) => prev + 1);
        setHasReposted(true);
      }
    });

    return () => socket.disconnect();
  }, [post._id, user?._id]);

  useEffect(() => {
    setRepostCount(post.repostsCount || 0);
    setHasReposted(post.reposts ? post.reposts.includes(user?._id) : false);
    setIsSaved(post.savedBy ? post.savedBy.includes(user?._id) : false);
    setIsLiked(post.likes ? post.likes.includes(user?._id) : false);
  }, [post, user?._id]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await axios.post(
        `http://localhost:5000/posts/${post._id}/comments`,
        {
          content: comment,
        },
        {
          withCredentials: true,
        }
      );
      setComment("");
      toast.success("Comment added successfully!");
    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(
        `http://localhost:5000/posts/${post._id}/comments/${commentId}`,
        {
          withCredentials: true,
        }
      );
      toast.success("Comment deleted successfully!");
    } catch (err) {
      console.error("Error deleting comment:", err);
      toast.error("Failed to delete comment");
    }
  };

  const handleDeletePost = async () => {
    try {
      const response = await axios.delete(
        `http://localhost:5000/posts/${post._id}`,
        {
          withCredentials: true,
        }
      );
      if (response.status === 200) {
        onDelete(post._id);
        toast.success("Post deleted successfully!");
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      toast.error("Failed to delete post");
    }
  };

  const handleSavePost = async (e) => {
    e.stopPropagation();
    try {
      const response = await axios.post(
        `http://localhost:5000/posts/${post._id}/save`,
        {},
        {
          withCredentials: true,
        }
      );

      if (onSave) {
        onSave(post._id);
      }

      setIsSaved(response.data.saved);
      toast.success(response.data.saved ? "Post saved" : "Post unsaved");
    } catch (err) {
      toast.error("Failed to save post");
    }
  };

  const handleRepost = async (e) => {
    e.stopPropagation();
    try {
      const response = await axios.post(
        `http://localhost:5000/posts/${post._id}/repost`,
        {},
        {
          withCredentials: true,
        }
      );

      if (response.data.success) {
        setRepostCount((prev) => prev + 1);
        setHasReposted(true);
        toast.success("Reposted");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to repost");
    }
  };

  const handleUndoRepost = async (e) => {
    e.stopPropagation();
    try {
      const response = await axios.delete(
        `http://localhost:5000/posts/${post._id}/repost`,
        {
          withCredentials: true,
        }
      );

      if (response.data.success) {
        setRepostCount((prev) => prev - 1);
        setHasReposted(false);
        toast.success("Repost removed");
      }
    } catch (err) {
      toast.error("Failed to remove repost");
    }
  };

  const handlePostClick = () => {
    navigate(`/posts/${post._id}`);
  };

  const handleUsernameClick = (e, authorId) => {
    e.stopPropagation();
    if (authorId) {
      navigate(`/profile/${authorId}`);
    }
  };

  const handleLikePost = useCallback(
    async (e) => {
      e.stopPropagation();
      setIsLiked((prev) => !prev);
      onLike(post._id);
    },
    [onLike, post._id]
  );

  return (
    <div
      className="bg-mygray rounded-lg p-4 md:p-6 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer"
      onClick={handlePostClick}
    >
      {post.isRepost && (
        <div className="flex items-center text-gray-400 text-sm mb-2">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{post.author?.username} Reposted</span>
        </div>
      )}
      {console.log("original post", post)}
      {post.originalPost && (
        <div className="border border-gray-800 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-2">
            <img
              className="h-8 w-8 rounded-full object-cover"
              src={
                post.originalPost.author?.profilePicture ||
                `https://ui-avatars.com/api/?name=${post.originalPost.author?.username}`
              }
              alt={post.originalPost.author?.username}
            />
            <p
              className="ml-2 font-medium text-gray-200 hover:text-blue-400 cursor-pointer"
              onClick={(e) =>
                handleUsernameClick(e, post.originalPost.author?._id)
              }
            >
              {post.originalPost.author?.username}
            </p>
          </div>
          <p className="text-gray-300">{post.originalPost.content}</p>
          {post.originalPost.imageUrl && (
            <img
              src={post.originalPost.imageUrl}
              alt="Original post content"
              className="mt-2 rounded-lg max-h-72 w-full object-cover"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <img
            className="h-10 w-10 rounded-full object-cover"
            src={
              post.author?.profilePicture ||
              `https://ui-avatars.com/api/?name=${post.author?.username}`
            }
            alt={post.author?.username}
          />
          <div className="ml-3">
            <p
              className="font-medium text-gray-200 hover:text-blue-400 cursor-pointer"
              onClick={(e) => handleUsernameClick(e, post.author?._id)}
            >
              {post.author?.username}
            </p>
            <p className="text-sm text-gray-500">
              {new Date(post.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {user?._id === post.author?._id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePost();
            }}
            className="text-red-500 hover:text-red-400"
          >
            Delete
          </button>
        )}
      </div>

      <p className="text-gray-200 mb-4">{post.content}</p>

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt="Post content"
          className="rounded-lg max-h-96 w-full object-cover mb-4"
        />
      )}

      <div className="flex items-center space-x-6 text-sm text-gray-400">
        <button
          onClick={handleLikePost}
          className={`flex items-center space-x-2 hover:text-red-500 ${
            isLiked ? "text-red-500" : ""
          }`}
        >
          <svg
            className="w-5 h-5"
            fill={isLiked ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span>{post.likes?.length || 0}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowComments(!showComments);
          }}
          className="flex items-center space-x-2 hover:text-blue-400"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>{post.comments?.length || 0}</span>
        </button>

        <button
          onClick={(e) => (hasReposted ? handleUndoRepost(e) : handleRepost(e))}
          className={`flex items-center space-x-2 hover:text-green-500 ${
            hasReposted ? "text-green-500" : ""
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>{repostCount}</span>
        </button>

        <button
          onClick={handleSavePost}
          className={`flex items-center space-x-2 hover:text-blue-400 ${
            isSaved ? "text-blue-400" : ""
          }`}
        >
          <svg
            className="w-5 h-5"
            fill={isSaved ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </button>
      </div>

      {showComments && (
        <div
          className="mt-4 border-t border-gray-800 pt-4"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmitComment} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-800 text-gray-200 p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none"
              >
                Reply
              </button>
            </div>
          </form>

          <div className="space-y-4">
            {post.comments?.map((comment) => (
              <div key={comment._id} className="flex items-start space-x-3">
                <img
                  className="h-8 w-8 rounded-full object-cover"
                  src={
                    comment.author?.profilePicture ||
                    `https://ui-avatars.com/api/?name=${comment.author?.username}`
                  }
                  alt={comment.author?.username}
                />
                <div className="flex-1 bg-gray-800 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <p
                      className="font-medium text-gray-200 hover:text-blue-400 cursor-pointer"
                      onClick={(e) =>
                        handleUsernameClick(e, comment.author?._id)
                      }
                    >
                      {comment.author?.username}
                    </p>
                    {user?._id === comment.author?._id && (
                      <button
                        onClick={() => handleDeleteComment(comment._id)}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-gray-300 mt-1">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Posts = ({ posts, onLike, user, onDelete, onSave }) => {
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Post
          key={post._id}
          post={post}
          onLike={onLike}
          user={user}
          onDelete={onDelete}
          onSave={onSave}
        />
      ))}
    </div>
  );
};

export default Posts;
