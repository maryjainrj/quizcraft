import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/logo_quizcraftwhite.png";

// Brand + sidebar icons
import quizcraft from "../assets/logo_quizcraft.png";

import dashboardImgPurple from "../assets/dashboardImgPurple.png";
import dashboardImgWhite from "../assets/dashboardImgWhite.png";
import exportQuizPurple from "../assets/exportQuizPurple.png";
import exportQuizWhite from "../assets/exportQuizWhite.png";
import shareQuizPurple from "../assets/shareQuizPurple.png";
import shareQuizWhite from "../assets/shareQuizWhite.png";

import { FaSearch, FaChevronDown } from "react-icons/fa";

const DONATE_URL = "https://example.com/donate"; // TODO: replace with your real donate link i.e. paypal

const getDisplayName = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return (
      u?.name ||
      u?.username ||
      (u?.email ? String(u.email).split("@")[0] : "") ||
      "User"
    );
  } catch {
    return "User";
  }
};

const DashboardLayout = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getDisplayName);

  useEffect(() => {
    const expiry = Number(localStorage.getItem("sessionExpiry") || 0);
    if (expiry && Date.now() > expiry) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("sessionExpiry");
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const onStorage = () => setDisplayName(getDisplayName());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isDashboard = location.pathname === "/dashboard";
  const isShare = location.pathname.startsWith("/dashboard/sharequiz");
  const isExport = location.pathname.startsWith("/dashboard/exportquiz");

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="auth-logo">
          <img src={quizcraftwhite} style={{ width: '120px', height: 'auto' }} alt="QuizzCraft logo" />
        </div>
        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`nav-btn ${isDashboard ? "active" : ""}`}
          >
            <img
              className="nav-icon"
              src={isDashboard ? dashboardImgPurple : dashboardImgWhite}
              alt=""
            />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/dashboard/sharequiz"
            className={`nav-btn ${isShare ? "active" : ""}`}
          >
            <img
              className="nav-icon"
              src={isShare ? shareQuizPurple : shareQuizWhite}
              alt=""
            />
            <span>Share Quiz</span>
          </Link>

          <Link
            to="/dashboard/exportquiz"
            className={`nav-btn ${isExport ? "active" : ""}`}
          >
            <img
              className="nav-icon"
              src={isExport ? exportQuizPurple : exportQuizWhite}
              alt=""
            />
            <span>Export Quiz</span>
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <div className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          {/* Header brand shows only when body has .hide-sidebar */}
          <div className="header-brand">
            <img src={quizcraft} alt="QuizCraft" className="header-logo" />
          </div>

          <div className="search-container">
            <input type="text" placeholder="Search..." />
            <FaSearch className="search-icon" />
          </div>

          <div
            className="profile-container"
            onClick={() => setShowDropdown(!showDropdown)}
          >
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

        {/* Routed pages */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>

      {/* Floating Donate Button (visible on all dashboard screens) */}
      <button
        className="donate-fab"
        aria-label="Donate to support QuizCraft"
        onClick={() => window.open(DONATE_URL, "_blank", "noopener,noreferrer")}
        title="Support QuizCraft"
      >
        <span className="donate-fab__emoji" aria-hidden="true">💜</span>
        <span className="donate-fab__text">Donate</span>
      </button>
    </div>
  );
};

export default DashboardLayout;
