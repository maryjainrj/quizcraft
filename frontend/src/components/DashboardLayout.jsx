import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/logo_quizcraftwhite.png";
import Footer from "./Footer";
import Header from "./Header";

// Brand + sidebar icons
import quizcraft from "../assets/logo_quizcraft.png";
import dashboardImgPurple from "../assets/dashboardImgPurple.png";
import dashboardImgWhite from "../assets/dashboardImgWhite.png";
import exportQuizPurple from "../assets/exportQuizPurple.png";
import exportQuizWhite from "../assets/exportQuizWhite.png";
import shareQuizPurple from "../assets/shareQuizPurple.png";
import shareQuizWhite from "../assets/shareQuizWhite.png";

import { FaSearch, FaChevronDown } from "react-icons/fa";

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
  const [searchQuery, setSearchQuery] = useState(""); // Add search state
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(getDisplayName);
  const { donationStatus, isLoading } = useDonationStatus();

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

  // Clear search when route changes
  useEffect(() => {
    setSearchQuery("");
  }, [location.pathname]);

  const isDashboard = location.pathname === "/dashboard";
  const isShare = location.pathname.startsWith("/dashboard/sharequiz");
  const isExport = location.pathname.startsWith("/dashboard/exportquiz");
  const isQuizPreview = location.pathname.includes("/dashboard/quiz/") || 
                        location.pathname.includes("/quiz-preview") ||
                        location.pathname === "/dashboard/quiz-preview";
  const isNewQuiz = location.pathname.startsWith("/dashboard/new");
  
  // Enable Share/Export only when:
  // 1. On quiz preview page OR
  // 2. On dashboard main page with saved quiz OR
  // 3. Already on share/export page
  const canShareExport = () => {
    if (isShare || isExport) return true; // Already on these pages
    if (isQuizPreview) return true; // Viewing a specific quiz or preview
    if (isNewQuiz) return false; // Creating new quiz
    
    // On dashboard - check if there's a saved quiz
    if (isDashboard) {
      try {
        const lastQuiz = localStorage.getItem("lastQuiz");
        if (!lastQuiz) return false;
        const quiz = JSON.parse(lastQuiz);
        return quiz.questions && quiz.questions.length > 0;
      } catch {
        return false;
      }
    }
    
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("sessionExpiry");
    navigate("/", { replace: true });
  };

  const handleDisabledClick = (e) => {
    e.preventDefault();
  };

  return (
    <>
      <Header />
      <div className="dashboard-wrapper">
        {/* Sidebar */}
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <Link
              to="/dashboard"
              className={`nav-btn ${isDashboard ? "active" : ""}`}
            >
              <img
                src={dashboardImgWhite}
                alt="Dashboard"
                className="nav-icon"
              />
              <span>My Quizzes</span>
            </Link>

            <Link
              to="/dashboard/sharequiz"
              className={`nav-btn ${isShare ? "active" : ""} ${!canShareExport() ? "disabled" : ""}`}
              onClick={!canShareExport() ? handleDisabledClick : undefined}
            >
              <img
                src={shareQuizWhite}
                alt="Share Quiz"
                className="nav-icon"
              />
              <span>Share Quiz</span>
            </Link>

            <Link
              to="/dashboard/exportquiz"
              className={`nav-btn ${isExport ? "active" : ""} ${!canShareExport() ? "disabled" : ""}`}
              onClick={!canShareExport() ? handleDisabledClick : undefined}
            >
              <img
                src={exportQuizWhite}
                alt="Export Quiz"
                className="nav-icon"
              />
              <span>Export Quiz</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="dashboard-page">
          <Outlet />
        </div>

        {/* Donate FAB */}
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="donate-fab"
          title="Support QuizCraft"
        >
          <span style={{ color: '#9D6CFF' }}>❤️</span> Donate
        </a>
      </div>
      <Footer />
    </>
  );
};

export default DashboardLayout;