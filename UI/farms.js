// UI/farms.js - Farms listing similar to farmers
import { requireAuth, authHeader, clearToken } from './auth.js';
const API = (window.API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const $ = (s) => document.querySelector(s);

function fmtDate(d){ try { return new Date(d).toLocaleString(); } catch { return d; } }

async function fetchFarms(page=1, pageSize=10, search='') {
  const q = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search.trim()) q.set('search', search.trim());
  const res = await fetch(`${API}/farms?${q.toString()}`, { headers: { ...authHeader() } });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function renderRows(items){
  const tbody = $('#farmsTbody');
  if (!items.length){ tbody.innerHTML = '<tr><td colspan="9">No results</td></tr>'; return; }
  tbody.innerHTML = items.map(f => {
    const size = (f.farm_size != null) ? `${f.farm_size}` : '';
    const sheds = (f.shed_count != null) ? `${f.shed_count}` : '';
    return `<tr>
      <td><input type="checkbox" class="farm-row-select" data-id="${f.id}" /></td>
      <td>${f.id}</td>
      <td>${f.farmer_id}</td>
      <td>${f.farm_name}</td>
      <td>${f.city}</td>
      <td>${f.state_code}</td>
      <td>${f.pin}</td>
      <td>${size}</td>
      <td>${sheds}</td>
      <td>${fmtDate(f.created_at)}</td>
    </tr>`;
  }).join('\n');

  // Enforce single selection and highlight selected row
  const boxes = Array.from(document.querySelectorAll('.farm-row-select'));
  boxes.forEach(b => {
    b.addEventListener('change', () => {
      if (b.checked) {
        boxes.forEach(other => { if (other !== b) other.checked = false; });
        const rows = Array.from(document.querySelectorAll('#farmsTable tbody tr'));
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
    $('#farmsTbody').innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
    try {
      const data = await fetchFarms(state.page, state.pageSize, state.search);
      renderRows(data.items);
      updatePager(data);
    } catch(err){
      $('#farmsTbody').innerHTML = `<tr><td colspan="9">Error: ${err.message}</td></tr>`;
    }
  };

  // Events
  $('#searchInput').addEventListener('input', () => {
    state.search = $('#searchInput').value;
    state.page = 1; // reset page on new search
    clearTimeout(window.__farmSrchTimer);
    window.__farmSrchTimer = setTimeout(load, 300);
  });
  $('#pageSizeSelect').addEventListener('change', () => {
    state.pageSize = parseInt($('#pageSizeSelect').value, 10) || 10;
    state.page = 1; load();
  });
  $('#prevBtn').addEventListener('click', () => { if(state.page>1){ state.page--; load(); } });
  $('#nextBtn').addEventListener('click', () => { state.page++; load(); });

  load();
}

window.addEventListener('DOMContentLoaded', main);
