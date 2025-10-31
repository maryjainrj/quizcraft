// frontend/src/components/Login.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/quizcraft.png";
import sallyImage from "../assets/sally.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Robust Google Client ID resolver (env -> <meta> -> window)
const GOOGLE_CLIENT_ID =
  (import.meta.env?.VITE_GOOGLE_CLIENT_ID || "").trim() ||
  (typeof document !== "undefined"
    ? document.querySelector('meta[name="google-client-id"]')?.content?.trim()
    : "") ||
  (typeof window !== "undefined" ? window.__GOOGLE_CLIENT_ID || "" : "");

const Login = () => {
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Refs for Google
  const codeClientRef = useRef(null);       // OAuth Code Flow client
  const idClientReadyRef = useRef(false);   // optional fallback readiness
  const googleBtnHostRef = useRef(null);    // off-screen official button (kept, but unused)

  // Debug (can remove later)
  useEffect(() => {
    console.log("Resolved GOOGLE_CLIENT_ID →", GOOGLE_CLIENT_ID || "(empty)");
  }, []);

  // Always start with empty fields (even after back navigation)
  useEffect(() => {
    setForm({ username: "", password: "" });
  }, []);

  // ---- helper: persist auth (token + user + 24h expiry) ----
  const persistAuth = (data, fallbackId = "") => {
    try {
      if (data?.token) localStorage.setItem("token", data.token);

      // Accept common server shapes; otherwise derive name from entered id
      const derivedName = (() => {
        if (data?.user?.name) return data.user.name;
        if (data?.name) return data.name;
        if (data?.username) return data.username;
        if (fallbackId) return fallbackId.includes("@") ? fallbackId.split("@")[0] : fallbackId;
        return "User";
      })();

      const derivedEmail = (() => {
        if (data?.user?.email) return data.user.email;
        if (data?.email) return data.email;
        if (fallbackId?.includes("@")) return fallbackId;
        return "";
      })();

      const userToStore = data?.user || { name: derivedName, email: derivedEmail };
      localStorage.setItem("user", JSON.stringify(userToStore));

      const expiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      localStorage.setItem("sessionExpiry", String(expiryTime));

      // (optional) quick sanity log
      console.log("[persistAuth] saved:", {
        tokenSaved: !!data?.token,
        user: userToStore,
        sessionExpiry: new Date(expiryTime).toISOString(),
      });
    } catch (e) {
      console.warn("Failed to persist auth:", e);
    }
  };

  // -------------- Local (username/email + password) sign-in --------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);
    try {
      const id = (form.username || "").trim();
      const payload = id.includes("@")
        ? { email: id.toLowerCase().replace(/[,;]+$/g, ""), password: form.password }
        : { username: id, password: form.password };

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");

      // save token + user + 24h expiry
      persistAuth(data, id);

      navigate("/dashboard");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------- Google OAuth (Code Flow, account chooser on click) --------------
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setErr("Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID or <meta name='google-client-id'>.");
      return;
    }

    let cancelled = false;

    const ensureScript = () =>
      new Promise((resolve, reject) => {
        if (window.google?.accounts) return resolve();
        const existing = document.getElementById("google-gsi-script");
        if (existing) {
          existing.addEventListener("load", resolve, { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }
        const s = document.createElement("script");
        s.id = "google-gsi-script";
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

    const initClients = () => {
      // A) Primary: OAuth Code Client (recommended by Google)
      try {
        codeClientRef.current = window.google?.accounts?.oauth2?.initCodeClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          ux_mode: "popup", // don't redirect
          callback: async ({ code, error, error_description }) => {
            try {
              if (error) throw new Error(error_description || error);
              if (!code) throw new Error("No authorization code returned");
              const res = await fetch(`${API_BASE}/api/auth/google/code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
                credentials: "include",
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.message || "Google sign-in failed");

              const fallbackName = data?.user?.name || data?.profile?.name || data?.name || "";
              persistAuth(data, fallbackName);

              navigate("/dashboard");
            } catch (e) {
              console.error("[GIS code flow] error:", e);
              setErr(e.message || "Google sign-in failed");
            }
          },
        });
      } catch (e) {
        console.warn("[GIS] initCodeClient failed:", e);
      }

      // B) Optional fallback: ID token flow initialize only (no auto prompt)
      try {
        const id = window.google?.accounts?.id;
        if (id) {
          id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            ux_mode: "popup",
            auto_select: false,
            cancel_on_tap_outside: false,
            callback: async ({ credential }) => {
              try {
                if (!credential) throw new Error("No Google credential received.");
                const res = await fetch(`${API_BASE}/api/auth/google`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id_token: credential }),
                  credentials: "include",
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.message || "Google sign-in failed");

                const fallbackName = data?.user?.name || data?.profile?.name || data?.name || "";
                persistAuth(data, fallbackName);

                navigate("/dashboard");
              } catch (e) {
                console.error("[GIS id flow] error:", e);
                setErr(e.message || "Google sign-in failed");
              }
            },
          });
          if (googleBtnHostRef.current) {
            id.renderButton(googleBtnHostRef.current, { theme: "outline", size: "large" });
          }
          idClientReadyRef.current = true;
        }
      } catch (e) {
        console.warn("[GIS] id.initialize failed:", e);
      }
    };

    (async () => {
      try {
        await ensureScript();
        if (!cancelled) initClients();
      } catch (e) {
        if (!cancelled) setErr("Google Sign-In script blocked. Disable ad-block/privacy for localhost.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Only show chooser when user clicks
  const handleGoogleClick = () => {
    setErr("");
    if (codeClientRef.current) {
      codeClientRef.current.requestCode({ prompt: "select_account" });
      return;
    }
    if (idClientReadyRef.current) {
      window.google?.accounts?.id?.prompt();
      return;
    }
    setErr("Google Sign-In not ready yet. Please reload and try again.");
  };

  // --------------------------------- UI (unchanged layout) ---------------------------------
  return (
    <div className="auth-page">
      <div className="auth-logo">
        <img src={quizcraft} alt="QuizzCraft logo" />
      </div>

      {/* Left side - Form */}
      <div className="auth-left">
        <div className="auth-box">
          <h2 className="auth-title">Welcome Back to QuizzCraft</h2>
          <p className="auth-subtitle">SIGN IN</p>

          {err ? <div className="auth-error">{err}</div> : null}

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            {/* hidden decoys */}
            <input type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} />
            <input type="password" name="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" style={{ display: "none" }} />

            <label htmlFor="username" className="auth-label">Username</label>
            <input
              type="text"
              id="username"
              name="userField"
              className="auth-input"
              placeholder="Username or email address"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              title="Enter your username or email"
            />

            <label htmlFor="password" className="auth-label">Password</label>
            <input
              type="password"
              id="password"
              name="passField"
              className="auth-input"
              placeholder="Password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              title="Enter your password"
            />

            <button type="submit" className="auth-btn" aria-busy={submitting} disabled={submitting}>
              Sign In
            </button>

            <div className="auth-footer">
              Don’t have an account? <Link to="/signup">Register</Link>
            </div>

            {/* Your custom-styled Google button (unchanged visually) */}
            <button
              type="button"
              className="google-btn"
              onClick={handleGoogleClick}
              title="Sign in with Google"
            >
              <img
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg"
                alt="Google"
              />
              Sign in with Google
            </button>

            {/* Off-screen official button host (kept, but hidden) */}
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

export default Login;
