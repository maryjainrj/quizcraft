import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/quizcraft.png";
import sallyImage from "../assets/sally.png";
import { setAuth } from "../utils/auth";

function parseLoginError(err) {
  const raw = (err?.message || "").toLowerCase();
  if (raw.includes("invalid credentials")) return "Email/username and password don’t match.";
  if (raw.includes("user not found")) return "Account not found. Check your email/username.";
  if (raw.includes("password")) return "Incorrect password.";
  if (raw.includes("google")) return "Google sign-in failed. Please try again.";
  if (raw.includes("failed to fetch") || raw.includes("network")) return "Can’t reach the server.";
  if (raw.match(/\b(500|502|503|504)\b/)) return "Server error. Try again shortly.";
  return "Login failed. Please try again.";
}

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000";

export default function Login() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const submitBtnRef = useRef(null);
  const googleBtnHostRef = useRef(null);

  useEffect(() => {
    setForm({ identifier: "", password: "" });
  }, [location.key]);

  // GOOGLE SIGN-IN (unchanged)
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const onCredential = async (response) => {
      const credential = response?.credential;
      if (!credential) return;
      try {
        setErr("");
        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id_token: credential }),
        });
        if (!res.ok) throw new Error("Google auth failed");
        const { token, user } = await res.json();
        setAuth(token, user, { sessionOnly: true });
        navigate("/dashboard", { replace: true });
      } catch (e) {
        console.error("[googleLogin] error:", e);
        setErr(parseLoginError(e));
      }
    };

    const renderGoogle = () => {
      if (!window.google?.accounts?.id) return false;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
      });

      const host = googleBtnHostRef.current;
      const targetWidth = Math.round(submitBtnRef.current?.offsetWidth || 260);
      host.innerHTML = "";
      window.google.accounts.id.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: targetWidth,
      });
      host.style.display = "block";
      host.style.width = `${targetWidth}px`;
      return true;
    };

    const tryInit = () => {
      if (!window.google?.accounts?.id) return false;
      renderGoogle();
      return true;
    };

    if (!tryInit()) {
      const id = setInterval(() => {
        if (tryInit()) clearInterval(id);
      }, 100);
      return () => clearInterval(id);
    }
  }, [navigate]);

  // NORMAL LOGIN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          password: form.password,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { token, user } = await res.json();
      setAuth(token, user, { sessionOnly: true });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErr(parseLoginError(error));
      console.error("[login] error:", error);
      setForm((f) => ({ ...f, password: "" }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <img src={quizcraft} alt="QuizCraft logo" />
      </div>

      <div className="auth-left">
        <div className="auth-box">
          <h2 className="auth-title">Welcome Back to QuizCraft</h2>
          <p className="auth-subtitle">Sign in to access your dashboard</p>

          {err && <div className="auth-error">{err}</div>}

          <form
            onSubmit={handleSubmit}
            className="auth-form"
            autoComplete="off"     /* 1) fully disable autofill at form level */
            noValidate
          >
            {/* 2) Hidden decoys satisfy browsers/password managers */}
            <input type="text" name="email" autoComplete="username" style={{ display: "none" }} />
            <input type="password" name="password" autoComplete="current-password" style={{ display: "none" }} />

            {/* 3) Real fields with non-standard names & autocomplete off */}
            <input
              type="text"
              // no 'name' or use a non-standard one to avoid autofill heuristics
              placeholder="Email or Username"
              className="auth-input"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              autoComplete="off"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />

            <input
              type="password"
              // no 'name' or use non-standard
              placeholder="Password"
              className="auth-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="off"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />

            <button
              ref={submitBtnRef}
              type="submit"
              className="auth-btn"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            <div ref={googleBtnHostRef} style={{ marginTop: 12 }} />
          </form>

          <div className="auth-footer">
            Don’t have an account? <Link to="/signup">Register</Link>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <img src={sallyImage} alt="Illustration" />
      </div>
    </div>
  );
}
