import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/quizcraft.png";
import sallyImage from "../assets/sally.png";

// --- Friendly GraphQL fetch: surfaces server error messages cleanly ---
const gqlFetch = async (query, variables = {}) => {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  // Read body once (handles both success + error)
  const text = await res.text();

  // Try to parse JSON if possible
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  // If GraphQL returned errors, surface the first one
  if (json?.errors?.length) {
    throw new Error(json.errors[0].message || "GraphQL error");
  }

  // If HTTP not ok and not valid GraphQL JSON, show raw response
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  // Success
  return json.data;
};

const Signup = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // ---- Email/Password Sign Up ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (form.password !== form.confirmPassword) {
      setErr("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const query = `
        mutation($n:String!,$e:String!,$p:String!){
          register(name:$n, email:$e, password:$p){
            token
            user { id name email provider avatarUrl }
          }
        }
      `;
      const data = await gqlFetch(query, {
        n: form.username, // UI shows "Username" but backend expects 'name'
        e: form.email,
        p: form.password,
      });

      const { token, user } = data.register;
      localStorage.setItem("qc_token", token);
      localStorage.setItem("qc_user", JSON.stringify(user));
      window.location.href = "/dashboard";
    } catch (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("email already registered")) {
        setErr("Email already registered — try logging in instead.");
        // Optional: auto-navigate to login:
        // setTimeout(() => (window.location.href = "/login"), 1200);
      } else {
        setErr(error.message || "Sign up failed");
      }
      console.error("[register] error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Google Sign-Up / Sign-In (unchanged; works if you initialized GIS) ----
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (window.google?.accounts?.id && GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        ux_mode: "popup",
        callback: async (resp) => {
          try {
            const q = `
              mutation($c:String!){
                googleLogin(credential:$c){
                  token
                  user { id name email provider avatarUrl }
                }
              }
            `;
            const data = await gqlFetch(q, { c: resp.credential });
            const { token, user } = data.googleLogin;
            localStorage.setItem("qc_token", token);
            localStorage.setItem("qc_user", JSON.stringify(user));
            window.location.href = "/dashboard";
          } catch (e) {
            setErr(e.message || "Google sign-in failed");
          }
        },
      });
    }
  }, [GOOGLE_CLIENT_ID]);

  const handleGoogleClick = () => {
    setErr("");
    if (!window.google?.accounts?.id) {
      setErr("Google script not loaded. Add it to index.html.");
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      setErr("Missing VITE_GOOGLE_CLIENT_ID in frontend .env");
      return;
    }
    window.google.accounts.id.prompt(); // opens the account chooser
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
          <p className="auth-subtitle">Create your account to get started</p>

          {err && <div className="auth-error">{err}</div>}

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            <input
              type="text"
              name="username"
              placeholder="Username"
              className="auth-input"
              value={form.username}
              onChange={handleChange}
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email address"
              className="auth-input"
              value={form.email}
              onChange={handleChange}
              autoComplete="off"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              className="auth-input"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm password"
              className="auth-input"
              value={form.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Signing Up..." : "Sign Up"}
            </button>

            <button type="button" className="google-btn" onClick={handleGoogleClick}>
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
              />
              Sign up with Google
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Login</Link>
          </div>
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
