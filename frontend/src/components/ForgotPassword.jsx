// frontend/src/components/ForgotPassword.jsx
console.log("Loaded: src/components/ForgotPassword.jsx");

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/logo_quizcraft.png";
import sallyImage from "../assets/sally.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1=email, 2=otp+new pw
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const sendOtp = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to send OTP");
      setMsg(data?.message || "OTP sent to your email.");
      setStep(2);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const resetWithOtp = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setErr("Passwords do not match.");
    setErr(""); setMsg(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to reset password");
      setMsg("Password reset successful. Redirecting to Sign In…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo"><img src={quizcraft} alt="QuizzCraft logo" /></div>

      <div className="auth-left">
        <div className="auth-box">
          <h2 className="auth-title">{step === 1 ? "Reset your password" : "Verify OTP & Set new password"}</h2>
          <p className="auth-subtitle">{step === 1 ? "Enter your account email" : "Enter the OTP we sent to your email"}</p>

          {err && <div className="auth-error">{err}</div>}
          {msg && <div className="auth-success">{msg}</div>}

          {step === 1 ? (
            <form className="auth-form" onSubmit={sendOtp}>
              <label htmlFor="email" className="auth-label">Email</label>
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                required
              />
              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={resetWithOtp}>
              <label htmlFor="otp" className="auth-label">OTP</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                className="auth-input"
                placeholder="Enter the 6-digit OTP"
                value={otp}
                onChange={(e)=>setOtp(e.target.value)}
                required
                minLength={4}
                maxLength={8}
              />

              <label htmlFor="pw" className="auth-label">New password</label>
              <div className="input-with-addon">
                <input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  className="auth-input"
                  placeholder="Enter new password"
                  value={pw}
                  onChange={(e)=>setPw(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={()=>setShowPw(v=>!v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5c-5 0-9 4.5-9 7s4 7 9 7 9-4.5 9-7-4-7-9-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="#444"/>
                    <circle cx="12" cy="12" r="2.5" fill="#444"/>
                  </svg>
                </button>
              </div>

              <label htmlFor="pw2" className="auth-label">Confirm password</label>
              <input
                id="pw2"
                type={showPw ? "text" : "password"}
                className="auth-input"
                placeholder="Re-enter new password"
                value={pw2}
                onChange={(e)=>setPw2(e.target.value)}
                required
                minLength={6}
              />

              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="auth-right"><img src={sallyImage} alt="Illustration" /></div>
    </div>
  );
}
