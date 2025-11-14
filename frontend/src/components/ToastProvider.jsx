import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((msg, opts = {}) => {
    const id = ++idRef.current;
    const toast = {
      id,
      type: opts.type || "info", // "success" | "error" | "warning" | "info"
      message: msg,
      duration: opts.duration ?? 4000,
    };
    setToasts((t) => [...t, toast]);
    if (toast.duration > 0) {
      setTimeout(() => remove(id), toast.duration);
    }
    return id;
  }, [remove]);

  const api = useMemo(() => ({
    push,
    success: (m, o) => push(m, { ...o, type: "success" }),
    error: (m, o) => push(m, { ...o, type: "error", duration: o?.duration ?? 6000 }),
    warning: (m, o) => push(m, { ...o, type: "warning" }),
    info: (m, o) => push(m, { ...o, type: "info" }),
    remove,
  }), [push, remove]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-container" role="region" aria-label="Notifications">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast--${t.type}`} role="status">
              <div className="toast__msg">{t.message}</div>
              <button className="toast__close" aria-label="Dismiss" onClick={() => remove(t.id)}>×</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
