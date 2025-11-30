// UI/farm-link.js - Link a farm to a selected farmer
import { requireAuth, authHeader, clearToken } from './auth.js';
const API = (window.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const $ = (s) => document.querySelector(s);

function getQueryParam(name){ const u=new URL(window.location.href); return u.searchParams.get(name); }

let farmerAddressCache = null;
async function loadFarmerAddress(id){
  try {
    const res = await fetch(`${API}/farmer/${id}`, { headers: { ...authHeader() } });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    const data = await res.json();
    farmerAddressCache = data;
    $('#farmLinkMsg').textContent = `Linking to farmer #${id}`;
  } catch (err) {
    console.error('Failed to load farmer address', err);
    $('#farmLinkMsg').textContent = 'Could not load farmer address.';
  }
}

function main(){
  if (!requireAuth('./login.html')) return;
  $('#logoutBtn')?.addEventListener('click', () => {
    fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(()=>{ clearToken(); window.location.replace('./login.html');});
  });

  const farmerId = getQueryParam('farmerId');
  if (!farmerId) {
    $('#farmLinkMsg').textContent = 'No farmer selected. Go back and select a farmer.';
  } else {
    $('#farmLinkMsg').textContent = `Linking to farmer #${farmerId}`;
    loadFarmerAddress(farmerId);
  }

  const same = $('#same_address');
  same.addEventListener('change', () => {
    if (!farmerId) { alert('Select a farmer first.'); same.checked = false; return; }
    if (same.checked) {
      if (!farmerAddressCache) {
        $('#farmLinkMsg').textContent = 'Farmer address not loaded.';
        same.checked = false; return;
      }
      $('#farm_street').value = farmerAddressCache.street || '';
      const citySel = $('#farm_city');
      if (citySel && citySel.tagName.toLowerCase()==='select') {
        citySel.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = farmerAddressCache.city || '';
        opt.textContent = farmerAddressCache.city || '';
        citySel.appendChild(opt);
        citySel.disabled = false;
      }
      $('#farm_state').value = farmerAddressCache.state_code || '';
      $('#farm_pin').value = farmerAddressCache.pin || '';
      $('#farmLinkMsg').textContent = 'Prefilled from farmer address.';
    } else {
      // do not clear automatically
    }
  });

  // PIN auto-fill for city/state
  const pinInput = document.getElementById('farm_pin');
  const citySelect = document.getElementById('farm_city');
  const stateSelect = document.getElementById('farm_state');
  const pinMsg = document.getElementById('farmPinMsg');
  async function fetchPinInfo(pin) {
    pinMsg.textContent = 'Looking up PIN...';
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data[0] || data[0].Status !== 'Success') {
        pinMsg.textContent = 'PIN not found';
        return;
      }
      const offices = data[0].PostOffice || [];
      if (!offices.length) { pinMsg.textContent = 'No post offices'; return; }
      citySelect.innerHTML = '';
      offices.forEach(o => {
        const opt = document.createElement('option');
        opt.value = (o.Block || o.Name || '').trim();
        opt.textContent = (o.Block || o.Name || '').trim();
        citySelect.appendChild(opt);
      });
      citySelect.disabled = false;
      const apiState = offices[0].State;
      [...stateSelect.options].forEach(o => {
        if (o.textContent.toLowerCase() === apiState.toLowerCase()) {
          stateSelect.value = o.value;
        }
      });
      pinMsg.textContent = `Matched state: ${apiState}`;
    } catch (err) {
      console.error('PIN lookup failed', err);
      pinMsg.textContent = 'PIN lookup error';
    }
  }
  pinInput?.addEventListener('input', () => {
    const v = pinInput.value.trim();
    if (/^\d{6}$/.test(v)) {
      fetchPinInfo(v);
    }
  });

  $('#farmLinkForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
      farmer_id: farmerId,
      farm_name: $('#farm_name').value.trim(),
      farm_size: parseFloat($('#farm_size').value),
      shed_count: parseInt($('#shed_count').value, 10),
      address: {
        street: $('#farm_street').value.trim(),
        city: $('#farm_city').value.trim(),
        state_code: $('#farm_state').value.trim(),
        pin: $('#farm_pin').value.trim()
      }
    };
    // POST to backend
    fetch(`${API}/farms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload)
    }).then(async (res) => {
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${txt}`);
      }
      const data = await res.json();
      $('#farmLinkMsg').textContent = `✔ Created farm #${data.id}`;
    }).catch(err => {
      $('#farmLinkMsg').textContent = `✖ ${err.message}`;
    });
  });

  // Street live validation (same as farmer registration)
  const streetEl = document.getElementById('farm_street');
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => { window.location.href = './index.html#/farms'; });
  }
  if (streetEl) {
    const allowed = /[A-Za-z ,/\-]/;
    streetEl.addEventListener('beforeinput', (e) => {
      if (e.data && !allowed.test(e.data)) e.preventDefault();
    });
    streetEl.addEventListener('input', () => {
      const v = streetEl.value;
      if (v.length > 100) streetEl.value = v.slice(0,100);
      if (!/^[A-Za-z ,/\-]*$/.test(streetEl.value)) {
        streetEl.classList.add('invalid');
      } else {
        streetEl.classList.remove('invalid');
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', main);
