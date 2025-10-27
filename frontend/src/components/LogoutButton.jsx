// src/components/LogoutButton.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../utils/auth";

export default function LogoutButton({ className = "", children = "Logout", confirm = false }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onLogout = () => {
    if (busy) return;
    if (confirm && !window.confirm("Are you sure you want to log out?")) return;

    setBusy(true);
    try {
      clearAuth();                               // clears storage + emits auth-changed
      navigate("/login", { replace: true });     // soft redirect

      // Hard fallback in case any stale state prevents route change
      setTimeout(() => {
        const stillHasToken =
          sessionStorage.getItem("qc_token") || localStorage.getItem("qc_token");
        if (!stillHasToken) window.location.replace("/login");
      }, 0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      onClick={onLogout}
      disabled={busy}
      aria-label="Log out"
    >
      {busy ? "Logging out..." : children}
    </button>
  );
}
