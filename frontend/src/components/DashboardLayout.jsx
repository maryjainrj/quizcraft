import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/quizcraftwhite.png";
import { FaSearch, FaChevronDown } from "react-icons/fa";

const DashboardLayout = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const profilePic = "https://i.pravatar.cc/150?img=3";

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
            <img src={profilePic} alt="Profile" className="profile-pic" />
            <span className="username">John Doe</span>
            <FaChevronDown className="dropdown-icon" />
            {showDropdown && (
              <div className="dropdown-menu">
                <button onClick={() => navigate("/login")}>Logout</button>
              </div>
            )}
          </div>
        </header>

        {/* Body (swaps via nested routes) */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
