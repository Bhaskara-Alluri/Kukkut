// UI/login.js
// Handles login form submission, calls the backend `/auth/login`,
// stores the token, and redirects to the dashboard.
import { saveToken } from "./auth.js";

// Base URL for the API (configured in config.js, fallback to localhost)
const API = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

console.log("login.js loaded, API =", API);

// Wait for DOM content before attaching handlers
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded on login page");

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const msg = document.getElementById("msg");
  const togglePw = document.getElementById("togglePw");

  if (!form) {
    console.error("loginForm not found");
    return;
  }

  // Show/Hide password toggle
  if (togglePw && passwordInput) {
    togglePw.addEventListener("click", () => {
      const isPw = passwordInput.type === "password";
      passwordInput.type = isPw ? "text" : "password";
      togglePw.textContent = isPw ? "Hide" : "Show";
    });
  }

  // Submit login form to API
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "Signing in...";
    console.log("Login form submitted");

    const payload = {
      // ⚠️ If your FastAPI model is LoginRequest(email, password),
      // change `username:` below to `email:`
      username: usernameInput.value.trim(),
      password: passwordInput.value,
    };

    console.log("Sending payload:", payload);

    try {
      const resp = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));
      console.log("Login response:", resp.status, data);

      if (!resp.ok) {
        msg.textContent = data.detail || "Sign-in failed";
        return;
      }

      const token = data.access_token || data.token; // future-proofing
      if (!token) {
        msg.textContent = "Login successful but no token returned";
        return;
      }

      // For now: always use sessionStorage (no "remember me" checkbox yet)
      saveToken(token, false);

      // Persist user name info for welcome message
      try {
        if (data.user) {
          sessionStorage.setItem("user_firstname", data.user.firstname || "");
          sessionStorage.setItem("user_lastname", data.user.lastname || "");
          sessionStorage.setItem("user_username", data.user.username || "");
        }
      } catch (e) {
        console.warn("Could not persist user name info", e);
      }
      msg.textContent = "Success! Redirecting...";
      // Dashboard lives under /ui/
      window.location.href = "/ui/index.html";
    } catch (err) {
      console.error("Login error:", err);
      msg.textContent = "Network or server error";
    }
  });
});
