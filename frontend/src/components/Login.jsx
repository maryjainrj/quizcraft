import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import quizcraft from "../assets/logo_quizcraft.png";
import heroImage from "../assets/hero.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Robust Google Client ID resolver
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
  const [showPw, setShowPw] = useState(false); // eye toggle
  const navigate = useNavigate();

  // Refs for Google
  const codeClientRef = useRef(null);
  const idClientReadyRef = useRef(false);
  const googleBtnHostRef = useRef(null);

  // Debug (optional)
  useEffect(() => {
    console.log("Resolved GOOGLE_CLIENT_ID →", GOOGLE_CLIENT_ID || "(empty)");
  }, []);

  // always start with empty fields
  useEffect(() => {
    setForm({ username: "", password: "" });
  }, []);

  // Helper: persist token + user + 24h expiry
  const persistAuth = (data, fallbackId = "") => {
    try {
      if (data?.token) localStorage.setItem("token", data.token);

      const derivedName = (() => {
        if (data?.user?.name) return data.user.name;
        if (data?.user?.username) return data.user.username;
        if (data?.name) return data.name;
        if (data?.username) return data.username;
        if (fallbackId) {
          return fallbackId.includes("@")
            ? fallbackId.split("@")[0]
            : fallbackId;
        }
        return "User";
      })();

      const derivedEmail = (() => {
        if (data?.user?.email) return data.user.email;
        if (data?.email) return data.email;
        if (fallbackId?.includes("@")) return fallbackId;
        return "";
      })();

      const userToStore = data?.user || {
        name: derivedName,
        email: derivedEmail,
      };

      localStorage.setItem("user", JSON.stringify(userToStore));
      const expiryTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      localStorage.setItem("sessionExpiry", String(expiryTime));

      console.log("[persistAuth] saved:", {
        tokenSaved: !!data?.token,
        user: userToStore,
        sessionExpiry: new Date(expiryTime).toISOString(),
      });
    } catch (e) {
      console.warn("Failed to persist auth:", e);
    }
  };

  // Local (username/email + password) sign-in
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);

    try {
      const id = (form.username || "").trim();
      const payload = id.includes("@")
        ? {
            email: id.toLowerCase().replace(/[,;]+$/g, ""),
            password: form.password,
          }
        : { username: id, password: form.password };

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");

      // save token + user + 24h expiry (single source of truth)
      persistAuth(data, id);

      navigate("/dashboard");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Google OAuth (code flow + optional ID flow)
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setErr(
        "Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID or <meta name='google-client-id'>."
      );
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
      // OAuth Code Client
      try {
        codeClientRef.current =
          window.google?.accounts?.oauth2?.initCodeClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: "openid email profile",
            ux_mode: "popup",
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
                if (!res.ok)
                  throw new Error(data.message || "Google sign-in failed");

                const fallbackName =
                  data?.user?.name ||
                  data?.profile?.name ||
                  data?.name ||
                  "";

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

      // ID token flow (optional backup)
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
                if (!credential)
                  throw new Error("No Google credential received.");

                const res = await fetch(`${API_BASE}/api/auth/google`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ credential }),
                  credentials: "include",
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok)
                  throw new Error(data.message || "Google sign-in failed");

                const fallbackName =
                  data?.user?.name ||
                  data?.profile?.name ||
                  data?.name ||
                  "";

                persistAuth(data, fallbackName);
                navigate("/dashboard");
              } catch (e) {
                console.error("[GIS id flow] error:", e);
                setErr(e.message || "Google sign-in failed");
              }
            },
          });

          if (googleBtnHostRef.current) {
            id.renderButton(googleBtnHostRef.current, {
              theme: "outline",
              size: "large",
            });
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
        if (!cancelled) {
          setErr(
            "Google Sign-In script blocked. Disable ad-block/privacy for localhost."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

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

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <img src={quizcraft} alt="QuizzCraft logo" />
      </div>

      {/* Left side - Form */}
      <div className="auth-left">
        <div className="auth-box">
          <h2 className="auth-title">Welcome Back to QuizzCraft</h2>
          <p className="auth-subtitle">Sign in to access your dashboard</p>

          {err ? <div className="auth-error">{err}</div> : null}

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            {/* hidden decoys */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: "none" }}
            />

            <label htmlFor="username" className="auth-label">
              Username
            </label>
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
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
              required
              title="Enter your username or email"
            />

            <label htmlFor="password" className="auth-label">
              Password
            </label>

            {/* password input with eye icon */}
            <div className="input-with-addon">
              <input
                type={showPw ? "text" : "password"}
                id="password"
                name="passField"
                className="auth-input"
                placeholder="Password"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
                title="Enter your password"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                onClick={() => setShowPw((v) => !v)}
                title={showPw ? "Hide password" : "Show password"}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M12 5c-5 0-9 4.5-9 7s4 7 9 7 9-4.5 9-7-4-7-9-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
                    fill="#444"
                  />
                  <circle cx="12" cy="12" r="2.5" fill="#444" />
                </svg>
              </button>
            </div>

            <div className="forgot-wrap">
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="auth-btn"
              aria-busy={submitting}
              disabled={submitting}
            >
              Sign In
            </button>

            <div className="auth-footer">
              Don’t have an account? <Link to="/signup">Register</Link>
            </div>

            {/* custom-styled Google button */}
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

            {/* Off-screen official button host (hidden but kept) */}
            <div
              ref={googleBtnHostRef}
              style={{ position: "fixed", left: -9999, top: -9999 }}
            />
          </form>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="auth-right">
        <img src={heroImage} alt="Illustration" />
      </div>
    </div>
  );
};

export default Login;
