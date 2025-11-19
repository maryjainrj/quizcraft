import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaChevronDown } from 'react-icons/fa';
import './Header.css';
import quizcraft from "../assets/logo_quizcraft.png";

const Header = () => {
  const isLoggedIn = !!localStorage.getItem('token');
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const name = user?.name || user?.username || (user?.email ? user.email.split('@')[0] : 'User');
        setDisplayName(name);
      } catch {
        setDisplayName('User');
      }
    }
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiry');
    navigate('/', { replace: true });
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo-section">
          <img src={quizcraft} alt="QuizCraft Logo" className="logo-image" />
        </Link>
        <nav className="header-nav">
          <a href="/#features" className="nav-link">Features</a>
          <a href="/#about" className="nav-link">About</a>
          <a href="/#how-it-works" className="nav-link">How It Works</a>
          {isLoggedIn ? (
            <>
              {isDashboard && (
                <div className="search-container">
                  <input type="text" placeholder="Search..." />
                  <FaSearch className="search-icon" />
                </div>
              )}
              {!isDashboard && (
                <Link to="/dashboard" className="nav-link nav-link-primary">Dashboard</Link>
              )}
              <div
                className="profile-container"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span className="username">{displayName}</span>
                <FaChevronDown className="dropdown-icon" />
                {showDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={handleLogout}>Logout</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/" className="nav-link nav-link-primary">Sign In</Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
