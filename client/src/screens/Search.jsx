import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const search = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:5000/search/users?q=${encodeURIComponent(
            searchQuery
          )}`,
          {
            credentials: "include",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to search users");
        }

        const results = await response.json();
        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search users. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(search, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  return (
    <div className="w-full mx-auto p-6 bg-myblack text-white min-h-screen">
      <div className="mb-6 flex justify-center">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-2xl px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white focus:outline-none focus:border-white"
        />
      </div>

      {loading && <div className="text-center text-gray-500">Loading...</div>}

      {error && <div className="text-center text-red-500 mb-4">{error}</div>}

      <div className="space-y-4 max-w-2xl mx-auto">
        {searchResults.map((user) => (
          <Link
            key={user._id}
            to={`/profile/${user._id}`}
            className="flex items-center p-4 bg-mygray rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <img
              src={user.profilePicture || "/default-avatar.png"}
              alt={user.username}
              className="w-14 h-14 rounded-full object-cover"
            />
            <div className="ml-4">
              <h3 className="font-semibold text-white">{user.name}</h3>
              <p className="text-gray-400">@{user.username}</p>
              {user.bio && (
                <p className="text-gray-400 text-sm mt-1">{user.bio}</p>
              )}
            </div>
            <div className="ml-auto text-sm text-gray-400">
              <div>{user.followersCount} followers</div>
              <div>{user.followingCount} following</div>
            </div>
          </Link>
        ))}

        {searchQuery && !loading && searchResults.length === 0 && (
          <div className="text-center text-gray-500">
            No users found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

export default Search;
