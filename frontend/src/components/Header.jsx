import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaChevronDown } from 'react-icons/fa';
import './Header.css';
import quizcraft from "../assets/logo_quizcraft.png";

const Header = ({ searchQuery = '', onSearchChange = null }) => {
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

  const handleNavClick = (e, sectionId) => {
    e.preventDefault();
    const isOnLandingPage = location.pathname === '/';
    
    if (isOnLandingPage) {
      // If already on landing page, scroll to section
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // If on any other page (dashboard, contact, etc.), navigate to landing page with hash
      navigate(`/#${sectionId}`);
      // Small delay to allow page to load before scrolling
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo-section">
          <img src={quizcraft} alt="QuizCraft Logo" className="logo-image" />
        </Link>
        <nav className="header-nav">
          <a href="/#features" onClick={(e) => handleNavClick(e, 'features')} className="nav-link">Features</a>
          <a href="/#about" onClick={(e) => handleNavClick(e, 'about')} className="nav-link">About</a>
          <a href="/#how-it-works" onClick={(e) => handleNavClick(e, 'how-it-works')} className="nav-link">How It Works</a>
          <Link to="/contact" className="nav-link">Contact</Link>
          {isLoggedIn ? (
            <>
              {isDashboard && location.pathname === '/dashboard' && onSearchChange && (
                <div className="search-container">
                  <input 
                    type="text" 
                    placeholder="Search quizzes..." 
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
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
