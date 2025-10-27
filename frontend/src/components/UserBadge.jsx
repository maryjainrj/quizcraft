// src/components/UserBadge.jsx
import React, { useEffect, useState } from "react";
import { getUser, onAuthChange } from "../utils/auth";

export default function UserBadge({ className = "" }) {
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    const unsub = onAuthChange(() => setUser(getUser()));
    return unsub;
  }, []);

  const name = user?.name?.trim() || user?.username?.trim() || "Guest";

  return (
    <div className={className} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {user?.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={name}
          style={{ width: 32, height: 32, borderRadius: "50%" }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#eee",
            fontWeight: 600,
          }}
          aria-hidden
        >
          {(name[0] || "G").toUpperCase()}
        </div>
      )}
      <span title={name}>{name}</span>
    </div>
  );
}
