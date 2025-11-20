import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./ContactPage.css";
import quizcraft from "../assets/logo_quizcraft.png";

const ContactPage = () => {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log("Form submitted:", formData);
    alert("Thank you for contacting us! We'll get back to you soon.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="contact-page">
      {/* Header */}
      <header className="contact-page-header">
        <div className="contact-header-content">
          <Link to="/" className="contact-logo-section">
            <img src={quizcraft} alt="QuizCraft Logo" className="contact-logo-image" />
          </Link>
          <nav className="contact-nav">
            <Link to="/" className="contact-nav-link">Home</Link>
            <Link to="/#features" className="contact-nav-link">Features</Link>
            <Link to="/#about" className="contact-nav-link">About</Link>
            {isLoggedIn ? (
              <Link to="/dashboard" className="contact-nav-link-primary">Dashboard</Link>
            ) : (
              <Link to="/login" className="contact-nav-link-primary">Login</Link>
            )}
          </nav>
        </div>
      </header>

      <div className="contact-hero">
        <h1>Contact Us</h1>
        <p>Have questions? We'd love to hear from you</p>
      </div>

      <div className="contact-content">
        <div className="contact-info-section">
          <div className="info-card">
            <h3>Email</h3>
            <p>support@quizcraft.com</p>
          </div>
          <div className="info-card">
            <h3>Support</h3>
            <p>Available 24/7 to assist you</p>
          </div>
          <div className="info-card">
            <h3>Location</h3>
            <p>Online Platform - Global Access</p>
          </div>
        </div>

        <div className="contact-form-section">
          <form onSubmit={handleSubmit} className="contact-form-main">
            <div className="form-field">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your Name"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Your Email"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="subject">Subject</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Subject"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Your Message"
                rows="6"
                required
              ></textarea>
            </div>
            <button type="submit" className="submit-btn">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
