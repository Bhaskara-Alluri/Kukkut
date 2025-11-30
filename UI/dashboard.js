// UI/dashboard.js
// Guards the page with auth, provides simple client-side routing (admin/farmer),
// and demonstrates POSTing JSON to the backend with bearer auth.
import { requireAuth, authHeader, clearToken, saveToken } from "./auth.js";
const API = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const $ = (s) => document.querySelector(s);


// Render farmer registration form (sample fields)
function farmerForm() {
  // Indian States & Union Territories mapped to codes
  const IN_STATES = [
    { code: "AP", name: "Andhra Pradesh" },{ code: "AR", name: "Arunachal Pradesh" },{ code: "AS", name: "Assam" },{ code: "BR", name: "Bihar" },{ code: "CT", name: "Chhattisgarh" },{ code: "GA", name: "Goa" },{ code: "GJ", name: "Gujarat" },{ code: "HR", name: "Haryana" },{ code: "HP", name: "Himachal Pradesh" },{ code: "JH", name: "Jharkhand" },{ code: "KA", name: "Karnataka" },{ code: "KL", name: "Kerala" },{ code: "MP", name: "Madhya Pradesh" },{ code: "MH", name: "Maharashtra" },{ code: "MN", name: "Manipur" },{ code: "ML", name: "Meghalaya" },{ code: "MZ", name: "Mizoram" },{ code: "NL", name: "Nagaland" },{ code: "OR", name: "Odisha" },{ code: "PB", name: "Punjab" },{ code: "RJ", name: "Rajasthan" },{ code: "SK", name: "Sikkim" },{ code: "TN", name: "Tamil Nadu" },{ code: "TG", name: "Telangana" },{ code: "TR", name: "Tripura" },{ code: "UP", name: "Uttar Pradesh" },{ code: "UT", name: "Uttarakhand" },{ code: "WB", name: "West Bengal" },{ code: "AN", name: "Andaman and Nicobar Islands" },{ code: "CH", name: "Chandigarh" },{ code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu" },{ code: "DL", name: "Delhi" },{ code: "JK", name: "Jammu and Kashmir" },{ code: "LA", name: "Ladakh" },{ code: "LD", name: "Lakshadweep" },{ code: "PY", name: "Puducherry" }
  ];
  const stateOptions = IN_STATES.map(s => `<option value="${s.code}">${s.name}</option>`).join("\n");
  return `
    <form id="farmerForm" class="form-vertical">

      <!-- Personal Details -->
      <section class="section card stack">
        <h3 class="section-title">Personal Details</h3>
        <label>First Name
          <input id="f_fname" required maxlength="25" pattern="^[A-Za-z]{1,25}$" title="Letters only" />
        </label>
        <label>Middle Name
          <input id="f_mname" maxlength="25" pattern="^[A-Za-z]{0,25}$" title="Letters only" />
        </label>
        <label>Last Name
          <input id="f_lastname" required maxlength="25" pattern="^[A-Za-z]{1,25}$" title="Letters only" />
        </label>
        <label>Gender
          <select id="f_gender" required>
            <option value="" selected disabled>Select</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </label>
      </section>

      <!-- Address -->
      <section class="section card stack">
        <h3 class="section-title">Address</h3>
        <label>Street Name
          <input id="f_street" required maxlength="100" pattern="^[A-Za-z ,/\-]{1,100}$" title="Letters, spaces, comma (,), slash (/), hyphen (-) only" />
        </label>
        <label>City/Town/Village
          <div class="city-field">
            <select id="f_city" required disabled>
              <option value="" disabled selected>Enter PIN first</option>
            </select>
            <button type="button" id="cityOverrideBtn" class="mini-btn" title="Manual entry">Manual</button>
          </div>
        </label>
        <label>State
          <select id="f_state" required disabled>
            <option value="" disabled selected>Select State / UT</option>
            ${stateOptions}
          </select>
        </label>
        <label>Zipcode
          <input id="f_zip" required pattern="\\d{6}" inputmode="numeric" maxlength="6" title="Enter 6-digit PIN" />
        </label>
        <p id="pinMsg" class="meta"></p>
      </section>

      <!-- Contacts -->
      <section class="section card stack">
        <h3 class="section-title">Contacts</h3>
        <fieldset class="phone-fieldset">
          <legend>Phone</legend>
          <div class="phone-row">
            <label class="cc-label">Country
              <select id="f_phone_cc" required>
                <option value="91" selected>+91 (IN)</option>
                <option value="1">+1 (US)</option>
                <option value="44">+44 (UK)</option>
                <option value="61">+61 (AU)</option>
                <option value="81">+81 (JP)</option>
              </select>
            </label>
            <label class="num-label">Number
              <input id="f_phone_num" required pattern="\\d{10}" inputmode="numeric" maxlength="10" title="Enter 10 digit number" />
            </label>
          </div>
        </fieldset>
        <label>eMail
          <input id="f_email" type="email" required pattern="^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$" title="Enter a valid email (name@domain.tld)" />
          <span class="email-hint" id="f_email_msg"></span>
        </label>
      </section>

      <div class="form-actions" style="display:flex; gap:10px; align-items:center;">
        <button class="primary" type="submit">Register</button>
        <button id="cancelBtn" type="button" class="btn" style="padding:10px 14px; border:1px solid #ccc; border-radius:10px; background:#fff; cursor:pointer;">Cancel</button>
      </div>
      <p id="farmerMsg" class="meta"></p>
    </form>
  `;
}

// Helper: POST JSON with bearer auth and auto-refresh on 401
async function postJSON(url, body) {
  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
    credentials: "include", // include cookies for refresh flow
  });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
        credentials: "include",
      });
    }
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// Attempt to refresh access token using HttpOnly refresh cookie
async function tryRefresh() {
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    const token = data.access_token;
    if (!token) return false;
    // store new token in sessionStorage
    saveToken(token, false);
    return true;
  } catch {
    return false;
  }
}


// Attach farmer form handlers and submit to API
function mountFarmer() {
  $("#content-title").textContent = "Farmer Registration";
  $("#content-area").innerHTML = farmerForm();
  setupEmailValidation("#f_email", "#f_email_msg");
  setupStreetValidation();
  setupNameValidation();
  // PIN auto-fill: listen for 6-digit PIN and fetch postal info
  const pinInput = document.getElementById("f_zip");
  let cityEl = document.getElementById("f_city");
  const stateSelect = document.getElementById("f_state");
  const pinMsg = document.getElementById("pinMsg");
  const cityOverrideBtn = document.getElementById("cityOverrideBtn");
  
  cityOverrideBtn.addEventListener("click", () => {
    // Replace select with input for manual override if not already an input
    cityEl = document.getElementById("f_city");
    if (cityEl && cityEl.tagName.toLowerCase() === "select") {
      const parent = cityEl.parentElement;
      const manual = document.createElement("input");
      manual.id = "f_city";
      manual.required = true;
      manual.maxLength = 50;
      manual.placeholder = "Enter city/town/village";
      parent.replaceChild(manual, cityEl);
      cityEl = manual;
    }
  });

  // Trigger PIN lookup when 6 digits entered
  pinInput.addEventListener("input", () => {
    const pin = pinInput.value.trim();
    if (/^\d{6}$/.test(pin)) {
      fetchPinInfo(pin);
    }
  });
  async function fetchPinInfo(pin) {
    pinMsg.textContent = "Looking up PIN...";
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data[0] || data[0].Status !== "Success") {
        pinMsg.textContent = "PIN not found";
        return;
      }
      const offices = data[0].PostOffice || [];
      if (offices.length === 0) {
        pinMsg.textContent = "No post offices";
        return;
      }
      const office = offices[0];
      // Populate city dropdown with all available offices (Block or Name)
      // Only populate if still a select (not manually overridden)
      cityEl = document.getElementById("f_city");
      if (cityEl.tagName.toLowerCase() === "select") {
        cityEl.innerHTML = ""; // clear
        offices.forEach(o => {
          const opt = document.createElement("option");
          opt.value = (o.Block || o.Name || "");
          opt.textContent = (o.Block || o.Name || "");
          cityEl.appendChild(opt);
        });
        cityEl.disabled = false;
      }
      const apiState = office.State;
      // Attempt to match option text to state name
      [...stateSelect.options].forEach(o => {
        if (o.textContent.toLowerCase() === apiState.toLowerCase()) {
          stateSelect.value = o.value;
        }
      });
      stateSelect.disabled = false;
      pinMsg.textContent = `Matched state: ${apiState}`;
    } catch (err) {
      pinMsg.textContent = "PIN lookup error";
      console.error("PIN lookup failed", err);
    }
  }
  $("#farmerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#farmerMsg");
    msg.textContent = "Submitting...";
    try {
      const emailInput = $("#f_email");
      if (!emailInput.checkValidity()) {
        msg.textContent = "✖ Invalid email format";
        emailInput.focus();
        return;
      }
      const payload = {
        first_name: $("#f_fname").value.trim(),
        middle_name: $("#f_mname").value.trim(),
        last_name: $("#f_lastname").value.trim(),
        gender: $("#f_gender").value,
        street: $("#f_street").value.trim(),
        city: $("#f_city").value.trim(),
        state_code: $("#f_state").value,
        pin: $("#f_zip").value.trim(),
        phone: `+${$("#f_phone_cc").value}${$("#f_phone_num").value.trim()}`,
        email: $("#f_email").value.trim()
      };
      const data = await postJSON(`${API}/farmer/register`, payload);
      msg.textContent = `✔ Registered farmer #${data.id}`;
    } catch (err) {
      msg.textContent = `✖ ${err.message}`;
    }
  });

  // Cancel: go to farmers list page
  const cancel = document.getElementById("cancelBtn");
  if (cancel) {
    cancel.addEventListener("click", () => {
      window.location.href = "./index.html#/farmers";
    });
  }
}

// Live email validation and character filtering
function setupEmailValidation(inputSel, msgSel) {
  const el = $(inputSel);
  const msg = $(msgSel);
  if (!el || !msg) return;
  const allowed = /[A-Za-z0-9@._%+-]/;
  el.addEventListener("beforeinput", (e) => {
    if (e.data && !allowed.test(e.data)) {
      e.preventDefault();
    }
  });
  el.addEventListener("input", () => {
    const v = el.value.trim();
    if (!v) {
      msg.textContent = "";
      el.classList.remove("invalid");
      return;
    }
    const basic = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (basic.test(v)) {
      msg.textContent = "✔ Valid email";
      msg.className = "email-hint ok";
      el.classList.remove("invalid");
    } else {
      msg.textContent = "✖ Invalid email";
      msg.className = "email-hint err";
      el.classList.add("invalid");
    }
  });
}

// Street live validation (letters + space + , / - only, max 100)
function setupStreetValidation() {
  const el = document.getElementById("f_street");
  if (!el) return;
  const allowed = /[A-Za-z ,/\-]/;
  el.addEventListener("beforeinput", (e) => {
    if (e.data && !allowed.test(e.data)) e.preventDefault();
  });
  el.addEventListener("input", () => {
    const v = el.value;
    if (v.length > 100) el.value = v.slice(0,100);
    if (!/^[A-Za-z ,/\-]*$/.test(el.value)) {
      el.classList.add("invalid");
    } else {
      el.classList.remove("invalid");
    }
  });
}

// Restrict name fields to letters only
function setupNameValidation() {
  const ids = ["f_fname","f_mname","f_lastname"]; const letter=/[A-Za-z]/;
  ids.forEach(id => {
    const el = document.getElementById(id); if(!el) return;
    el.addEventListener("beforeinput", e=>{ if(e.data && !letter.test(e.data)) e.preventDefault();});
    el.addEventListener("input", ()=>{ el.value = el.value.replace(/[^A-Za-z]/g,""); });
  });
}

// Simple view router (admin/farmer/home)
function routeTo(view) {
  if (view === "farmer") return mountFarmer();
  if (view === "farmers") return mountFarmersList();
  if (view === "farms") return mountFarmsList();
  if (view === "sheds") return mountShedsPage();
  if (view === "users") return mountUsersList();
  // HOME view
  $("#content-title").textContent = "Home";
  $("#content-area").innerHTML = `
    <div id="homeContent">
      <p id="welcomeLine" class="meta welcome-line"></p>
      <p id="menuLine" class="meta">Select an option from the Menu</p>
    </div>`;
  setWelcomeMessage();
}

function setWelcomeMessage() {
  const wl = document.getElementById("welcomeLine");
  if (!wl) return;
  // Ensure style class present even if static HTML differed
  wl.classList.add("welcome-line");
  // Prefer stored first/last name
  const first = sessionStorage.getItem("user_firstname") || "";
  const last = sessionStorage.getItem("user_lastname") || "";
  const username = sessionStorage.getItem("user_username") || "";
  let line = "";
  if (first || last) {
    line = `Welcome ${first}${last ? " " + last : ""}`.trim();
  } else if (username) {
    line = `Welcome ${username}`;
  } else {
    line = "Welcome";
  }
  wl.textContent = line;
  // If first/last absent, attempt backend fetch for freshest profile
  if (!(first || last)) {
    const API_BASE = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    fetch(`${API_BASE}/auth/me`, { headers: { ...authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const f = data.firstname || "";
        const l = data.lastname || "";
        if (f || l) {
          sessionStorage.setItem("user_firstname", f);
          sessionStorage.setItem("user_lastname", l);
          if (data.username) sessionStorage.setItem("user_username", data.username);
          wl.textContent = `Welcome ${f}${l ? " " + l : ""}`.trim();
        }
      }).catch(()=>{});
  }
}

// Protect page and wire up navigation + logout
window.addEventListener("DOMContentLoaded", () => {
  if (!requireAuth("./login.html")) return;

  $("#logoutBtn").addEventListener("click", () => {
    // call backend to clear refresh cookie, then clear client token
    fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" })
      .finally(() => {
        clearToken();
        window.location.replace("./login.html");
      });
  });

  // Load initial view from URL hash
  const initial = (location.hash.replace("#/","") || "");
  routeTo(initial);
  // If home content already rendered via static HTML (index.html load without hash)
  setWelcomeMessage();

  // React to sidebar nav custom events
  window.addEventListener("route:change", (e) => {
    routeTo(e.detail.view);
  });

  // Handle hash-based navigation from sidebar links
  window.addEventListener("hashchange", () => {
    const view = (location.hash.replace("#/", "") || "");
    routeTo(view);
  });
});

  // --- Users LIST (SPA) ---
  async function mountUsersList() {
    const area = document.getElementById("content-area");
    document.getElementById("content-title").textContent = "Users";
    area.innerHTML = `
      <div id="users-app">
        <div class="users-search">
          <input id="usersSearchInput" type="text" placeholder="Search username / name / email / phone / city / state / PIN" />
        </div>
        <div id="usersTableWrap">
          <table class="farmers-table" id="usersTable">
            <thead><tr>
              <th>ID</th><th>Username</th><th>Name</th><th>Email</th><th>Phone</th><th>Street</th><th>City</th><th>State</th><th>PIN</th><th>Created</th><th>Updated</th>
            </tr></thead>
            <tbody id="usersTbody"><tr><td colspan="11">Loading...</td></tr></tbody>
          </table>
        </div>
        <div class="list-footer">
          <div class="page-size" id="usersPageSizeBox">
            <label class="ps-label">Rows:
              <select id="usersPageSizeSelect">
                <option value="10" selected>10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
          <div class="pagination" id="usersPager">
            <button id="usersPrevBtn" disabled>Prev</button>
            <span id="usersPageInfo">Page 1</span>
            <button id="usersNextBtn" disabled>Next</button>
            <span id="usersTotalInfo"></span>
          </div>
        </div>
      </div>`;

    const API = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    let state = { page: 1, pageSize: 10, search: "" };
    const $ = (s)=>document.querySelector(s);

    async function fetchUsers(page=1, pageSize=10, search="") {
      const q = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`${API}/users?${q}`, { headers: { ...authHeader() } });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    }
    function fmtDate(d){ try{return new Date(d).toLocaleString();}catch{return d;} }
    function renderRows(items){
      const tbody = $("#usersTbody");
      if (!items.length) { tbody.innerHTML = '<tr><td colspan="11">No results</td></tr>'; return; }
      tbody.innerHTML = items.map(u=>{
        const nm = [u.firstname, u.lastname].filter(Boolean).join(' ');
        return `<tr>
          <td>${u.id}</td>
          <td>${u.username ?? ''}</td>
          <td>${nm}</td>
          <td>${u.email ?? ''}</td>
          <td>${u.phone ?? ''}</td>
          <td>${u.street ?? ''}</td>
          <td>${u.city ?? ''}</td>
          <td>${u.state_code ?? ''}</td>
          <td>${u.pin ?? ''}</td>
          <td>${fmtDate(u.created_at)}</td>
          <td>${fmtDate(u.updated_at)}</td>
        </tr>`;
      }).join('\n');
    }
    function updatePager(data){
      $("#usersPageInfo").textContent = `Page ${data.page} / ${data.total_pages || 0}`;
      $("#usersTotalInfo").textContent = `${data.total} total`;
      $("#usersPrevBtn").disabled = data.page <= 1;
      $("#usersNextBtn").disabled = !data.total_pages || data.page >= data.total_pages;
    }
    async function load(){ $("#usersTbody").innerHTML = '<tr><td colspan="11">Loading...</td></tr>'; try{ const data = await fetchUsers(state.page, state.pageSize, state.search); renderRows(data.items); updatePager(data);}catch(e){ $("#usersTbody").innerHTML = `<tr><td colspan="11">Error ${e.message}</td></tr>`; } }
    $("#usersSearchInput").addEventListener('input', ()=>{ state.search = $("#usersSearchInput").value; state.page=1; clearTimeout(window.__usersSrchTimer); window.__usersSrchTimer = setTimeout(load,300); });
    $("#usersPageSizeSelect").addEventListener('change', ()=>{ state.pageSize = parseInt($("#usersPageSizeSelect").value,10)||10; state.page=1; load(); });
    $("#usersPrevBtn").addEventListener('click', ()=>{ if(state.page>1){ state.page--; load(); } });
    $("#usersNextBtn").addEventListener('click', ()=>{ state.page++; load(); });
    load();
  }

// --- Sheds (landing) ---
function mountShedsPage() {
  const area = document.getElementById("content-area");
  document.getElementById("content-title").textContent = "Sheds";
  area.innerHTML = `
    <div id="sheds-app">
      <div class="sheds-search">
        <input id="shedsSearch" type="text" placeholder="Search by ID or capacity" />
      </div>
      <div id="shedsTableWrap">
        <table class="farmers-table" id="shedsTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Farm ID</th>
              <th>Total Sq Ft</th>
              <th>Chick Capacity</th>
              <th>Feedbag Capacity</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="shedsTbody"><tr><td colspan="6">Loading...</td></tr></tbody>
        </table>
      </div>
      <div class="page-size" id="shedsPageSizeBox">
        <label for="shedsPageSize" class="ps-label">Rows:
          <select id="shedsPageSize">
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
      <div class="pagination" id="shedsPager">
        <button id="shedsPrevBtn" disabled>Prev</button>
        <span id="shedsPageInfo">Page 1</span>
        <button id="shedsNextBtn" disabled>Next</button>
        <span id="shedsTotalInfo"></span>
      </div>
    </div>
  `;

  // State
  let page = 1; let pageSize = 10; let search = "";
  const farmId = (new URL(location.href)).searchParams.get("farmId") || null;

  async function fetchSheds() {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (farmId) params.set("farm_id", farmId);
    // server-side search optional (if implemented). Otherwise client filter.
    // params.set("search", search);
    const url = `${API}/sheds?${params.toString()}`;
    let res = await fetch(url, { headers: { ...authHeader() } });
    if (res.status === 401) {
      const ok = await tryRefresh();
      if (ok) res = await fetch(url, { headers: { ...authHeader() } });
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function renderRows(items) {
    const tbody = document.getElementById("shedsTbody");
    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">No sheds found</td></tr>`;
      return;
    }
    const rows = items.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${item.farm_id}</td>
        <td>${item.total_sqft ?? ""}</td>
        <td>${item.chick_capacity ?? ""}</td>
        <td>${item.feedbag_capacity ?? ""}</td>
        <td>${new Date(item.created_at).toLocaleString()}</td>
      </tr>
    `).join("\n");
    tbody.innerHTML = rows;
  }

  const prevBtn = document.getElementById("shedsPrevBtn");
  const nextBtn = document.getElementById("shedsNextBtn");
  const pageInfo = document.getElementById("shedsPageInfo");
  const totalInfo = document.getElementById("shedsTotalInfo");
  prevBtn.addEventListener("click", () => { if (page > 1){ page -= 1; update(); } });
  nextBtn.addEventListener("click", () => { page += 1; update(); });

  async function update() {
    try {
      const data = await fetchSheds();
      // Optional client-side search filtering
      const items = search ? (data.items || []).filter(it => {
        const s = String(search).toLowerCase();
        return String(it.id).includes(s) || String(it.farm_id).includes(s) ||
               String(it.total_sqft ?? "").includes(s) || String(it.chick_capacity ?? "").includes(s) ||
               String(it.feedbag_capacity ?? "").includes(s);
      }) : (data.items || []);
      renderRows(items);
      const total = data.total || items.length;
      const totalPages = data.total_pages || 1;
      pageInfo.textContent = `Page ${page}`;
      totalInfo.textContent = `of ${totalPages} (${total} items)`;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= totalPages;
    } catch (err) {
      document.getElementById("shedsTbody").innerHTML = `<tr><td colspan="6">Error: ${err.message}</td></tr>`;
    }
  }

  // Wire search and page size
  const searchEl = document.getElementById("shedsSearch");
  const psEl = document.getElementById("shedsPageSize");
  searchEl.addEventListener("input", () => { search = searchEl.value.trim(); update(); });
  psEl.addEventListener("change", () => { pageSize = parseInt(psEl.value, 10); page = 1; update(); });

  update();
}

// --- Farmers LIST (SPA) ---
async function mountFarmersList() {
  const area = document.getElementById("content-area");
  document.getElementById("content-title").textContent = "Farmers";
  area.innerHTML = `
    <div id="farmers-app">
      <div class="top-actions-right">
        <a id="registrationBtn" href="#/farmer" class="btn" data-view="farmer">Registration</a>
        <button id="linkFarmBtn" class="btn" style="margin-left:8px;">Link Farm</button>
      </div>
      <div class="farmers-search">
        <input id="searchInput" type="text" placeholder="Search name / email / phone / city" />
      </div>
      <div id="tableWrap">
        <table class="farmers-table" id="farmersTable">
          <thead>
            <tr>
              <th style="width:32px;">Select</th>
              <th>ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Phone</th>
              <th>Email</th>
              <th>City</th>
              <th>State</th>
              <th>PIN</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="farmersTbody"><tr><td colspan="10">Loading...</td></tr></tbody>
        </table>
      </div>
      <div class="page-size" id="pageSizeBox">
        <label for="pageSizeSelect" class="ps-label">Rows:
          <select id="pageSizeSelect">
            <option value="10" selected>10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
      <div class="pagination" id="pager">
        <button id="prevBtn" disabled>Prev</button>
        <span id="pageInfo">Page 1</span>
        <button id="nextBtn" disabled>Next</button>
        <span id="totalInfo"></span>
      </div>
    </div>
  `;
  // list logic
  let state = { page:1, pageSize:10, search:"" };
  const API = (window.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const $ = (s)=>document.querySelector(s);
  async function fetchFarmers(page=1,pageSize=10,search="") {
    const q = new URLSearchParams({ page:String(page), page_size:String(pageSize) });
    if (search.trim()) q.set("search", search.trim());
    const res = await fetch(`${API}/farmers?${q}`, { headers: { ...authHeader() } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }
  function fmtDate(d){ try{return new Date(d).toLocaleString();}catch{return d;} }
  function renderRows(items){
    const tbody = $("#farmersTbody");
    if(!items.length){ tbody.innerHTML = '<tr><td colspan="10">No results</td></tr>'; return; }
    tbody.innerHTML = items.map(f=>{
      const nm = [f.first_name,f.middle_name,f.last_name].filter(Boolean).join(' ');
      return `<tr>
        <td><input type="checkbox" class="row-select" data-id="${f.id}" /></td>
        <td>${f.id}</td>
        <td>${nm}</td>
        <td>${f.gender}</td>
        <td>${f.phone}</td>
        <td>${f.email}</td>
        <td>${f.city}</td>
        <td>${f.state_code}</td>
        <td>${f.pin}</td>
        <td>${fmtDate(f.created_at)}</td>
      </tr>`; }).join('\n');
    const boxes = Array.from(document.querySelectorAll('.row-select'));
    boxes.forEach(b=> b.addEventListener('change',()=>{
      if (b.checked){ boxes.forEach(o=>{ if(o!==b) o.checked=false; });
        document.querySelectorAll('#farmersTable tbody tr').forEach(r=>r.classList.remove('selected'));
        b.closest('tr')?.classList.add('selected');
      } else { b.closest('tr')?.classList.remove('selected'); }
      updateActionButtons();
    }));
  }
  function updatePager(data){
    $("#pageInfo").textContent = `Page ${data.page} / ${data.total_pages || 0}`;
    $("#totalInfo").textContent = `${data.total} total`;
    $("#prevBtn").disabled = data.page <= 1;
    $("#nextBtn").disabled = !data.total_pages || data.page >= data.total_pages;
  }
  async function load(){
    $("#farmersTbody").innerHTML = '<tr><td colspan="10">Loading...</td></tr>';
    try { const data = await fetchFarmers(state.page,state.pageSize,state.search); renderRows(data.items); updatePager(data);}catch(e){ $("#farmersTbody").innerHTML = `<tr><td colspan="10">Error ${e.message}</td></tr>`; }
  }
  $("#searchInput").addEventListener('input',()=>{ state.search = $("#searchInput").value; state.page=1; clearTimeout(window.__farmerListTimer); window.__farmerListTimer = setTimeout(load,300); });
  $("#pageSizeSelect").addEventListener('change',()=>{ state.pageSize = parseInt($("#pageSizeSelect").value,10)||10; state.page=1; load(); });
  $("#prevBtn").addEventListener('click',()=>{ if(state.page>1){ state.page--; load(); } });
  $("#nextBtn").addEventListener('click',()=>{ state.page++; load(); });
  document.getElementById('linkFarmBtn').addEventListener('click',()=>{
    const sel = document.querySelector('.row-select:checked');
    if(!sel){ alert('Select a farmer first'); return; }
    const id = sel.getAttribute('data-id');
    window.location.href = `./farm-link.html?farmerId=${encodeURIComponent(id)}`;
  });

  // Manage button enabled/disabled states based on selection
  const registrationBtn = document.getElementById('registrationBtn');
  function setDisabled(el, disabled){
    if (!el) return;
    el.classList.toggle('disabled', !!disabled);
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (el.tagName.toLowerCase() === 'button') {
      el.disabled = !!disabled;
    }
  }
  function updateActionButtons(){
    const hasSelection = !!document.querySelector('.row-select:checked');
    setDisabled(registrationBtn, hasSelection);
    setDisabled(document.getElementById('linkFarmBtn'), !hasSelection);
  }
  // Prevent navigation when registration is disabled
  registrationBtn.addEventListener('click', (e)=>{
    if (registrationBtn.classList.contains('disabled')) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  // Initial state: Registration enabled, Link Farm disabled
  updateActionButtons();
  load();
}

// --- Farms LIST (SPA) ---
async function mountFarmsList(){
  const area = document.getElementById('content-area');
  document.getElementById('content-title').textContent = 'Farms';
  area.innerHTML = `
    <div id="farms-app">
      <div class="top-actions-right">
        <button id="linkShedsBtn" class="btn" title="Link Sheds">Link Sheds</button>
      </div>
      <div class="farm-search"><input id="farmSearchInput" placeholder="Search farm name / city / state / PIN" /></div>
      <div id="tableWrap">
        <table class="farmers-table" id="farmsTable">
          <thead><tr>
            <th style="width:32px;">Select</th><th>ID</th><th>Farmer ID</th><th>Farm Name</th><th>City</th><th>State</th><th>PIN</th><th>Size</th><th>Sheds</th><th>Created</th>
          </tr></thead>
          <tbody id="farmsTbody"><tr><td colspan="10">Loading...</td></tr></tbody>
        </table>
      </div>
      <div class="list-footer">
        <div class="page-size" id="farmPageSizeBox">
          <label class="ps-label">Rows:
            <select id="farmPageSizeSelect">
              <option value="10" selected>10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
        <div class="pagination" id="farmPager">
          <button id="farmPrevBtn" disabled>Prev</button>
          <span id="farmPageInfo">Page 1</span>
          <button id="farmNextBtn" disabled>Next</button>
          <span id="farmTotalInfo"></span>
        </div>
      </div>
    </div>`;
  const API = (window.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const $ = (s)=>document.querySelector(s);
  let state = { page:1, pageSize:10, search:"" };
  async function fetchFarms(page=1,pageSize=10,search=""){
    const q = new URLSearchParams({ page:String(page), page_size:String(pageSize) });
    if(search.trim()) q.set('search', search.trim());
    const res = await fetch(`${API}/farms?${q}`, { headers: { ...authHeader() } });
    if(!res.ok) throw new Error(`${res.status}`); return res.json();
  }
  function fmtDate(d){ try{return new Date(d).toLocaleString();}catch{return d;} }
  function renderRows(items){
    const tbody = $('#farmsTbody');
    if(!items.length){ tbody.innerHTML='<tr><td colspan="10">No results</td></tr>'; return; }
    tbody.innerHTML = items.map(f=>{
      const size = (f.farm_size!=null)? f.farm_size : '';
      const sheds = (f.shed_count!=null)? f.shed_count : '';
      return `<tr>
        <td><input type="checkbox" class="farm-row-select" data-id="${f.id}" /></td>
        <td>${f.id}</td><td>${f.farmer_id}</td><td>${f.farm_name}</td><td>${f.city}</td><td>${f.state_code}</td><td>${f.pin}</td><td>${size}</td><td>${sheds}</td><td>${fmtDate(f.created_at)}</td>
      </tr>`; }).join('\n');
    const boxes = Array.from(document.querySelectorAll('.farm-row-select'));
    boxes.forEach(b=> b.addEventListener('change',()=>{
      if(b.checked){ boxes.forEach(o=>{ if(o!==b) o.checked=false; }); document.querySelectorAll('#farmsTable tbody tr').forEach(r=>r.classList.remove('selected')); b.closest('tr')?.classList.add('selected'); }
      else { b.closest('tr')?.classList.remove('selected'); }
      updateShedsButton();
    }));
  }
  function updatePager(data){
    $('#farmPageInfo').textContent = `Page ${data.page} / ${data.total_pages || 0}`;
    $('#farmTotalInfo').textContent = `${data.total} total`;
    $('#farmPrevBtn').disabled = data.page <=1;
    $('#farmNextBtn').disabled = !data.total_pages || data.page >= data.total_pages;
  }
  async function load(){ $('#farmsTbody').innerHTML='<tr><td colspan="10">Loading...</td></tr>'; try{ const data=await fetchFarms(state.page,state.pageSize,state.search); renderRows(data.items); updatePager(data);}catch(e){ $('#farmsTbody').innerHTML=`<tr><td colspan="10">Error ${e.message}</td></tr>`; } }
  $('#farmSearchInput').addEventListener('input',()=>{ state.search = $('#farmSearchInput').value; state.page=1; clearTimeout(window.__farmSrchTimer); window.__farmSrchTimer=setTimeout(load,300); });
  $('#farmPageSizeSelect').addEventListener('change',()=>{ state.pageSize = parseInt($('#farmPageSizeSelect').value,10)||10; state.page=1; load(); });
  $('#farmPrevBtn').addEventListener('click',()=>{ if(state.page>1){ state.page--; load(); } });
  $('#farmNextBtn').addEventListener('click',()=>{ state.page++; load(); });
  // Link Sheds button behavior: enable only when a farm is selected
  const linkShedsBtn = document.getElementById('linkShedsBtn');
  function setDisabled(el, disabled){ if(!el) return; el.disabled = !!disabled; el.classList.toggle('disabled', !!disabled); el.setAttribute('aria-disabled', disabled ? 'true':'false'); }
  function updateShedsButton(){ const hasSel = !!document.querySelector('.farm-row-select:checked'); setDisabled(linkShedsBtn, !hasSel); }
  linkShedsBtn.addEventListener('click', (e)=>{
    if (linkShedsBtn.classList.contains('disabled')) { e.preventDefault(); return; }
    const sel = document.querySelector('.farm-row-select:checked');
    if(!sel){ alert('Select a farm first'); return; }
    const id = sel.getAttribute('data-id');
    const row = sel.closest('tr');
    const farmerId = row ? row.children[2]?.textContent?.trim() : '';
    const qs = new URLSearchParams({ farmId: id, farmerId });
    window.location.href = `./sheds-link.html?${qs.toString()}`;
  });
  // Initial state
  updateShedsButton();
  load();
}
