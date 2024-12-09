const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for temporary storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/tmp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  postsCount: { type: Number, default: 0 },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  notifications: [
    {
      type: {
        type: String,
        enum: ["like", "comment", "follow", "message", "call"],
      },
      from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
      callType: { type: String, enum: ["video", "voice"] },
      read: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

const User = mongoose.model("User", userSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: { type: String }, // Remove required: true
  imageUrl: { type: String }, // Add field for image URL
  emoji: { type: String }, // Add field for emoji
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

// Comment Schema
const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  createdAt: { type: Date, default: Date.now },
});

const Comment = mongoose.model("Comment", commentSchema);

// Post Schema
const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  imageUrl: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  reposts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  repostsCount: { type: Number, default: 0 },
  isRepost: { type: Boolean, default: false },
  originalPost: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
});

const Post = mongoose.model("Post", postSchema);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Initialize Socket.IO with session handling
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = verified.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Helper function to create notification
const createNotification = async (
  type,
  fromUserId,
  toUserId,
  postId = null
) => {
  try {
    // Don't create notification if user is notifying themselves
    if (fromUserId.toString() === toUserId.toString()) {
      return;
    }

    const user = await User.findById(toUserId);
    if (!user) return;

    // Check for duplicate notifications
    const duplicateNotification = user.notifications.find(
      (notification) =>
        notification.type === type &&
        notification.from.toString() === fromUserId.toString() &&
        (!postId || notification.post?.toString() === postId.toString()) &&
        !notification.read &&
        // Check if notification is less than 1 hour old
        new Date() - notification.createdAt < 3600000
    );

    if (duplicateNotification) {
      return;
    }

    const notification = {
      type,
      from: fromUserId,
      post: postId,
      read: false,
      createdAt: new Date(),
    };

    user.notifications.unshift(notification);
    await user.save();

    // Populate the notification with user details before emitting
    const populatedUser = await User.findById(toUserId)
      .populate({
        path: "notifications.from",
        select: "username profilePicture",
      })
      .populate("notifications.post");

    const newNotification = populatedUser.notifications[0];

    // Emit notification to specific user
    io.emit(`notification-${toUserId}`, {
      notification: newNotification,
      userId: toUserId,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};

// Helper function to check if users can chat
const canUsersChat = async (userId1, userId2) => {
  const user1 = await User.findById(userId1);
  const user2 = await User.findById(userId2);

  return user1.following.includes(userId2) && user2.following.includes(userId1);
};

// Send message with image and emoji support
app.post(
  "/messages/:recipientId",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { content, emoji } = req.body;
      const senderId = req.userId;
      const recipientId = req.params.recipientId;

      // Check if users can chat (follow each other)
      const canChat = await canUsersChat(senderId, recipientId);
      if (!canChat) {
        return res.status(403).json({
          error: "You can only chat with users who follow each other",
        });
      }

      // Require either content or image
      if (!content && !req.file) {
        return res
          .status(400)
          .json({ error: "Message must contain either text or an image" });
      }

      let imageUrl;
      if (req.file) {
        // Upload image to Cloudinary if present
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.secure_url;
      }

      const message = new Message({
        sender: senderId,
        recipient: recipientId,
        content: content || "", // Allow empty content if there's an image
        imageUrl,
        emoji,
      });

      await message.save();

      // Populate sender details
      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "username profilePicture")
        .populate("recipient", "username profilePicture");

      // Create notification for new message
      await createNotification("message", senderId, recipientId);

      // Emit message to recipient
      io.emit(`chat-${recipientId}`, populatedMessage);

      res.status(201).json(populatedMessage);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

// Get chat history
app.get("/messages/:userId", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.userId;
    const otherUserId = req.params.userId;

    // Check if users can chat
    const canChat = await canUsersChat(currentUserId, otherUserId);
    if (!canChat) {
      return res.status(403).json({
        error: "You can only view chats with users who follow each other",
      });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: otherUserId },
        { sender: otherUserId, recipient: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username profilePicture")
      .populate("recipient", "username profilePicture");

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Mark messages as read
app.put("/messages/:senderId/read", authenticateToken, async (req, res) => {
  try {
    const recipientId = req.userId;
    const senderId = req.params.senderId;

    await Message.updateMany(
      { sender: senderId, recipient: recipientId, read: false },
      { read: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

// Get chat list
app.get("/chats", authenticateToken, async (req, res) => {
  try {
    // Get all messages where user is either sender or recipient
    const messages = await Message.find({
      $or: [{ sender: req.userId }, { recipient: req.userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username profilePicture")
      .populate("recipient", "username profilePicture");

    // Get unique chat partners
    const chatPartners = new Map();

    messages.forEach((message) => {
      const partnerId =
        message.sender._id.toString() === req.userId
          ? message.recipient._id.toString()
          : message.sender._id.toString();

      if (!chatPartners.has(partnerId)) {
        chatPartners.set(partnerId, {
          user:
            message.sender._id.toString() === req.userId
              ? message.recipient
              : message.sender,
          lastMessage: message,
          unreadCount:
            message.recipient._id.toString() === req.userId && !message.read
              ? 1
              : 0,
        });
      } else if (
        message.recipient._id.toString() === req.userId &&
        !message.read
      ) {
        chatPartners.get(partnerId).unreadCount++;
      }
    });

    const chatList = Array.from(chatPartners.values());

    res.json(chatList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat list" });
  }
});
// Get notifications
app.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: "notifications.from",
        select: "username profilePicture",
      })
      .populate("notifications.post");

    res.json(user.notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
app.put(
  "/notifications/:notificationId/read",
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.userId);
      const notification = user.notifications.id(req.params.notificationId);

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      notification.read = true;
      await user.save();

      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  }
);

// Mark all notifications as read
app.put("/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.notifications.forEach((notification) => {
      notification.read = true;
    });
    await user.save();

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Update profile picture
app.post(
  "/user/profile-picture",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If user already has a profile picture, delete it from Cloudinary
      if (user.profilePicture) {
        const publicId = user.profilePicture.split("/").pop().split(".")[0];
        await cloudinary.uploader.destroy(publicId);
      }

      // Upload new image to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path);

      // Update user's profile picture URL
      user.profilePicture = result.secure_url;
      await user.save();

      res.json({
        message: "Profile picture updated successfully",
        profilePicture: result.secure_url,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update profile picture" });
    }
  }
);

// Follow/Unfollow user
app.post("/user/:userId/follow", authenticateToken, async (req, res) => {
  try {
    if (req.userId === req.params.userId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.userId);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isFollowing = currentUser.following.includes(req.params.userId);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== req.params.userId
      );
      userToFollow.followers = userToFollow.followers.filter(
        (id) => id.toString() !== req.userId
      );
    } else {
      // Follow
      currentUser.following.push(req.params.userId);
      userToFollow.followers.push(req.userId);
      // Create notification for follow
      await createNotification("follow", req.userId, req.params.userId);
    }

    await currentUser.save();
    await userToFollow.save();

    // Emit follow/unfollow event
    io.emit("followUpdate", {
      followerId: req.userId,
      followedId: req.params.userId,
      action: isFollowing ? "unfollow" : "follow",
    });

    res.json({
      message: isFollowing
        ? "Unfollowed successfully"
        : "Followed successfully",
      followers: userToFollow.followers.length,
      following: currentUser.following.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update follow status" });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        error: "Username or email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    // Save user to database
    await user.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by username
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create and sign JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    // Set token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        followers: user.followers.length,
        following: user.following.length,
        postsCount: user.postsCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user
app.get("/user", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get specific user by ID
app.get("/user/:userId", async (req, res) => {
  try {
    if (!req.params.userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Get user profile and their posts
app.get("/profile/:userId", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    res.json({
      user,
      posts,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Create a new post
app.post(
  "/posts",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { content } = req.body;
      let imageUrl;

      if (req.file) {
        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.secure_url;
      }

      const post = new Post({
        content,
        author: req.userId,
        likes: [],
        comments: [],
        imageUrl,
      });
      await post.save();

      // Update user's post count
      await User.findByIdAndUpdate(req.userId, { $inc: { postsCount: 1 } });

      // Fetch the populated post to include author details
      const populatedPost = await Post.findById(post._id)
        .populate("author", "username profilePicture")
        .populate({
          path: "comments",
          populate: { path: "author", select: "username profilePicture" },
        });

      // Emit the new post to all connected clients
      io.emit("newPost", populatedPost);

      res.status(201).json(populatedPost);
    } catch (error) {
      res.status(500).json({ error: "Failed to create post" });
    }
  }
);

// Get single post
app.get("/posts/:postId", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

// Like/Unlike a post
app.post("/posts/:postId/like", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const likeIndex = post.likes.indexOf(req.userId);
    if (likeIndex === -1) {
      post.likes.push(req.userId);
      // Create notification for like if the post author is not the same as the liker
      if (post.author.toString() !== req.userId) {
        await createNotification("like", req.userId, post.author, post._id);
      }
    } else {
      post.likes.splice(likeIndex, 1);
    }
    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    io.emit("postUpdated", updatedPost);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to update like" });
  }
});

// Add comment to post
app.post("/posts/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = new Comment({
      content,
      author: req.userId,
      post: post._id,
    });
    await comment.save();

    post.comments.push(comment._id);
    await post.save();

    // Create notification for comment if the post author is not the same as the commenter
    if (post.author.toString() !== req.userId) {
      await createNotification("comment", req.userId, post.author, post._id);
    }

    const updatedPost = await Post.findById(post._id)
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });

    io.emit("postUpdated", updatedPost);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// Delete a comment
app.delete(
  "/posts/:postId/comments/:commentId",
  authenticateToken,
  async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      // Find the comment and check if user is the author
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.author.toString() !== req.userId) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this comment" });
      }

      // Remove comment from post and delete the comment
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      post.comments = post.comments.filter((c) => c.toString() !== commentId);
      await post.save();
      await Comment.findByIdAndDelete(commentId);

      const updatedPost = await Post.findById(postId)
        .populate("author", "username profilePicture")
        .populate({
          path: "comments",
          populate: { path: "author", select: "username profilePicture" },
        });

      io.emit("postUpdated", updatedPost);
      res.json(updatedPost);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  }
);

// Delete a post
app.delete("/posts/:postId", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user is the author of the post
    if (post.author.toString() !== req.userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this post" });
    }

    // Delete image from Cloudinary if exists
    if (post.imageUrl) {
      const publicId = post.imageUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Delete all comments associated with the post
    await Comment.deleteMany({ post: post._id });

    // Delete the post and decrement user's post count
    await Post.findByIdAndDelete(req.params.postId);
    await User.findByIdAndUpdate(req.userId, { $inc: { postsCount: -1 } });

    // Emit post deletion event to all connected clients
    io.emit("postDeleted", req.params.postId);

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// Get user's posts
app.get("/user/:userId/posts", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user posts" });
  }
});

// Get all posts
app.get("/posts", authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      })
      .populate({
        path: "originalPost",
        populate: { path: "author", select: "username profilePicture" },
      });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});
// Save/unsave post
app.post("/posts/:postId/save", authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Update post's savedBy array
    const isSaved = post.savedBy && post.savedBy.includes(req.userId);

    if (isSaved) {
      // Remove user from savedBy array
      post.savedBy = post.savedBy.filter((id) => id.toString() !== req.userId);
    } else {
      // Add user to savedBy array
      if (!post.savedBy) {
        post.savedBy = [];
      }
      post.savedBy.push(req.userId);
    }

    await post.save();

    // Update user's savedPosts array
    const user = await User.findById(req.userId);
    if (isSaved) {
      user.savedPosts = user.savedPosts.filter(
        (id) => id.toString() !== req.params.postId
      );
    } else {
      user.savedPosts.push(req.params.postId);
    }
    await user.save();

    res.json({
      message: isSaved
        ? "Post unsaved successfully"
        : "Post saved successfully",
      saved: !isSaved,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update saved status" });
  }
});

// Get saved posts
app.get("/saved", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const savedPosts = await Post.find({
      _id: { $in: user.savedPosts },
    })
      .populate("author", "username profilePicture")
      .populate({
        path: "comments",
        populate: { path: "author", select: "username profilePicture" },
      })
      .populate("savedBy");

    res.json(savedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch saved posts" });
  }
});
// Search for users
// Search users
app.get("/search/users", authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.query.q;
    if (!searchQuery) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Search users by username, name, or bio with case insensitive matching
    const users = await User.find({
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { name: { $regex: searchQuery, $options: "i" } },
        { bio: { $regex: searchQuery, $options: "i" } },
      ],
    })
      .select("username name profilePicture bio followers following")
      .sort({ followers: -1 }) // Sort by follower count
      .limit(20);

    // Don't send back sensitive information
    const sanitizedUsers = await Promise.all(
      users.map(async (user) => {
        // Get follower and following counts
        const followersCount = user.followers?.length || 0;
        const followingCount = user.following?.length || 0;

        // Check if current user is following this user
        const isFollowing = user.followers?.includes(req.userId);

        return {
          _id: user._id,
          username: user.username,
          name: user.name,
          profilePicture: user.profilePicture,
          bio: user.bio,
          followersCount,
          followingCount,
          isFollowing,
        };
      })
    );

    res.json(sanitizedUsers);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// Get personalized user suggestions
app.get("/users/suggestions", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get users followed by people the current user follows
    const followedUsers = currentUser.following || [];
    const suggestedUsers = await User.find({
      $and: [
        // Not already followed
        { _id: { $nin: [...followedUsers, req.userId] } },
        // Followed by users that current user follows
        { followers: { $in: followedUsers } },
      ],
    })
      .select("username name profilePicture bio followers")
      .sort({ followers: -1 }) // Prioritize users with more followers
      .limit(10);

    // If not enough suggestions, add some random users
    if (suggestedUsers.length < 10) {
      const remainingCount = 10 - suggestedUsers.length;
      const randomUsers = await User.find({
        _id: {
          $nin: [
            ...followedUsers,
            req.userId,
            ...suggestedUsers.map((u) => u._id),
          ],
        },
      })
        .select("username name profilePicture bio followers")
        .sort({ followers: -1 })
        .limit(remainingCount);

      suggestedUsers.push(...randomUsers);
    }

    res.json(suggestedUsers);
  } catch (error) {
    console.error("User suggestions error:", error);
    res.status(500).json({ error: "Failed to get user suggestions" });
  }
});

// Create a repost
app.post("/posts/:postId/repost", authenticateToken, async (req, res) => {
  const { postId } = req.params;
  console.log("postId", postId);
  try {
    const originalPost = await Post.findById(req.params.postId)
      .populate("author", "username profilePicture")
      .populate("originalPost", "author username profilePicture");

    const postCreater = await User.findById(originalPost.author._id).select(
      "username profilePicture"
    );
    console.log("post creator", postCreater);

    if (!originalPost) {
      return res.status(404).json({ error: "Original post not found" });
    }

    // Check if user already reposted
    const existingRepost = await Post.findOne({
      originalPost: req.params.postId,
      author: req.userId,
      isRepost: true,
    });

    if (existingRepost) {
      return res
        .status(400)
        .json({ error: "You have already reposted this post" });
    }

    // Create repost
    const repost = new Post({
      content: originalPost.content,
      imageUrl: originalPost.imageUrl,
      author: req.userId,
      originalPost: req.params.postId, // Just store the ID reference
      isRepost: true,
      createdAt: new Date(),
    });

    await repost.save();

    // Populate the repost with author and original post details
    await repost.populate([
      {
        path: "author",
        select: "username profilePicture",
      },
      {
        path: "originalPost",
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      },
    ]);

    // Update original post's repost count and reposts array
    if (!originalPost.reposts) {
      originalPost.reposts = [];
    }
    originalPost.reposts.push(req.userId);
    originalPost.repostsCount = originalPost.reposts.length;
    await originalPost.save();

    // Create notification for the original post author
    const newNotification = new Notification({
      type: "repost",
      from: req.userId,
      to: originalPost.author._id,
      post: originalPost._id,
      createdAt: new Date(),
    });
    await newNotification.save();
    await newNotification.populate("from", "username profilePicture");

    // Emit socket events
    io.emit("postUpdated", originalPost);
    io.to(`user-${originalPost.author._id}`).emit(
      "notification",
      newNotification
    );

    res.status(201).json({
      success: true,
      repost,
      postCreater,
    });
  } catch (error) {
    console.error("Create repost error:", error);
    res.status(500).json({ error: "Failed to create repost" });
  }
});

// Delete a repost
app.delete("/posts/:postId/repost", authenticateToken, async (req, res) => {
  try {
    // Find original post first to ensure it exists
    const originalPost = await Post.findById(req.params.postId).populate(
      "author",
      "username profilePicture"
    );

    if (!originalPost) {
      return res.status(404).json({ error: "Original post not found" });
    }

    // Find and delete repost
    const repost = await Post.findOneAndDelete({
      originalPost: req.params.postId,
      author: req.userId,
      isRepost: true,
    });

    if (!repost) {
      return res.status(404).json({ error: "Repost not found" });
    }

    // Correctly decrement the repostsCount
    originalPost.repostsCount = Math.max(0, originalPost.repostsCount - 1);

    await originalPost.updateOne({
      $pull: { reposts: req.userId },
      $inc: { repostsCount: -1 },
    });

    // If the reposted post is deleted, update the original post's isRepost field
    if (originalPost.repostsCount === 0) {
      originalPost.isRepost = false;
    }

    await originalPost.save();

    // Delete associated notification
    await Notification.deleteOne({
      type: "repost",
      from: req.userId,
      post: originalPost._id,
    });

    // Emit socket events
    io.emit("postUpdated", originalPost);
    io.emit("postDeleted", repost._id);

    res.json({ message: "Repost deleted successfully" });
  } catch (error) {
    console.error("Delete repost error:", error);
    res.status(500).json({ error: "Failed to delete repost" });
  }
});

// Socket.IO connection handling with error handling and reconnection logic
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", reason);
    if (reason === "io server disconnect") {
      // Reconnect if server initiated disconnect
      socket.connect();
    }
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("Socket reconnected after", attemptNumber, "attempts");
  });

  // Handle joining a chat room
  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
  });

  // Handle leaving a chat room
  socket.on("leaveChat", (chatId) => {
    socket.leave(chatId);
  });
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
