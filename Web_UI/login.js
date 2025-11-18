// Web_UI/login.js
const API = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);

function wireUp() {
  const form = $("#loginForm");
  const user = $("#username");
  const pw = $("#password");
  const toggle = $("#togglePw");

  if (!form || !user || !pw) {
    console.error("Login wiring: missing elements", { form: !!form, user: !!user, pw: !!pw });
    return;
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      pw.type = (pw.type === "password") ? "text" : "password";
      toggle.textContent = (pw.type === "password") ? "Show" : "Hide";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg(""); // clear

    const username = user.value.trim();
    const password = pw.value;

    if (!username || !password) {
      return showMsg("Enter user id and password.", true);
    }

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data?.token) throw new Error("Missing token in response");

      sessionStorage.setItem("auth_token", data.token);
      showMsg("Signed in.");
      setTimeout(() => { window.location.href = "./index.html"; }, 300);
    } catch (err) {
      console.error("Login error:", err);
      showMsg(`Sign-in failed: ${err.message}`, true);
    }
  });
}

function showMsg(text, isErr = false) {
  const m = $("#msg");
  if (!m) return;
  m.textContent = text || "";
  m.className = "msg" + (isErr ? " err" : " ok");
}

// Bind ASAP even if DOM is already ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUp);
} else {
  wireUp();
}

console.log("login.js loaded; API =", API);
