// UI/sheds-link.js
// Placeholder page for linking sheds to a selected farm
import { requireAuth, authHeader, clearToken, saveToken } from './auth.js';

function getParam(name){ const u=new URL(location.href); return u.searchParams.get(name); }

window.addEventListener('DOMContentLoaded', ()=>{
  if (!requireAuth('./login.html')) return;
  const farmId = getParam('farmId');
  const farmerId = getParam('farmerId');
  const fField = document.getElementById('farmerId');
  const farmField = document.getElementById('farmId');
  if (farmerId) fField.value = farmerId; else fField.value = '';
  if (farmId) farmField.value = farmId; else farmField.value = '';

  const form = document.getElementById('shedsForm');
  const msg = document.getElementById('msg');
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const base = (window.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'include' })
        .finally(() => { clearToken(); window.location.replace('./login.html'); });
    });
  }
  // numbers-only enforcement
  const numericIds = ['totalSqFt','chickCapacity','feedBagCapacity'];
  numericIds.forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('beforeinput', (e)=>{ if (e.data && /[^0-9]/.test(e.data)) e.preventDefault(); });
    el.addEventListener('input', ()=>{ el.value = el.value.replace(/[^0-9]/g,''); });
  });

  async function tryRefresh() {
    try {
      const res = await fetch(`${API_BASE_URL || 'http://127.0.0.1:8000'}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) { saveToken(data.access_token, false); return true; }
    } catch { return false; }
    return false;
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = 'Saving...';
    // Placeholder: post to backend when ready
    try {
      const payload = {
        farm_id: farmId ? parseInt(farmId,10) : null,
        total_sqft: document.getElementById('totalSqFt').value.trim(),
        chick_capacity: document.getElementById('chickCapacity').value.trim(),
        feedbag_capacity: document.getElementById('feedBagCapacity').value.trim(),
      };
      if (!payload.farm_id) { msg.textContent = '✖ Missing farm id'; return; }
      const base = (window.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      let res = await fetch(`${base}/sheds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          res = await fetch(`${base}/sheds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify(payload),
            credentials: 'include'
          });
        }
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      msg.textContent = `✔ Shed created #${data.id}`;
      // Redirect to sheds list filtered by farm
      setTimeout(()=>{ window.location.href = `./index.html#/sheds?farmId=${payload.farm_id}`; }, 800);
    } catch (err) {
      msg.textContent = `✖ ${err.message}`;
    }
  });

  // Cancel: navigate back to farms list
  const cancel = document.getElementById('cancelBtn');
  if (cancel) {
    cancel.addEventListener('click', ()=>{
      window.location.href = './index.html#/farms';
    });
  }
});
