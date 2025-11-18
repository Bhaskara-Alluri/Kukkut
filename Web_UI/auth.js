// Simple auth storage (prefer localStorage if "remember me" was checked)
export function getToken() {
  return localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || "";
}
export function saveToken(token, remember) {
  (remember ? localStorage : sessionStorage).setItem("auth_token", token);
}
export function clearToken() {
  localStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_token");
}

export function requireAuth(redirect = "./login.html") {
  const t = getToken();
  if (!t) window.location.replace(redirect);
  return !!t;
}

export function authHeader() {
  const t = getToken();
  return t ? { "Authorization": `Bearer ${t}` } : {};
}
