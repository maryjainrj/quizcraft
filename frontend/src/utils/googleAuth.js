// src/utils/googleAuth.js
let initialized = false;

export function initGoogle(onCredential) {
  if (initialized) return;
  if (!window.google?.accounts?.id) return; // script not loaded yet

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.warn("[googleAuth] Missing VITE_GOOGLE_CLIENT_ID");
    return;
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      // response.credential = JWT from Google
      if (typeof onCredential === "function" && response?.credential) {
        onCredential(response.credential);
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    // you can set "ux_mode: 'popup'" if you prefer
  });

  initialized = true;
}

export function promptGoogle() {
  if (!window.google?.accounts?.id) return;
  window.google.accounts.id.prompt(); // shows chooser / one-tap if available
}

/** Optional: render a Google-branded button if you want a visible button */
export function renderGoogleButton(container) {
  if (!window.google?.accounts?.id || !container) return;
  window.google.accounts.id.renderButton(container, {
    type: "standard",
    shape: "rectangular",
    theme: "outline",
    text: "signin_with",
    size: "large",
    logo_alignment: "left",
    width: 240,
  });
}
