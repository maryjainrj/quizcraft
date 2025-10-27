// src/utils/auth.js
// Session-first auth helpers + change notifications so UI (guards, profile, logout) re-render.

const TOKEN_KEY = "qc_token";
const USER_KEY  = "qc_user";
const AUTH_EVENT = "qc_auth_changed";

/** Safely emit a cross-app auth change event (login/logout). */
function emitAuthChanged() {
  try {
    if (typeof window === "undefined") return;

    const evtName = AUTH_EVENT;
    let evt;

    if (typeof window.CustomEvent === "function") {
      evt = new CustomEvent(evtName);
    } else {
      // Older browsers
      evt = document.createEvent("CustomEvent");
      evt.initCustomEvent(evtName, false, false, undefined);
    }

    window.dispatchEvent(evt);
  }
  catch (err) {
    // Mark as intentionally unused to satisfy strict linters
    void err;
  }
}

/**
 * Save auth. By default it's session-only (and clears the other store).
 * Nothing here stores plaintext credentials—only token + user object.
 */
export const setAuth = (token, user, { sessionOnly = true } = {}) => {
  const userJson = JSON.stringify(user || null);

  if (sessionOnly) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, userJson);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, userJson);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  emitAuthChanged();
};

/** Read token (prefers sessionStorage, falls back to localStorage). */
export const getToken = () =>
  sessionStorage.getItem(TOKEN_KEY) ||
  localStorage.getItem(TOKEN_KEY) ||
  null;

/** Read user (prefers sessionStorage, falls back to localStorage). */
export const getUser = () => {
  const raw =
    sessionStorage.getItem(USER_KEY) ||
    localStorage.getItem(USER_KEY) ||
    "null";
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Clear auth from both stores and notify listeners. */
export const clearAuth = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChanged();
};

/**
 * Subscribe to auth changes (login/logout). Returns an unsubscribe function.
 * Components like PrivateRoute and UserBadge should call this to re-render.
 */
export const onAuthChange = (cb) => {
  const handler = () => cb?.();
  window.addEventListener(AUTH_EVENT, handler);

  // React to cross-tab changes via the storage event
  const storageHandler = (e) => {
    if (e.key === TOKEN_KEY || e.key === USER_KEY) cb?.();
  };
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(AUTH_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
};

// (Optional) export keys/event name if needed elsewhere
export const __AUTH_KEYS__ = { TOKEN_KEY, USER_KEY, AUTH_EVENT };
