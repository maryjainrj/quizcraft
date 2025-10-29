import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/quizcraft.png";
import sallyImage from "../assets/sally.png";


const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Temporary bypass: skip verification and go to dashboard
    navigate('/dashboard');
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
          <h2 className="auth-title">Welcome Back to QuizzCraft</h2>
          <p className="auth-subtitle">SIGN IN</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="username" className="auth-label">Username</label>
            <input
              type="text"
              name="username"
              placeholder="Username or email address"
              className="auth-input"
              value={form.username}
              onChange={handleChange}
            />

            <label htmlFor="password" className="auth-label">Password</label>
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="auth-input"
              value={form.password}
              onChange={handleChange}
            />

            <button type="submit" className="auth-btn">
              Sign In
            </button>

            <div className="auth-footer">
            Don’t have an account? <Link to="/signup">Register</Link>
            </div>

            <button type="button" className="google-btn">
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
              />
              Sign in with Google
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

export default Login;
