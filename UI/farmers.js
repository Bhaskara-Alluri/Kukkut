// UI/farmers.js - lists farmers with pagination & search
import { requireAuth, authHeader, clearToken } from './auth.js';
const API = (window.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const $ = (s) => document.querySelector(s);

function fmtDate(d){ try { return new Date(d).toLocaleString(); } catch { return d; } }

async function fetchFarmers(page=1, pageSize=10, search='') {
  const q = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search.trim()) q.set('search', search.trim());
  const res = await fetch(`${API}/farmers?${q.toString()}`, { headers: { ...authHeader() } });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function renderRows(items){
  const tbody = $('#farmersTbody');
  if (!items.length){ tbody.innerHTML = '<tr><td colspan="9">No results</td></tr>'; return; }
  tbody.innerHTML = items.map(f => {
    const fullName = [f.first_name, f.middle_name, f.last_name].filter(Boolean).join(' ');
    return `<tr>
      <td><input type="checkbox" class="row-select" data-id="${f.id}" /></td>
      <td>${f.id}</td>
      <td>${fullName}</td>
      <td>${f.gender}</td>
      <td>${f.phone}</td>
      <td>${f.email}</td>
      <td>${f.city}</td>
      <td>${f.state_code}</td>
      <td>${f.pin}</td>
      <td>${fmtDate(f.created_at)}</td>
    </tr>`;
  }).join('\n');

  // Enforce single selection: uncheck others when one is checked
  const boxes = Array.from(document.querySelectorAll('.row-select'));
  boxes.forEach(b => {
    b.addEventListener('change', () => {
      if (b.checked) {
        boxes.forEach(other => { if (other !== b) other.checked = false; });
        // highlight selected row, remove from others
        const rows = Array.from(document.querySelectorAll('#farmersTable tbody tr'));
        rows.forEach(r => r.classList.remove('selected'));
        const row = b.closest('tr');
        if (row) row.classList.add('selected');
      } else {
        const row = b.closest('tr');
        if (row) row.classList.remove('selected');
      }
    });
  });
}

function updatePager(data){
  $('#pageInfo').textContent = `Page ${data.page} / ${data.total_pages || 0}`;
  $('#totalInfo').textContent = `${data.total} total`;
  $('#prevBtn').disabled = data.page <= 1;
  $('#nextBtn').disabled = !data.total_pages || data.page >= data.total_pages;
}

function main(){
  if (!requireAuth('./login.html')) return;
  $('#logoutBtn')?.addEventListener('click', () => {
    fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(()=>{ clearToken(); window.location.replace('./login.html');});
  });

  let state = { page:1, pageSize:10, search:'' };
  const load = async () => {
    $('#farmersTbody').innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
    try {
      const data = await fetchFarmers(state.page, state.pageSize, state.search);
      renderRows(data.items);
      updatePager(data);
    } catch(err){
      $('#farmersTbody').innerHTML = `<tr><td colspan="9">Error: ${err.message}</td></tr>`;
    }
  };

  // Events
  $('#searchInput').addEventListener('input', () => {
    state.search = $('#searchInput').value;
    state.page = 1; // reset page on new search
    // debounce
    clearTimeout(window.__srchTimer);
    window.__srchTimer = setTimeout(load, 300);
  });
  $('#pageSizeSelect').addEventListener('change', () => {
    state.pageSize = parseInt($('#pageSizeSelect').value, 10) || 10;
    state.page = 1; load();
  });
  $('#prevBtn').addEventListener('click', () => { if(state.page>1){ state.page--; load(); } });
  $('#nextBtn').addEventListener('click', () => { state.page++; load(); });

  // Link Farm button: requires one selected farmer
  const linkBtn = document.getElementById('linkFarmBtn');
  if (linkBtn) {
    linkBtn.addEventListener('click', () => {
      const sel = document.querySelector('.row-select:checked');
      if (!sel) { alert('Please select a farmer first.'); return; }
      const id = sel.getAttribute('data-id');
      window.location.href = `./farm-link.html?farmerId=${encodeURIComponent(id)}`;
    });
  }

  load();
}

window.addEventListener('DOMContentLoaded', main);
