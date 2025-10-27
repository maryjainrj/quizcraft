// src/components/PrivateRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getToken, onAuthChange } from "../utils/auth";

export default function PrivateRoute() {
  const [hasToken, setHasToken] = useState(!!getToken());

  useEffect(() => {
    const unsub = onAuthChange(() => setHasToken(!!getToken()));
    return unsub;
  }, []);

  return hasToken ? <Outlet /> : <Navigate to="/login" replace />;
}
