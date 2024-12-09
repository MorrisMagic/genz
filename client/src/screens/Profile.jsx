import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import { CiHeart } from "react-icons/ci";
import { FaComment, FaHeart, FaRegComment, FaRegHeart, FaRetweet } from "react-icons/fa";

function Profile() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [showComments, setShowComments] = useState({});
  const { userId } = useParams();
  const myId=localStorage.getItem('userId')

  useEffect(() => {
    const socket = io('http://localhost:5000', {
      withCredentials: true
    });

    socket.on('userUpdated', (updatedUser) => {
      if (updatedUser._id === user?._id) {
        setUser(updatedUser);
      }
    });

    socket.on('postUpdated', (updatedPost) => {
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    socket.on('postDeleted', (deletedPostId) => {
      setPosts(prevPosts => prevPosts.filter(post => post._id !== deletedPostId));
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Get the profile data for the requested userId
        const endpoint = userId ? 
          `http://localhost:5000/user/${userId}` : 
          'http://localhost:5000/user';
        
        const response = await axios.get(endpoint, {
          withCredentials: true
        });
        setUser(response.data);

        // Fetch user's posts
        const postsResponse = await axios.get(`http://localhost:5000/user/${userId || response.data._id}/posts`, {
          withCredentials: true
        });
        setPosts(postsResponse.data);
        
        // Update user with correct posts count
        setUser(prev => ({
          ...prev,
          postsCount: postsResponse.data.length
        }));

        // Initialize comments state
        const commentsObj = {};
        const showCommentsObj = {};
        postsResponse.data.forEach(post => {
          commentsObj[post._id] = '';
          showCommentsObj[post._id] = false;
        });
        setComments(commentsObj);
        setShowComments(showCommentsObj);

        // If no userId is provided, this is the logged-in user's profile
        if (!userId) {
          setIsOwnProfile(true);
        } else {
          // Get the current logged-in user to compare IDs
          const currentUserResponse = await axios.get('http://localhost:5000/user', {
            withCredentials: true
          });
          setIsOwnProfile(currentUserResponse.data._id === userId);
          // Check if current user is following this profile
          setIsFollowing(response.data.followers.includes(currentUserResponse.data._id));
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch profile');
      }
    };

    fetchProfile();
  }, [userId]);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await axios.post('http://localhost:5000/user/profile-picture', formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUser(prev => ({
        ...prev,
        profilePicture: response.data.profilePicture
      }));
      setSelectedFile(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile picture');
    }
  };

  const handleFollow = async () => {
    try {
      await axios.post(`http://localhost:5000/user/${user._id}/follow`, {}, {
        withCredentials: true
      });
      setIsFollowing(!isFollowing);
      setUser(prev => ({
        ...prev,
        followers: isFollowing 
          ? prev.followers.filter(id => id !== userId)
          : [...prev.followers, userId]
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to follow/unfollow user');
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await axios.delete(`http://localhost:5000/posts/${postId}`, {
        withCredentials: true
      });
      setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
      // Update posts count after deletion
      setUser(prev => ({
        ...prev,
        postsCount: prev.postsCount - 1
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    try {
      await axios.delete(`http://localhost:5000/posts/${postId}/comments/${commentId}`, {
        withCredentials: true
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete comment');
    }
  };

  const handleLike = async (postId) => {
    try {
      await axios.post(`http://localhost:5000/posts/${postId}/like`, {}, {
        withCredentials: true
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to like post');
    }
  };

  const handleRepost = async (postId) => {
    try {
      const response = await axios.post(`http://localhost:5000/posts/${postId}/repost`, {}, {
        withCredentials: true
      });
      setPosts(prevPosts => {
        return prevPosts.map(post => {
          if (post._id === postId) {
            const isReposted = post.reposts?.includes(myId);
            return {
              ...post,
              reposts: isReposted
                ? post.reposts.filter(id => id !== myId)
                : [...(post.reposts || []), myId]
            };
          }
          return post;
        });
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to repost');
    }
  };

  const handleComment = async (postId) => {
    try {
      if (!comments[postId].trim()) return;
      
      await axios.post(`http://localhost:5000/posts/${postId}/comments`, {
        content: comments[postId]
      }, {
        withCredentials: true
      });
      
      setComments(prev => ({
        ...prev,
        [postId]: ''
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add comment');
    }
  };

  const toggleComments = (postId) => {
    setShowComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  if (!user) {
    return <div className="text-center">Loading...</div>;
  }
  return (
    <div className="min-h-screen bg-myblack py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-mygray rounded-xl shadow-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start items-center gap-8 mb-6">
            <div className="relative group">
              <img 
                src={user.profilePicture || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                alt="Profile" 
                className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-2 border-gray-700 transition duration-300 group-hover:opacity-75"
              />
              {isOwnProfile && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{user.username}</h2>
                  <p className="text-textgray text-sm">{user.email}</p>
                </div>
                
                {isOwnProfile ? (
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-full hover:bg-gray-700 transition duration-200"
                  >
                    Edit profile
                  </button>
                ) : (
                  <button
                    onClick={handleFollow}
                    className={`px-6 py-2 text-sm font-medium rounded-full transition duration-200 ${
                      isFollowing 
                        ? 'bg-gray-800 text-white hover:bg-gray-700'
                        : 'bg-white text-black hover:bg-gray-200'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              <div className="flex gap-6 mt-6 text-sm">
                <div className="text-white">
                  <span className="font-semibold">{posts.length}</span>
                  <span className="text-textgray ml-1">posts</span>
                </div>
                <div className="text-white">
                  <span className="font-semibold">{user.followers?.length || 0}</span>
                  <span className="text-textgray ml-1">followers</span>
                </div>
                <div className="text-white">
                  <span className="font-semibold">{user.following?.length || 0}</span>
                  <span className="text-textgray ml-1">following</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-mygray rounded-lg p-4 md:p-6">
          <h3 className="text-xl font-bold text-white mb-6">Posts</h3>
          <div className="flex flex-col gap-6">
            {posts.map(post => (
              <div key={post._id} className="bg-mygray border border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center mb-4">
                    <img 
                      src={post.author.profilePicture || `https://ui-avatars.com/api/?name=${post.author.username}&background=random`}
                      alt={post.author.username}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                    <div>
                      <div className="font-medium text-white">{post.author.username}</div>
                      <div className="text-sm text-textgray">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <button 
                        onClick={() => handleDeletePost(post._id)}
                        className="ml-auto text-red-500 hover:text-red-400"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-white whitespace-pre-wrap mb-4">{post.content}</p>
                  {post.imageUrl && (
                    <img 
                      src={post.imageUrl} 
                      alt="Post" 
                      className="w-full h-auto rounded-lg mb-4"
                    />
                  )}
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => handleLike(post._id)}
                      className="group flex items-center text-gray-400 transition"
                    >
                      <div className='flex items-center gap-1 rounded-full p-1.5 group-hover:bg-red-500/10'>
                      {post.likes?.includes(myId) ? (
                        <FaHeart 
                          size={17} 
                          className={`${post.likes?.includes(myId) ? 'text-red-500' : 'text-white group-hover:text-red-500'}`}
                        />
                        ) : (
                          <FaRegHeart 
                            size={17} 
                            className='text-gray-400 group-hover:text-red-500'
                          />
                        )}
                        <span className={`${post.likes?.includes(myId) ? 'text-red-500' : 'text-gray-400 group-hover:text-red-500'}`}>
                          {post.likes?.length || 0}
                        </span>
                      </div>
                    </button>
                    <button 
                      onClick={() => toggleComments(post._id)}
                      className="group flex items-center text-gray-400 transition"
                    >
                      <div className='flex items-center gap-1 rounded-full p-1.5 group-hover:bg-blue-500/10'>
                        <FaRegComment size={17} className="group-hover:text-blue-500" />
                        <span className="text-textgray group-hover:text-blue-500">{post.comments?.length || 0}</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleRepost(post._id)}
                      className="group flex items-center text-gray-400 transition"
                    >
                      <div className='flex items-center gap-1 rounded-full p-1.5 group-hover:bg-green-500/10'>
                        <FaRetweet 
                          size={17} 
                          className={`${post.reposts?.includes(myId) ? 'text-green-500' : 'text-gray-400 group-hover:text-green-500'}`}
                        />
                        <span className={`${post.reposts?.includes(myId) ? 'text-green-500' : 'text-gray-400 group-hover:text-green-500'}`}>
                          {post.reposts?.length || 0}
                        </span>
                      </div>
                    </button>
                  </div>

                  {showComments[post._id] && (
                    <div className="mt-4 border-t border-gray-700 pt-4">
                      <div className="mb-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={comments[post._id]}
                            onChange={(e) => setComments(prev => ({
                              ...prev,
                              [post._id]: e.target.value
                            }))}
                            placeholder="Add a comment..."
                            className="flex-1 bg-gray-800 text-white p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleComment(post._id)}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none"
                          >
                            Post
                          </button>
                        </div>
                      </div>

                      {post.comments?.map(comment => (
                        <div key={comment._id} className="flex items-start space-x-3 mb-3">
                          <img
                            src={comment.author?.profilePicture || `https://ui-avatars.com/api/?name=${comment.author?.username}`}
                            alt={comment.author?.username}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1 bg-gray-800 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-white">{comment.author?.username}</span>
                              {comment.author?._id === user._id && (
                                <button
                                  onClick={() => handleDeleteComment(post._id, comment._id)}
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
                  )}
                </div>
              </div>
            ))}
          </div>
          {posts.length === 0 && (
            <p className="text-center text-textgray">No posts yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;