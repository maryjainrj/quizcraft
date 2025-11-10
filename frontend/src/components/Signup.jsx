// frontend/src/components/Signup.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/quizcraft.png";
import sallyImage from "../assets/sally.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// validation helpers 

const emailRe =
/^(?=.{1,254}$)(?=.{1,64}@)(?!.*\.\.)[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;


function validate(fields) {
  const e = {};
  // email
  if (!fields.email?.trim()) e.email = "Email is required";
  else if (!emailRe.test(fields.email.trim())) e.email = "Enter a valid email";

  // username
  if (!fields.username?.trim()) e.username = "Username is required";
  else if (fields.username.trim().length < 3) e.username = "At least 3 characters";

  // password
  const pw = fields.password || "";
  if (!pw) e.password = "Password is required";
  else {
    if (pw.length < 8) e.password = "Minimum 8 characters";
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
      e.password = (e.password ? e.password + " • " : "") + "Use letters & numbers";
    }
  }

  // confirm
  if (!fields.confirmPassword) e.confirmPassword = "Please confirm password";
  else if (fields.password !== fields.confirmPassword)
    e.confirmPassword = "Passwords do not match";

  return e;
}

const Signup = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({});
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const gisReadyRef = useRef(false);
  const googleBtnHostRef = useRef(null); 

  // prevents any autosaved text 
  useEffect(() => {
    setForm({ username: "", email: "", password: "", confirmPassword: "" });
    setTouched({});
  }, []);

  const fieldErrors = validate(form);
  const hasErrors = Object.keys(fieldErrors).length > 0;

  const onBlur = (name) => () => setTouched((t) => ({ ...t, [name]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");

    // show all errors if user pressed submit
    if (hasErrors) {
      setTouched({ email: true, username: true, password: true, confirmPassword: true });
      setErr("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Signup failed");
      localStorage.setItem("token", data.token);
      navigate("/dashboard");
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Google Sign-Up (popup + diagnostics + off-screen official btn)
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    if (window.__gisLoaded) {
      gisReadyRef.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: false,
          callback: async (response) => {
            try {
              if (!response?.credential) throw new Error("No Google credential received");

              // 🔍 Optional local decode for diagnostics
              try {
                const b64 = response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
                const decoded = JSON.parse(atob(b64));
                if (decoded?.aud !== GOOGLE_CLIENT_ID) {
                  console.warn("[GIS] Frontend audience mismatch:", decoded?.aud, "vs", GOOGLE_CLIENT_ID);
                }
              } catch {}

              const res = await fetch(`${API_BASE}/api/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ credential: response.credential }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.message || "Google sign-in failed");
              localStorage.setItem("token", data.token);
              navigate("/dashboard");
            } catch (e) {
              setErr(e.message || "Google sign-in failed");
            }
          },
        });

        try {
          if (googleBtnHostRef.current) {
            window.google.accounts.id.renderButton(googleBtnHostRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
              shape: "rectangular",
              text: "signup_with",
            });
          }
        } catch {}

        try {
          window.google.accounts.id.prompt(() => {});
        } catch {}

        window.__gisLoaded = true;
        gisReadyRef.current = true;
      }
    };

    document.body.appendChild(script);
    return () => {};
  }, [navigate]);

  const handleGoogleClick = () => {
    setErr("");
    if (!gisReadyRef.current) {
      setErr("Google Sign-In not ready yet. Please try again in a moment.");
      return;
    }
    try {
      const btn = googleBtnHostRef.current?.querySelector('div[role="button"]');
      if (btn) btn.click();
      else window.google.accounts.id.prompt();
    } catch {
      setErr("Could not open Google Sign-In. Reload and try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <img src={quizcraft} alt="QuizzCraft logo" />
      </div>

      {/* Left side - Form */}
      <div className="auth-left">
        <div className="auth-box">
          <h2 className="auth-title">Welcome to QuizzCraft</h2>
          <p className="auth-subtitle">SIGN UP</p>

          {/* global  */}
          {err ? <div className="auth-error">{err}</div> : null}

          {/*  only adds aria + small error rows */}
          <form
            onSubmit={handleSubmit}
            className="auth-form"
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
          >
            {/* Hidden decoys to swallow browser autofill */}
            <input type="email" name="email" autoComplete="email" tabIndex={-1} style={{ display: "none" }} />
            <input type="text" name="username" autoComplete="username" tabIndex={-1} style={{ display: "none" }} />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} style={{ display: "none" }} />

            <label htmlFor="email" className="auth-label">Email id</label>
            <input
              type="email"
              id="email"
              name="emailField"
              placeholder="Email address"
              className="auth-input"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={onBlur("email")}
              aria-invalid={touched.email && !!fieldErrors.email}
              required
            />
            {touched.email && fieldErrors.email ? (
              <div className="field-error">{fieldErrors.email}</div>
            ) : null}

            <label htmlFor="username" className="auth-label">Username</label>
            <input
              type="text"
              id="username"
              name="userField"
              placeholder="Username"
              className="auth-input"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              onBlur={onBlur("username")}
              aria-invalid={touched.username && !!fieldErrors.username}
              required
            />
            {touched.username && fieldErrors.username ? (
              <div className="field-error">{fieldErrors.username}</div>
            ) : null}

            <label htmlFor="password" className="auth-label">Password</label>
            <input
              type="password"
              id="password"
              name="passField"
              placeholder="Password"
              className="auth-input"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onBlur={onBlur("password")}
              aria-invalid={touched.password && !!fieldErrors.password}
              required
            />
            {touched.password && fieldErrors.password ? (
              <div className="field-error">{fieldErrors.password}</div>
            ) : null}

            <label htmlFor="confirmPassword" className="auth-label">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPasswordField"
              placeholder="Confirm password"
              className="auth-input"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              onBlur={onBlur("confirmPassword")}
              aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
              required
            />
            {touched.confirmPassword && fieldErrors.confirmPassword ? (
              <div className="field-error">{fieldErrors.confirmPassword}</div>
            ) : null}

            <button
              type="submit"
              className="auth-btn"
              aria-busy={submitting}
              disabled={submitting}
            >
              Sign Up
            </button>

            <div className="auth-footer">
              Already have an account? <Link to="/login">Login</Link>
            </div>

            <button type="button" className="google-btn" onClick={handleGoogleClick}>
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
              />
              Sign up with Google
            </button>

            {/* Off-screen official Google button host  */}
            <div ref={googleBtnHostRef} style={{ position: "fixed", left: -9999, top: -9999 }} />
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
