// login.js

import { saveToken } from "./auth.js";

// Use BASE_API_URL from config.js if available, otherwise default
const API_BASE = typeof BASE_API_URL !== "undefined"
  ? BASE_API_URL
  : "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
  console.log("login.js loaded");

  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const msgEl = document.getElementById("msg");
  const togglePwBtn = document.getElementById("togglePw");

  if (!form) {
    console.error("loginForm not found");
    return;
  }

  // Toggle password visibility
  if (togglePwBtn && passwordInput) {
    togglePwBtn.addEventListener("click", () => {
      const isPw = passwordInput.type === "password";
      passwordInput.type = isPw ? "text" : "password";
      togglePwBtn.textContent = isPw ? "Hide" : "Show";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "";
    msgEl.classList.remove("error", "success");

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      msgEl.textContent = "Please enter username and password.";
      msgEl.classList.add("error");
      return;
    }

    const url = `${API_BASE}/auth/login`;   // ✅ correct endpoint
    console.log("Calling login API:", url);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }), // must match FastAPI model
      });

      console.log("Status:", resp.status);
      const data = await resp.json().catch(() => ({}));
      console.log("Response JSON:", data);

      if (!resp.ok) {
        const detail = data.detail || "Sign-in failed.";
        msgEl.textContent = `Sign-in failed: ${detail}`;
        msgEl.classList.add("error");
        return;
      }

      if (!data.access_token) {
        console.error("Login response missing access_token:", data);
        msgEl.textContent = "Sign-in failed: Missing token in response";
        msgEl.classList.add("error");
        return;
      }

      // Store token & user
      //localStorage.setItem("auth_Token", data.access_token);
	  
	  saveToken(data.access_token, true); 
	  
      if (data.user) {
        localStorage.setItem("authUser", JSON.stringify(data.user));
      }

      msgEl.textContent = data.message || "Login successful!";
      msgEl.classList.add("success");

      // Redirect to main page on 127.0.0.1:5500
      window.location.href = "/index.html";

    } catch (err) {
      console.error("Network error:", err);
      msgEl.textContent = "Sign-in failed: " + err.message;
      msgEl.classList.add("error");
    }
  });
});
