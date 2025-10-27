// src/components/Dashboard.jsx
import React, { useState } from "react";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/quizcraftwhite.png";
import { FaSearch, FaChevronDown } from "react-icons/fa";

// NEW: live user badge + robust logout
import UserBadge from "./UserBadge";
import LogoutButton from "./LogoutButton";

const Dashboard = () => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="auth-logo">
          <img src={quizcraftwhite} alt="QuizzCraft logo" />
          {/* <h3>QuizzCraft</h3> */}
        </div>
        <nav className="sidebar-nav">
          <button className="nav-btn active">Dashboard</button>
          <button className="nav-btn">Share Quiz</button>
          <button className="nav-btn">Export Quiz</button>
        </nav>
      </aside>

      {/* Main section */}
      <div className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="search-container">
            <input type="text" placeholder="Search..." />
            <FaSearch className="search-icon" />
          </div>

          <div
            className="profile-container"
            onClick={() => setShowDropdown((v) => !v)}
          >
            {/* Replaces manual localStorage logic:
               - Shows avatar/initials + name ("Guest" if not logged in)
               - Reacts live to login/logout via onAuthChange */}
            <UserBadge />
            <FaChevronDown className="dropdown-icon" />
            {showDropdown && (
              <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                {/* Robust logout that clears storage, emits change event, and redirects */}
                <LogoutButton className="dropdown-item">Logout</LogoutButton>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-content">
          <h3>Welcome to Quiz Dashboard</h3>
          <p>Manage your quiz questions here. You can edit and delete questions.</p>

          <div className="quiz-options">
            <div className="quiz-card">
              <h3>From File</h3>
              <p>Create quiz based on your uploading file.</p>
              <button>Add New Quiz</button>
            </div>

            <div className="quiz-card">
              <h3>From Text</h3>
              <p>Create quiz based on your written text.</p>
              <button>Add New Quiz</button>
            </div>
          </div>

          <div className="upload-box">
            <h4>Upload Files</h4>
            <p>Drag your file(s) or browse</p>
            <p>Max 10 MB files are allowed (PDF only)</p>
          </div>

          <div className="dashboard-empty">
            No quiz available <br />
            Currently, there are no quizzes. Please add a new quiz.
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
