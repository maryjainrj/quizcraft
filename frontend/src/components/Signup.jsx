import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/quizcraft.png";
import sallyImage from "../assets/sally.png";


const Signup = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    alert("Signup UI only — backend not yet connected.");
  };

  return (
    <div className="auth-page">
        <div className="auth-logo">
            <img src={quizcraft} alt="QuizzCraft logo" />
            {/* <h3>QuizzCraft</h3> */}
        </div>
      {/* Left side - Form */}
      <div className="auth-left">
        <div className="auth-box">
          <h2 className="auth-title">Welcome to QuizzCraft</h2>
          <p className="auth-subtitle">SIGN UP</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="email" className="auth-label">Email id</label>
            <input
              type="email"
              name="email"
              placeholder="Email address"
              className="auth-input"
              value={form.email}
              onChange={handleChange}
              required
            />
            
            <label htmlFor="username" className="auth-label">Username</label>
            <input
              type="text"
              name="username"
              placeholder="Username"
              className="auth-input"
              value={form.username}
              onChange={handleChange}
              required
            />

            <label htmlFor="password" className="auth-label">Password</label>
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="auth-input"
              value={form.password}
              onChange={handleChange}
              required
            />

            <label htmlFor="confirmPassword" className="auth-label">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm password"
              className="auth-input"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />

            <button type="submit" className="auth-btn">
              Sign Up
            </button>

            <div className="auth-footer">
            Already have an account? <Link to="/login">Login</Link>
            </div>

            <button type="button" className="google-btn">
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
              />
              Sign up with Google
            </button>
          </form>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="auth-right">
        <img src={sallyImage} alt="Illustration" />
      </div>
    </div>
  );
};

export default Signup;
