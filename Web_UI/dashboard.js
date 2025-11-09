import { requireAuth, authHeader, clearToken } from "./auth.js";
const API = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);

function adminForm() {
  return `
    <h2 id="content-title">Admin registration</h2>
    <form id="adminForm">
      <div class="row">
        <label>Full name<input id="a_name" required /></label>
        <label>Email<input id="a_email" type="email" required /></label>
      </div>
      <div class="row">
        <label>Phone<input id="a_phone" required /></label>
        <label>Organization<input id="a_org" /></label>
      </div>
      <button class="primary" type="submit">Register admin</button>
      <p id="adminMsg" class="meta"></p>
    </form>
  `;
}

function farmerForm() {
  return `
    <h2 id="content-title">Farmer Registration</h2>
    <form id="farmerForm" class="form-vertical">

      <!-- Personal Details -->
      <section class="section card">
        <h3 class="section-title">Personal Details</h3>
        <label>First Name
          <input id="f_fname" required />
        </label>
        <label>Middle Name
          <input id="f_mname" />
        </label>
        <label>Surname
          <input id="f_surname" required />
        </label>
        <label>Gender
          <select id="f_gender" required>
            <option value="" selected disabled>Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Non-binary</option>
            <option>Prefer not to say</option>
          </select>
        </label>
      </section>

      <!-- Address -->
      <section class="section card">
        <h3 class="section-title">Address</h3>
        <label>Street Name
          <input id="f_street" required />
        </label>
        <label>City/Town/Village
          <input id="f_city" required />
        </label>
        <label>State
          <input id="f_state" required />
        </label>
        <label>Zipcode
          <input id="f_zip" required pattern="\\d{5}" title="Enter 5-digit ZIP" />
        </label>
      </section>

      <!-- Contacts -->
      <section class="section card">
        <h3 class="section-title">Contacts</h3>
        <label>Phone
          <input id="f_phone" required />
        </label>
        <label>eMail
          <input id="f_email" type="email" required />
        </label>
      </section>

      <button class="primary" type="submit">Register Farmer</button>
      <p id="farmerMsg" class="meta"></p>
    </form>
  `;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function mountAdmin() {
  $("#content-area").innerHTML = adminForm();
  $("#adminForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#adminMsg");
    msg.textContent = "Submitting...";
    try {
      const payload = {
        name: $("#a_name").value.trim(),
        email: $("#a_email").value.trim(),
        phone: $("#a_phone").value.trim(),
        organization: $("#a_org").value.trim(),
      };
      const data = await postJSON(`${API}/admin/register`, payload);
      msg.textContent = `✔ Registered admin #${data.id}`;
    } catch (err) {
      msg.textContent = `✖ ${err.message}`;
    }
  });
}

function mountFarmer() {
  $("#content-area").innerHTML = farmerForm();
  $("#farmerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#farmerMsg");
    msg.textContent = "Submitting...";
    try {
      const payload = {
        name: $("#f_name").value.trim(),
        phone: $("#f_phone").value.trim(),
        location: $("#f_location").value.trim(),
        land_size_acres: parseFloat($("#f_land").value || "0") || 0,
      };
      const data = await postJSON(`${API}/farmer/register`, payload);
      msg.textContent = `✔ Registered farmer #${data.id}`;
    } catch (err) {
      msg.textContent = `✖ ${err.message}`;
    }
  });
}

function routeTo(view) {
  if (view === "admin") return mountAdmin();
  if (view === "farmer") return mountFarmer();
  $("#content-title").textContent = "Home";
  $("#content-area").innerHTML = `<p class="meta">Select an option from the menu.</p>`;
}

window.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth("./login.html")) return;

  $("#logoutBtn").addEventListener("click", () => {
    clearToken();
    window.location.replace("./login.html");
  });

  // load initial
  const initial = (location.hash.replace("#/","") || "");
  routeTo(initial);

  // react to sidebar nav
  window.addEventListener("route:change", (e) => {
    routeTo(e.detail.view);
  });
});
