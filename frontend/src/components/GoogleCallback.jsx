import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const GoogleCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (!code) {
      alert("No Google code found in URL.");
      navigate("/login");
      return;
    }
    // Exchange code for token
    fetch(`${API_BASE}/api/auth/google/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Google sign-in failed");
        // Save token and user info
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/dashboard");
      })
      .catch((err) => {
        alert(err.message || "Google sign-in failed");
        navigate("/login");
      });
  }, [navigate]);

  return <div>Signing you in with Google...</div>;
};

export default GoogleCallback;
