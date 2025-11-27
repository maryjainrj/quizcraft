// DashboardLayout.jsx
import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import "./Auth.css";
import quizcraftwhite from "../assets/logo_quizcraftwhite.png";
import Footer from "./Footer";
import Header from "./Header";
import { useDonationStatus } from "../hooks/useDonationStatus";

// Sidebar icons
import dashboardImgPurple from "../assets/dashboardImgPurple.png";
import dashboardImgWhite from "../assets/dashboardImgWhite.png";
import exportQuizPurple from "../assets/exportQuizPurple.png";
import exportQuizWhite from "../assets/exportQuizWhite.png";
import shareQuizPurple from "../assets/shareQuizPurple.png";
import shareQuizWhite from "../assets/shareQuizWhite.png";

const DONATE_URL = "/donate";

const DashboardLayout = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking
  const [displayName, setDisplayName] = useState("User");
  const [searchQuery, setSearchQuery] = useState("");
  
  const location = useLocation();
  const navigate = useNavigate();
  const { donationStatus, isLoading: donationLoading } = useDonationStatus();

  // Step 1: Validate session on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const expiry = Number(localStorage.getItem("sessionExpiry") || 0);
    const now = Date.now();

    if (!token || (expiry && now > expiry)) {
      // Invalid or expired session → force logout
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("sessionExpiry");
      localStorage.removeItem("lastQuiz"); // optional: clean up
      navigate("/login", { replace: true });
      setIsAuthenticated(false);
      return;
    }

    // Valid session
    setIsAuthenticated(true);

    // Safely get display name only if authenticated
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const name =
        user?.name ||
        user?.username ||
        (user?.email ? user.email.split("@")[0] : "") ||
        "User";
      setDisplayName(name);
    } catch (e) {
      setDisplayName("User");
    }
  }, [navigate]);

  // Step 2: Listen for storage changes (e.g. logout in another tab)
  useEffect(() => {
    const handleStorageChange = () => {
      if (!localStorage.getItem("token")) {
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  // Clear search on route change
  useEffect(() => {
    setSearchQuery("");
  }, [location.pathname]);

  // Step 3: Show loading until auth is confirmed
  if (isAuthenticated === null) {
    return (
      <div className="auth-loading-screen">
        <div className="loader">
          <img src={quizcraftwhite} alt="QuizCraft" style={{ height: 50 }} />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If somehow not authenticated (shouldn't happen)
  if (!isAuthenticated) {
    return null;
  }

  // Step 4: Helper to check if Share/Export should be enabled
  const isDashboard = location.pathname === "/dashboard";
  const isShare = location.pathname.startsWith("/dashboard/sharequiz");
  const isExport = location.pathname.startsWith("/dashboard/exportquiz");
  const isQuizPreview = location.pathname.includes("/dashboard/quiz/") ||
                        location.pathname.includes("/quiz-preview") ||
                        location.pathname === "/dashboard/quiz-preview";
  const isNewQuiz = location.pathname.startsWith("/dashboard/new");

  const canShareExport = () => {
    if (isShare || isExport || isQuizPreview) return true;
    if (isNewQuiz) return false;

    if (isDashboard) {
      try {
        const lastQuiz = localStorage.getItem("lastQuiz");
        if (!lastQuiz) return false;
        const quiz = JSON.parse(lastQuiz);
        return quiz?.questions?.length > 0;
      } catch {
        return false;
      }
    }
    return false;
  };

  const handleDisabledClick = (e) => {
    e.preventDefault();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("sessionExpiry");
    navigate("/", { replace: true });
  };

  return (
    <>
      <Header
        displayName={displayName}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="dashboard-wrapper">
        {/* Sidebar */}
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <Link
              to="/dashboard"
              className={`nav-btn ${isDashboard ? "active" : ""}`}
            >
              <img
                src={isDashboard ? dashboardImgPurple : dashboardImgWhite}
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
                src={isShare ? shareQuizPurple : shareQuizWhite}
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
                src={isExport ? exportQuizPurple : exportQuizWhite}
                alt="Export Quiz"
                className="nav-icon"
              />
              <span>Export Quiz</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="dashboard-page">
          <Outlet context={{ searchQuery }} />
        </div>

        {/* Donate FAB */}
        <a
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="donate-fab"
          title="Support QuizCraft ❤️"
        >
          <span style={{ color: '#9D6CFF' }}>❤️</span> Donate
        </a>
      </div>

      <Footer />
    </>
  );
};

export default DashboardLayout;