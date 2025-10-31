import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/quizcraftwhite.png";
import { FaSearch, FaChevronDown } from "react-icons/fa";

const getDisplayName = () => {
  // 1) try stored user object
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    const fromUser =
      u?.name ||
      u?.username ||
      (u?.email ? String(u.email).split("@")[0] : "");
    if (fromUser) return fromUser;
  } catch {}

  // 2) fallback
  return "User";
};

const DashboardLayout = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(getDisplayName);

  // Auto-logout if 24h session expired
  useEffect(() => {
    const expiry = Number(localStorage.getItem("sessionExpiry") || 0);
    if (expiry && Date.now() > expiry) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("sessionExpiry");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Keep name fresh if localStorage changes
  useEffect(() => {
    const onStorage = () => setDisplayName(getDisplayName());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="auth-logo">
          <img src={quizcraftwhite} alt="QuizzCraft logo" />
        </div>
        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`nav-btn ${location.pathname === "/dashboard" ? "active" : ""}`}
          >
            Dashboard
          </Link>
          <Link
            to="/dashboard/sharequiz"
            className={`nav-btn ${location.pathname.startsWith("/dashboard/sharequiz") ? "active" : ""}`}
          >
            Share Quiz
          </Link>
          <Link
            to="/dashboard/exportquiz"
            className={`nav-btn ${location.pathname.startsWith("/dashboard/exportquiz") ? "active" : ""}`}
          >
            Export Quiz
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="search-container">
            <input type="text" placeholder="Search..." />
            <FaSearch className="search-icon" />
          </div>

          <div className="profile-container" onClick={() => setShowDropdown(!showDropdown)}>
            {/* removed image as requested */}
            <span className="username">{displayName}</span>
            <FaChevronDown className="dropdown-icon" />
            {showDropdown && (
              <div className="dropdown-menu">
                <button
                  onClick={() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    localStorage.removeItem("sessionExpiry");
                    navigate("/login", { replace: true });
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Body  */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
