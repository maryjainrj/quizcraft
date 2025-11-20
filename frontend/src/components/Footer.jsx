import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-section footer-brand">
            <div className="footer-logo">
              <div className="logo-icon">Q</div>
              <span>QuizCraft</span>
            </div>
            <p className="footer-description">
              AI-powered quiz generation for modern educators
            </p>
          </div>
          
          <div className="footer-section">
            <h4>Product</h4>
            <a href="/#features">Features</a>
            <a href="/#about">About Us</a>
            <a href="/#how-it-works">How It Works</a>
          </div>
          
          <div className="footer-section">
            <h4>Resources</h4>
            <Link to="/dashboard">Dashboard</Link>
            <a href="mailto:support@quizcraft.com">Support</a>
            <a href="/#about">FAQ</a>
          </div>
          
          <div className="footer-section">
            <h4>Contact</h4>
            <a href="mailto:support@quizcraft.com">support@quizcraft.com</a>
            <Link to="/contact">Contact Us</Link>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2025 QuizCraft. All rights reserved.</p>
          <div className="footer-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
