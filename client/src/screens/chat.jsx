import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [activeUsers, setActiveUsers] = useState(new Set());
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const socketRef = useRef();

  useEffect(() => {
    if (!userId) {
      navigate('/login');
      return;
    }

    // Connect to Socket.IO
    socketRef.current = io('http://localhost:5000', {
      withCredentials: true,
      auth: {
        token: localStorage.getItem('token')
      }
    });

    // Listen for new messages
    socketRef.current.on(`chat-${userId}`, (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for user status updates
    socketRef.current.on('userConnected', (connectedUserId) => {
      setActiveUsers(prev => new Set([...prev, connectedUserId]));
    });

    socketRef.current.on('userDisconnected', (disconnectedUserId) => {
      setActiveUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(disconnectedUserId);
        return newSet;
      });
    });

    // Listen for connection errors
    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setError('Failed to connect to chat server');
    });

    // Fetch users that follow each other
    const fetchUsers = async () => {
      try {
        const response = await fetch(`http://localhost:5000/user/${userId}`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch users');
        }
        
        const userData = await response.json();
        
        // Get mutual followers by finding users who are both in following and followers arrays
        const mutualFollows = [];
        if (userData.following && userData.followers) {
          for (let followedUser of userData.following) {
            if (userData.followers.find(follower => follower === followedUser)) {
              try {
                const userResponse = await fetch(`http://localhost:5000/user/${followedUser}`, {
                  credentials: 'include',
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  }
                });
                if (userResponse.ok) {
                  const userDetails = await userResponse.json();
                  mutualFollows.push(userDetails);
                } else {
                  console.error(`Failed to fetch details for user ${followedUser}`);
                }
              } catch (error) {
                console.error(`Error fetching user details: ${error}`);
              }
            }
          }
        }
        
        setUsers(mutualFollows);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError(err.message || 'Failed to fetch users');
      }
    };

    fetchUsers();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, navigate]);
  
  const fetchMessages = async (recipientId) => {
    try {
      const response = await fetch(`http://localhost:5000/messages/${recipientId}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch messages');
      }
      const data = await response.json();
      setMessages(data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError(err.message || 'Failed to fetch messages');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
    } else {
      setError('Please select an image file');
    }
  };

  const onEmojiClick = (emojiObject) => {
    setNewMessage(prevMessage => prevMessage + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!selectedImage && !newMessage.trim() || !selectedUser) return;

    try {
      const formData = new FormData();
      if (newMessage.trim()) {
        formData.append('content', newMessage);
      }
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const response = await fetch(`http://localhost:5000/messages/${selectedUser._id}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
      
      const sentMessage = await response.json();
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      setSelectedImage(null);
      setError('');

      // Emit message through socket
      socketRef.current.emit('new-message', {
        recipientId: selectedUser._id,
        message: sentMessage
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 pl-[210px]">
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1 bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Mutual Followers</h2>
            {users.map(user => (
              <div
                key={user._id}
                onClick={() => {
                  setSelectedUser(user);
                  fetchMessages(user._id);
                }}
                className={`p-3 cursor-pointer rounded-lg transition-all duration-200 
                  ${selectedUser?._id === user._id ? 'bg-purple-600' : 'hover:bg-gray-700'}`}
              >
                <div className="flex items-center">
                  <div className="relative">
                    <img src={user.profilePicture} alt={user.username} className="w-10 h-10 rounded-full mr-3 border-2 border-purple-400" />
                    {activeUsers.has(user._id) && (
                      <div className="absolute bottom-0 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    )}
                  </div>
                  <span className="font-medium">{user.username}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="col-span-3 bg-gray-800 rounded-lg p-4 shadow-lg">
            {selectedUser ? (
              <>
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-700">
                  <h2 className="text-xl font-bold text-purple-400">Chat with {selectedUser.username}</h2>
                </div>

                <div className="h-[calc(100vh-300px)] overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                  {messages.map((message, index) => (
                    <div
                      key={message._id || index}
                      className={`p-3 mb-3 rounded-lg ${
                        message.sender === userId || message.sender._id === userId 
                          ? 'bg-purple-600 ml-auto' 
                          : 'bg-gray-700'
                      } max-w-[60%]`}
                    >
                      <p className="text-gray-100">{message.content}</p>
                      {message.imageUrl && (
                        <img src={message.imageUrl} alt="Message attachment" className="max-w-full mt-2 rounded-lg" />
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={sendMessage} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-purple-500 text-gray-100"
                      placeholder="Type a message..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      😊
                    </button>
                    <label className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer">
                      📎
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button type="submit" className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                      Send
                    </button>
                  </div>
                  {showEmojiPicker && (
                    <div className="absolute mt-2 z-50">
                      <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" />
                    </div>
                  )}
                  {selectedImage && (
                    <div className="mt-2 bg-gray-700 p-2 rounded-lg">
                      <img
                        src={URL.createObjectURL(selectedImage)}
                        alt="Selected"
                        className="h-20 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="text-red-400 ml-2 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </form>
              </>
            ) : (
              <div className="text-center text-gray-400 mt-10">Select a user to start chatting</div>
            )}
            {error && <div className="text-red-400 mt-2">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
