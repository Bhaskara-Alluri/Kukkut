// UI/auth.js
// Simple token utilities for storing and retrieving auth tokens.
// Use sessionStorage for ephemeral sessions; localStorage if "remember me".

export function getToken() {
  return (
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token") ||
    ""
  );
}

export function saveToken(token, remember) {
  if (remember) {
    localStorage.setItem("auth_token", token);
  } else {
    sessionStorage.setItem("auth_token", token);
  }
}

export function clearToken() {
  localStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_token");
}

export function requireAuth(redirect = "./login.html") {
  // Redirect to login if no token is present
  const t = getToken();
  if (!t) {
    window.location.replace(redirect);
    return false;
  }
  return true;
}

export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
