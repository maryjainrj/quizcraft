import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./LandingPage.css";
import heroImage from "../assets/hero.png";
// import quizcraft from "../assets/logo_quizcraft.png";
import Header from "./Header";
import { FaLinkedin, FaGithub, FaEnvelope } from "./SocialIcons";
import { MaryJainImage, BipinImage, GreeshmaImage, AryaImage } from "./teamImages";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Robust Google Client ID resolver
const GOOGLE_CLIENT_ID =
  (import.meta.env?.VITE_GOOGLE_CLIENT_ID || "").trim() ||
  (typeof document !== "undefined"
    ? document.querySelector('meta[name="google-client-id"]')?.content?.trim()
    : "") ||
  (typeof window !== "undefined" ? window.__GOOGLE_CLIENT_ID || "" : "");

// ---------- Validation helpers (same rules as auth pages) ----------
const emailRe =
  /^(?=.{1,254}$)(?=.{1,64}@)(?!.*\.\.)[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

function validateLogin(fields) {
  const id = (fields.username || "").trim();
  if (!id) return "Email or username is required";

  if (id.includes("@")) {
    const cleaned = id.toLowerCase().replace(/[,;]+$/g, "");
    if (!emailRe.test(cleaned)) return "Enter a valid email address";
  }
  if (!fields.password) return "Password is required";
  if (fields.password.length < 8)
    return "Password must be at least 8 characters";
  return "";
}

function validateSignup(fields) {
  const name = (fields.name || "").trim();
  const email = (fields.email || "").trim();
  const pw = fields.password || "";

  if (!name) return "Full name is required";
  if (name.length < 3) return "Name must be at least 3 characters";

  if (!email) return "Email is required";
  if (!emailRe.test(email)) return "Enter a valid email";

  if (!pw) return "Password is required";
  let msg = "";
  if (pw.length < 8) msg = "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    msg = msg
      ? msg + " and include letters and numbers"
      : "Password must include letters and numbers";
  }
  return msg;
}

const LandingPage = () => {
  const navigate = useNavigate();
  const [showSignup, setShowSignup] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Refs for Google
  const codeClientRef = useRef(null);

  // Track auth
  const [isAuthed, setIsAuthed] = useState(false);

  const isSessionValid = () => {
    try {
      const token = localStorage.getItem("token");
      const expiry = Number(localStorage.getItem("sessionExpiry") || 0);
      return Boolean(token) && expiry > Date.now();
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const check = () => {
      const authed = isSessionValid();
      setIsAuthed((prev) => {
        if (prev && !authed) {
          window.location.reload();
        }
        return authed;
      });
    };

    check();
    const id = window.setInterval(check, 500);

    const onVis = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVis);

    const onStorage = (e) => {
      if (e.key === "token" || e.key === "sessionExpiry" || e.key === null) {
        check();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // ---------- Clear any prefilled data on mount ----------
  useEffect(() => {
    setLoginForm({ username: "", password: "" });
    setSignupForm({ name: "", email: "", password: "" });
  }, []);

  // extra defence: clear any browser autofill each time we toggle sign-in/sign-up
  useEffect(() => {
    if (!showSignup) {
      // showing LOGIN
      setLoginForm({ username: "", password: "" });
      const clearDom = () => {
        const idEl = document.getElementById("email");
        const pwEl = document.getElementById("password");
        if (idEl) idEl.value = "";
        if (pwEl) pwEl.value = "";
      };
      clearDom();
      const t = setTimeout(clearDom, 150);
      return () => clearTimeout(t);
    } else {
      // showing SIGNUP
      setSignupForm({ name: "", email: "", password: "" });
      const clearDom = () => {
        const nameEl = document.getElementById("name");
        const emailEl = document.getElementById("signup-email");
        const pwEl = document.getElementById("signup-password");
        if (nameEl) nameEl.value = "";
        if (emailEl) emailEl.value = "";
        if (pwEl) pwEl.value = "";
      };
      clearDom();
      const t = setTimeout(clearDom, 150);
      return () => clearTimeout(t);
    }
  }, [showSignup]);

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
      const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("sessionExpiry", String(expiryTime));
    } catch (e) {
      console.warn("Failed to persist auth:", e);
    }
  };

  // ---------- Local Login ----------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");

    const vErr = validateLogin(loginForm);
    if (vErr) {
      setErr(vErr);
      return;
    }

    setSubmitting(true);
    try {
      const id = (loginForm.username || "").trim();
      const payload = id.includes("@")
        ? {
            email: id.toLowerCase().replace(/[,;]+$/g, ""),
            password: loginForm.password,
          }
        : { username: id, password: loginForm.password };

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");

      persistAuth(data, id);
      navigate("/dashboard");
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Local Signup ----------
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");

    const vErr = validateSignup(signupForm);
    if (vErr) {
      setErr(vErr);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signupForm.name.toLowerCase().replace(/\s+/g, ""),
          name: signupForm.name.trim(),
          email: signupForm.email.trim(),
          password: signupForm.password,
        }),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Signup failed");

      persistAuth(data, signupForm.email);
      navigate("/dashboard");
    } catch (e) {
      setErr(e.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Google Sign-In ----------
  const handleGoogleSignIn = () => {
    if (!codeClientRef.current) {
      setErr("Google Sign-In not initialized");
      return;
    }
    codeClientRef.current.requestCode();
  };

  // Google OAuth initialization
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

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
                console.error("[Google sign-in] error:", e);
                setErr(e.message || "Google sign-in failed");
              }
            },
          });
      } catch (e) {
        console.warn("[Google] initCodeClient failed:", e);
      }
    };

    (async () => {
      try {
        await ensureScript();
        initClients();
      } catch (e) {
        console.error("[Google] Script loading failed:", e);
      }
    })();
  }, [navigate]);

  // Scroll-triggered animations using Intersection Observer
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -100px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-in");
        }
      });
    }, observerOptions);

    const sections = document.querySelectorAll(
      ".about-section, .features-section, .how-it-works-section, .cta-section"
    );
    const cards = document.querySelectorAll(
      ".feature-card, .step-card, .stat-item"
    );

    sections.forEach((section) => observer.observe(section));
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  // Handle hash navigation on page load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    }
  }, []);

  // Reset forms & errors when switching between Sign in / Sign up on landing
  const switchToSignup = () => {
    setShowSignup(true);
    setErr("");
    setSignupForm({ name: "", email: "", password: "" });
  };

  const switchToLogin = () => {
    setShowSignup(false);
    setErr("");
    setLoginForm({ username: "", password: "" });
  };

  // ======= HEADER CTA MIRROR (no Header changes needed) =======
  const headerCtaStateRef = useRef({
    el: null,
    handler: null,
    observer: null,
  });

  // Find a reasonable header CTA candidate without editing Header.jsx
  const findHeaderCta = () => {
    // Priority: explicit data attribute if you added it; fallback to common selectors
    return (
      document.querySelector('[data-auth-cta]') ||
      document.querySelector('.header-nav .nav-link-primary') ||
      document.querySelector('a[href="/signin"], a[href="/login"]') ||
      null
    );
  };

  const labelForCurrentMode = () => (showSignup ? "Sign in" : "Sign up");

  const attachHeaderCta = () => {
    const st = headerCtaStateRef.current;

    // Clean up old listener if any
    if (st.el && st.handler) {
      try {
        st.el.removeEventListener("click", st.handler, true);
      } catch {}
    }

    st.el = null;
    st.handler = null;

    const el = findHeaderCta();
    if (!el) return;

    // If authed: show Dashboard and navigate there
    if (isAuthed) {
      try {
        el.textContent = "Dashboard";
        el.setAttribute("aria-label", "Dashboard");
        el.setAttribute("href", "/dashboard");
      } catch {}
      const goDash = (e) => {
        // ensure client-side route, no full reload
        e.preventDefault();
        e.stopPropagation();
        navigate("/dashboard");
      };
      el.addEventListener("click", goDash, true);
      st.el = el;
      st.handler = goDash;
      return;
    }

    // Not authed: mirror Sign in / Sign up toggle
    try {
      el.textContent = labelForCurrentMode();
      el.setAttribute("aria-label", labelForCurrentMode());
    } catch {}

    const handler = (e) => {
      // Prevent any nav the Header link might do
      e.preventDefault();
      e.stopPropagation();
      if (showSignup) {
        switchToLogin();
      } else {
        switchToSignup();
      }
      try {
        el.textContent = labelForCurrentMode();
        el.setAttribute("aria-label", labelForCurrentMode());
      } catch {}
    };

    el.addEventListener("click", handler, true);
    st.el = el;
    st.handler = handler;
  };

  // Re-attach whenever auth state or toggle mode changes
  useEffect(() => {
    attachHeaderCta();
  }, [isAuthed, showSignup, navigate]);

  // Observe DOM changes (Header re-renders) and re-attach if needed
  useEffect(() => {
    const st = headerCtaStateRef.current;

    const ensureAttached = () => {
      const current = st.el;
      const candidate = findHeaderCta();
      if (candidate && candidate !== current) {
        attachHeaderCta();
      } else if (!candidate && current) {
        attachHeaderCta();
      }
    };

    const obs = new MutationObserver(() => ensureAttached());
    obs.observe(document.body, { childList: true, subtree: true });
    st.observer = obs;

    // Initial attempt
    ensureAttached();

    return () => {
      try {
        obs.disconnect();
      } catch {}
      st.observer = null;
      if (st.el && st.handler) {
        try {
          st.el.removeEventListener("click", st.handler, true);
        } catch {}
      }
      st.el = null;
      st.handler = null;
    };
  }, []); // observe regardless of auth state

  // === ref to auth container so we can scroll to it ===
  const authContainerRef = useRef(null);

  // === CTA click -> toggle to Signup, then smooth-scroll & focus ===
  const handleCtaClick = () => {
    switchToSignup();
    setTimeout(() => {
      const target =
        authContainerRef.current ||
        document.querySelector(".auth-container") ||
        document.querySelector(".hero-section");
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      const firstInput =
        (authContainerRef.current &&
          authContainerRef.current.querySelector("#name")) ||
        document.querySelector("#name") ||
        document.querySelector("#signup-email");
      if (firstInput && typeof firstInput.focus === "function") {
        firstInput.focus();
      }
    }, 0);
  };

  return (
    <>
      <Header />
      {/* hidden h1 for proper heading hierarchy, no visual change */}
      <h1 className="sr-only">
        QuizCraft – AI-powered quiz generation platform
      </h1>

      <div className="landing-page">
        {/* Hero Section with Login */}
        <section className="hero-section">
          <div
            className="hero-container"
            style={
              isAuthed
                ? {
                    gridTemplateColumns: "1fr",
                    justifyItems: "center",
                  }
                : undefined
            }
          >
            {/* Left Side - Hero Content */}
            <div className="hero-content">
              <div className="hero-badge">AI-Powered Quiz Generation</div>
              <h2 className="hero-title">
                Transform Your Documents Into
                <span className="gradient-text"> Interactive Quizzes</span>
              </h2>
              <p className="hero-description">
                QuizCraft uses advanced AI to automatically generate
                high-quality multiple-choice questions, true/false questions,
                and fill-in-the-blanks from your PDFs and Word documents. Save
                hours of manual work and create engaging learning materials
                instantly.
              </p>
              <div className="hero-features">
                <div className="feature-item">
                  <div>
                    <h3>Multi-Format Support</h3>
                    <p>PDF &amp; Word Documents</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div>
                    <h3>Smart Generation</h3>
                    <p>Customize difficulty, focus &amp; format</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div>
                    <h3>Instant Results</h3>
                    <p>Generate quizzes in seconds</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login/Signup Form (hidden when authed) */}
            {!isAuthed && (
              <div className="auth-container" ref={authContainerRef}>
                <div className="auth-card">
                  <div className="auth-image-section">
                    <img
                      src={heroImage}
                      alt="QuizCraft Mascot"
                      className="sally-image"
                      loading="lazy"
                    />
                  </div>

                  {err && (
                    <div className="error-message" role="alert">
                      {err}
                    </div>
                  )}

                  {!showSignup ? (
                    <>
                      <h2 className="auth-title">Welcome Back</h2>
                      <p className="auth-subtitle">
                        Sign in to continue to QuizCraft
                      </p>

                      <form
                        className="auth-form"
                        onSubmit={handleLoginSubmit}
                        autoComplete="off"
                      >
                        {/* hidden decoys to swallow browser autofill */}
                        <input type="hidden" autoComplete="username" />
                        <input type="hidden" autoComplete="current-password" />

                        <div className="form-group">
                          <label htmlFor="email">Email or Username</label>
                          <input
                            type="text"
                            id="email"
                            placeholder="Enter your email or username"
                            value={loginForm.username}
                            onChange={(e) =>
                              setLoginForm({
                                ...loginForm,
                                username: e.target.value,
                              })
                            }
                            required
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            aria-describedby="email-help"
                          />
                          <small id="email-help" className="sr-only">
                            Enter your email address or username
                          </small>
                        </div>

                        <div className="form-group">
                          <label htmlFor="password">Password</label>
                          <div className="password-input-wrapper">
                            <input
                              type={showPw ? "text" : "password"}
                              id="password"
                              placeholder="Enter your password"
                              value={loginForm.password}
                              onChange={(e) =>
                                setLoginForm({
                                  ...loginForm,
                                  password: e.target.value,
                                })
                              }
                              required
                              autoComplete="off"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              aria-describedby="password-help"
                            />
                            <small id="password-help" className="sr-only">
                              Enter your password
                            </small>
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => setShowPw(!showPw)}
                              aria-label={
                                showPw ? "Hide password" : "Show password"
                              }
                            >
                              {showPw ? "👁️" : "👁️‍🗨️"}
                            </button>
                          </div>
                        </div>

                        <div className="form-options">
                          <label className="checkbox-label">
                            <input type="checkbox" id="remember" />
                            <span>Remember me</span>
                          </label>
                          <a href="/forgot-password" className="forgot-link">
                            Forgot password?
                          </a>
                        </div>

                        <button
                          type="submit"
                          className="auth-button primary"
                          disabled={submitting}
                        >
                          {submitting ? "Signing In..." : "Sign In"}
                        </button>
                      </form>

                      <div className="divider">
                        <span>OR</span>
                      </div>

                      <button
                        className="auth-button google"
                        onClick={handleGoogleSignIn}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          aria-hidden="true"
                        >
                          <path
                            fill="#4285F4"
                            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                          />
                          <path
                            fill="#34A853"
                            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55  0 9s.348 2.825.957 4.039l3.007-2.332z"
                          />
                          <path
                            fill="#EA4335"
                            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
                          />
                        </svg>
                        Continue with Google
                      </button>

                      <p className="auth-switch">
                        Don't have an account?{" "}
                        <button onClick={switchToSignup} className="switch-link">
                          Sign up
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="auth-title">Create Account</h2>
                      <p className="auth-subtitle">
                        Start creating quizzes in minutes
                      </p>

                      <form
                        className="auth-form"
                        onSubmit={handleSignupSubmit}
                        autoComplete="off"
                      >
                        {/* hidden decoys for autofill */}
                        <input type="hidden" autoComplete="email" />
                        <input type="hidden" autoComplete="username" />
                        <input type="hidden" autoComplete="new-password" />

                        <div className="form-group">
                          <label htmlFor="name">Full Name</label>
                          <input
                            type="text"
                            id="name"
                            placeholder="Enter your name"
                            value={signupForm.name}
                            onChange={(e) =>
                              setSignupForm({
                                ...signupForm,
                                name: e.target.value,
                              })
                            }
                            required
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            aria-describedby="name-help"
                          />
                          <small id="name-help" className="sr-only">
                            Enter your full name
                          </small>
                        </div>

                        <div className="form-group">
                          <label htmlFor="signup-email">Email Address</label>
                          <input
                            type="email"
                            id="signup-email"
                            placeholder="Enter your email"
                            value={signupForm.email}
                            onChange={(e) =>
                              setSignupForm({
                                ...signupForm,
                                email: e.target.value,
                              })
                            }
                            required
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            aria-describedby="email-help"
                          />
                          <small id="email-help" className="sr-only">
                            Enter a valid email address
                          </small>
                        </div>

                        <div className="form-group">
                          <label htmlFor="signup-password">Password</label>
                          <div className="password-input-wrapper">
                            <input
                              type={showPw ? "text" : "password"}
                              id="signup-password"
                              placeholder="Create a password"
                              value={signupForm.password}
                              onChange={(e) =>
                                setSignupForm({
                                  ...signupForm,
                                  password: e.target.value,
                                })
                              }
                              required
                              minLength={8}
                              autoComplete="off"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              aria-describedby="password-help"
                            />
                            <small id="password-help" className="sr-only">
                              Password must be at least 8 characters and contain
                              letters and numbers
                            </small>
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => setShowPw(!showPw)}
                              aria-label={
                                showPw ? "Hide password" : "Show password"
                              }
                            >
                              {showPw ? "👁️" : "👁️‍🗨️"}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="auth-button primary"
                          disabled={submitting}
                        >
                          {submitting ? "Creating Account..." : "Create Account"}
                        </button>
                      </form>

                      <div className="divider">
                        <span>OR</span>
                      </div>

                      <button
                        className="auth-button google"
                        onClick={handleGoogleSignIn}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          aria-hidden="true"
                        >
                          <path
                            fill="#4285F4"
                            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                          />
                          <path
                            fill="#34A853"
                            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55  0 9s.348 2.825.957 4.039l3.007-2.332z"
                          />
                          <path
                            fill="#EA4335"
                            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
                          />
                        </svg>
                        Continue with Google
                      </button>

                      <p className="auth-switch">
                        Already have an account?{" "}
                        <button onClick={switchToLogin} className="switch-link">
                          Sign in
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="about-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">About QuizCraft</h2>
              <p className="section-subtitle">
                Revolutionizing education through AI-powered quiz generation
              </p>
            </div>

            <div className="about-content">
              <div className="about-text">
                <h3>Our Mission</h3>
                <p>
                  QuizCraft was created to solve a common challenge faced by
                  educators, trainers, and learners: the time-consuming process
                  of creating high-quality assessment materials. Manual question
                  creation often leads to burnout, inconsistency, and reduced
                  focus on actual teaching and learning.
                </p>
                <p>
                  By leveraging cutting-edge AI technology, we've built a
                  solution that saves hours of work while ensuring quality and
                  consistency. Our platform handles both text-based and scanned
                  documents using advanced OCR, making it versatile for any
                  material.
                </p>

                <div className="stats-grid">
                  <div className="stat-card stat-item">
                    <div className="stat-number">10x</div>
                    <div className="stat-label">Faster Than Manual</div>
                  </div>
                  <div className="stat-card stat-item">
                    <div className="stat-number">100%</div>
                    <div className="stat-label">Accuracy Rate</div>
                  </div>
                </div>
              </div>

              <div className="team-showcase">
                <h3 className="team-title">Meet Our Team</h3>
                <div className="team-grid">
                  <div className="team-card">
                    <div className="team-avatar">
                      <img src={MaryJainImage} alt="Photo of Mary Jain Joshy" />
                    </div>
                    <h4 className="team-name">Mary Jain Joshy</h4>
                    <p className="team-role">Full-Stack &amp; Operations</p>
                    <p className="team-description">
                      Backend systems, frontend development, system integration,
                      and production deployment
                    </p>
                  </div>
                  <div className="team-card">
                    <div className="team-avatar">
                      <img src={GreeshmaImage} alt="Photo of Greeshma Prasad" />
                    </div>
                    <h4 className="team-name">Greeshma Prasad</h4>
                    <p className="team-role">Backend &amp; AI Developer</p>
                    <p className="team-description">
                      AI integration, backend systems, UI wireframes,
                      architecture design, and version control
                    </p>
                  </div>
                  <div className="team-card">
                    <div className="team-avatar">
                      <img src={AryaImage} alt="Photo of Arya Reghu" />
                    </div>
                    <h4 className="team-name">Arya Reghu</h4>
                    <p className="team-role">Authentication &amp; Testing</p>
                    <p className="team-description">
                      Product conceptualization, Google OAuth, database setup,
                      data flow handling, and presentations
                    </p>
                  </div>
                  <div className="team-card">
                    <div className="team-avatar">
                      <img src={BipinImage} alt="Photo of Bipin Kuinkel" />
                    </div>
                    <h4 className="team-name">Bipin Kuinkel</h4>
                    <p className="team-role">Front-End Developer</p>
                    <p className="team-description">
                      User interface design, frontend development, interactive
                      components, and documentation
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="features-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">Powerful Features</h2>
              <p className="section-subtitle">
                Everything you need to create professional quizzes
              </p>
            </div>

            <div className="features-grid">
              <div className="feature-card">
                <h3>AI-Powered Generation</h3>
                <p>
                  Advanced AI automatically generates contextually relevant
                  questions from your documents with high accuracy and
                  relevance.
                </p>
              </div>

              <div className="feature-card">
                <h3>Multiple Question Types</h3>
                <p>
                  Create MCQs, True/False questions, and Fill-in-the-Blanks. Mix
                  and match question types for comprehensive assessments.
                </p>
              </div>

              <div className="feature-card">
                <h3>Customizable Settings</h3>
                <p>
                  Control difficulty levels, focus areas, answer formats, and
                  exclude specific topics to tailor quizzes to your needs.
                </p>
              </div>

              <div className="feature-card">
                <h3>Page Tracking</h3>
                <p>
                  Every question shows which page it came from, making it easy
                  to reference source material and verify accuracy.
                </p>
              </div>

              <div className="feature-card">
                <h3>Interactive Editor</h3>
                <p>
                  Review and refine AI-generated questions with our intuitive
                  editor. Edit questions, options, and answers easily.
                </p>
              </div>

              <div className="feature-card">
                <h3>Export Options</h3>
                <p>
                  Export your quizzes as PDF or Word documents for printing or
                  integration with other learning platforms.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="how-section">
          <div className="section-container">
            <div className="section-header">
              <h2 className="section-title">How It Works</h2>
              <p className="section-subtitle">
                Create professional quizzes in just 3 simple steps
              </p>
            </div>

            <div className="steps-container">
              <div className="step-card">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Upload Your Documents</h3>
                  <p>
                    Upload PDFs or Word documents. Our system supports multiple
                    file formats and handles scanned documents with OCR.
                  </p>
                </div>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Customize Settings</h3>
                  <p>
                    Choose question types, difficulty level, focus area, and
                    number of questions. Optionally filter by page range or
                    keywords.
                  </p>
                </div>
              </div>

              <div className="step-arrow">→</div>

              <div className="step-card">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Generate &amp; Export</h3>
                  <p>
                    AI generates your quiz instantly. Review, edit if needed,
                    and export as PDF or Word document ready to use.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-container">
            <h2 className="cta-title">Experience Effortless Quiz Creation</h2>
            <p className="cta-description">
              Empower your classroom or training with instant, AI-generated
              quizzes. Start building smarter assessments today!
            </p>
            <button className="cta-button" onClick={handleCtaClick}>
              Try QuizCraft Now
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-section">
              <div className="footer-logo">
                <div className="logo-icon" aria-hidden="true">
                  Q
                </div>
                <span>QuizCraft</span>
              </div>
              <p className="footer-description">
                AI-powered quiz generation for modern educators
              </p>
            </div>

            <div className="footer-section">
              <h3>Product</h3>
              <a href="#features">Features</a>
              <a href="#about">About Us</a>
              <a href="#how-it-works">How It Works</a>
            </div>

            <div className="footer-section">
              <h4>Resources</h4>
              <a href="/documentation">Documentation</a>
              <a href="/support">Support</a>
              <a href="/faq">FAQ</a>
            </div>

            <div className="footer-section">
              <h4>Contact</h4>
              <a href="mailto:support@quizcraft.com">support@quizcraft.com</a>
              <Link to="/contact">Contact Us</Link>
              <div style={{ marginTop: "0.5rem" }}>
                <h5
                  style={{
                    color: "#fff",
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    fontSize: "1rem",
                    letterSpacing: "0.02em",
                  }}
                >
                  Follow Us
                </h5>
                <div
                  className="footer-socials"
                  style={{ display: "flex", gap: "0.75rem" }}
                >
                  <a
                    href="https://www.linkedin.com/company/quizcraft"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                  >
                    <FaLinkedin />
                  </a>
                  <a
                    href="https://github.com/quizcraft"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                  >
                    <FaGithub />
                  </a>
                  <a
                    href="mailto:support@quizcraft.com"
                    aria-label="Email"
                  >
                    <FaEnvelope />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2025 QuizCraft. All rights reserved.</p>
            <div className="footer-links">
              <a href="/privacy">Privacy Policy</a>
              <a href="/terms">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
