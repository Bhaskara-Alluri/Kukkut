// auth.js

// Read token (from localStorage or sessionStorage)
export function getToken() {
  const t =
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token") ||
    "";
  console.log("[auth.js] getToken ->", t);  // debug log
  return t;
}

// Save token (if remember = true -> localStorage, else sessionStorage)
export function saveToken(token, remember = true) {
  console.log("[auth.js] saveToken", token, "remember =", remember);
  if (!token) return;
  (remember ? localStorage : sessionStorage).setItem("auth_token", token);
}

// Clear token from both
export function clearToken() {
  console.log("[auth.js] clearToken");
  localStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_token");
}

// Build Authorization header (used in dashboard.js postJSON)
export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Protect pages that require login
export function requireAuth(redirect = "./login.html") {
  const t = getToken();
  console.log("[auth.js] requireAuth token =", t);
  if (!t) {
    console.log("[auth.js] No token, redirecting to", redirect);
    if (redirect) window.location.replace(redirect);
    return false;
  }
    console.log("[auth.js] Auth OK");
  return true;
}
