import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import io from "socket.io-client";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isLoggedIn = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    const fetchUser = async () => {
      if (userId) {
        try {
          const response = await fetch(`http://localhost:5000/user/${userId}`, {
            credentials: "include",
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setNotifications(userData.notifications || []);
            localStorage.setItem("profilePicture", userData.profilePicture);
          }
        } catch (err) {
          console.error("Failed to fetch user:", err);
        }
      }
    };

    fetchUser();

    const socket = io("http://localhost:5000", {
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("Connected to socket server");

      socket.on("notification", (notification) => {
        setNotifications((prev) => {
          const newNotifications = [...prev];
          let message = "";
          if (notification.type === "like") {
            message = `${notification.from.username} liked your post`;
          } else if (notification.type === "comment") {
            message = `${notification.from.username} commented on your post`;
          } else if (notification.type === "follow") {
            message = `${notification.from.username} started following you`;
          } else if (notification.type === "repost") {
            message = `${notification.from.username} reposted your post`;
          }
          newNotifications.unshift({
            ...notification,
            message,
          });
          return newNotifications;
        });
      });
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });

    return () => socket.disconnect();
  }, [userId]);

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:5000/logout", {
        method: "POST",
        credentials: "include",
      });
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("profilePicture");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleProfileClick = () => {
    if (userId) {
      navigate(`/profile/${userId}`);
    } else {
      navigate("/login");
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const clearNotification = async (notificationId) => {
    try {
      await fetch(`http://localhost:5000/notifications/${notificationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
    } catch (err) {
      console.error("Failed to clear notification:", err);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-myblack text-white shadow-lg border-r border-gray-700 transition-transform duration-300 ease-in-out z-40
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 md:w-[210px] w-[80%]`}
      >
        <div className="p-6">
          <Link to="/" className="text-2xl font-bold text-white block mb-8">
            GenZ
          </Link>

          {isLoggedIn ? (
            <nav className="space-y-6">
              <div className="flex items-center space-x-3 mb-8">
                <img
                  src={
                    user?.profilePicture ||
                    `https://ui-avatars.com/api/?name=${user?.username}`
                  }
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <button
                  onClick={handleProfileClick}
                  className={`font-medium ${
                    location.pathname === `/profile/${userId}`
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {user?.username || "Profile"}
                </button>
              </div>

              <Link
                to="/"
                className={`flex items-center space-x-3 ${
                  location.pathname === "/"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span>Home</span>
              </Link>

              <Link
                to="/search"
                className={`flex items-center space-x-3 ${
                  location.pathname === "/search"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span>Search</span>
              </Link>

              <Link
                to="/chat"
                className={`flex items-center space-x-3 ${
                  location.pathname === "/chat"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span>Chat</span>
              </Link>

              <Link
                to="/saved"
                className={`flex items-center space-x-3 ${
                  location.pathname === "/saved"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                <span>Saved</span>
              </Link>

              <div className="relative">
                <button
                  onClick={toggleNotifications}
                  className="flex items-center space-x-3 text-gray-400 hover:text-white w-full"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span>Notifications</span>
                  {notifications.length > 0 && (
                    <span className="absolute left-5 -top-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute left-full ml-2 mt-2 w-64 bg-mygray rounded-lg shadow-lg border border-gray-700">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification._id}
                          className="p-3 border-b border-gray-700 hover:bg-gray-800 flex justify-between items-center"
                        >
                          <span className="text-sm text-gray-300">
                            {notification.message}
                          </span>
                          <button
                            onClick={() => clearNotification(notification._id)}
                            className="text-gray-500 hover:text-gray-300"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-gray-500 text-sm">
                        No notifications
                      </div>
                    )}
                  </div>
                )}
              </div>
            </nav>
          ) : (
            <nav className="space-y-4">
              <Link
                to="/login"
                className={`block px-4 py-2 ${
                  location.pathname === "/login"
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="block px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-center"
              >
                Register
              </Link>
            </nav>
          )}
        </div>

        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="mt-auto mb-8 mx-6 px-4 py-2 text-gray-400 hover:text-white flex items-center space-x-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Logout</span>
          </button>
        )}
      </aside>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}
    </>
  );
};

export default Sidebar;
