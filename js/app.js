/* =========================================================
   Výzvy — hlavní logika aplikace (čistý JS, ES moduly).
   ========================================================= */

import {
  fetchChallenges, addChallenge, saveCompletions,
  removeChallenge, subscribeToChanges, saveDeadline,
} from './db.js';
import { PROFILES, isConfigured } from './supabase-config.js';

/* ---------- stav ---------- */
const state = {
  challenges: [],
  activeTab: PROFILES[0].id,   // jen pro mobil (přepínání)
};
let shellReady = false;

/* ---------- datové pomocníky ---------- */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => keyOf(new Date());
const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(keyOf(shift(new Date(), -i)));
  return out;
}
function weekKeys() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;          // pondělí = 0
  const monday = shift(now, -dow);
  return Array.from({ length: 7 }, (_, i) => keyOf(shift(monday, i)));
}
function computeStreak(comp) {
  let s = 0;
  let d = new Date();
  if (!comp[keyOf(d)]) d = shift(d, -1);       // dnešek ještě nezapsaný streak nezruší
  while (comp[keyOf(d)]) { s++; d = shift(d, -1); }
  return s;
}
const weekCount = (comp) => weekKeys().filter((k) => comp[k]).length;

/* Kolik dní zbývá do termínu (záporné = po termínu, null = bez termínu). */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
function formatCzDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

function czDays(n) {
  if (n === 1) return 'den';
  if (n >= 2 && n <= 4) return 'dny';
  return 'dní';
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const accentFor = (idx) => (idx === 1 ? 'var(--accent-matej)' : 'var(--accent-me)');
const labelOf = (id) => (PROFILES.find((p) => p.id === id)?.label ?? id);

/* ---------- téma ---------- */
function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); }
function initTheme() {
  let stored = null;
  try { stored = localStorage.getItem('vyzvy-theme'); } catch (_) {}
  if (stored) applyTheme(stored);
  else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) applyTheme('light');
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('vyzvy-theme', next); } catch (_) {}
}

/* ---------- vykreslení ---------- */
function renderShell() {
  const tabs = PROFILES.map((p, i) => `
    <button class="tab" data-action="tab" data-tab="${p.id}" role="tab"
            aria-selected="${state.activeTab === p.id}">
      <span class="dot" style="background:${accentFor(i)}"></span>${esc(p.label)}
    </button>`).join('');

  const panels = PROFILES.map((p, i) => `
    <section class="panel owner-${p.id} ${state.activeTab === p.id ? 'is-active' : ''}"
             id="panel-${p.id}" data-owner="${p.id}" style="--accent:${accentFor(i)}">
      <div class="panel-head"><span class="dot"></span><h2>${esc(p.label)}</h2></div>
      <form class="add-form" data-owner="${p.id}">
        <input name="name" placeholder="Název výzvy (např. Cvičení)" required maxlength="60" autocomplete="off" />
        <div class="row">
          <input name="goal" placeholder="Cíl (např. 30 min)" maxlength="60" autocomplete="off" />
          <select name="frequency" aria-label="Frekvence">
            <option value="daily">Denně</option>
            <option value="weekly">Týdně</option>
          </select>
        </div>
        <label class="field">
          <span class="field-lbl">Deadline (nepovinné)</span>
          <input type="date" name="deadline" autocomplete="off" />
        </label>
        <button class="btn-add" type="submit">+ Přidat výzvu</button>
      </form>
      <div class="list" id="list-${p.id}"></div>
    </section>`).join('');

  document.getElementById('root').innerHTML = `
    <div class="versus" id="versus"></div>
    <div class="tabs" id="tabs" role="tablist">${tabs}</div>
    <div class="profiles">${panels}</div>`;
}

function renderVersus() {
  const totals = PROFILES.map((p) =>
    state.challenges.filter((c) => c.owner === p.id)
      .reduce((sum, c) => sum + weekCount(c.completions || {}), 0));
  const max = Math.max(...totals, 1);

  let verdict = 'Nerozhodně';
  if (totals[0] !== totals[1]) {
    const lead = totals[0] > totals[1] ? PROFILES[0] : PROFILES[1];
    verdict = `Vede ${esc(lead.label)}`;
  }

  const rows = PROFILES.map((p, i) => `
    <div class="vs-row" style="--c:${accentFor(i)}">
      <span class="vs-name">${esc(p.label)}</span>
      <span class="vs-track"><span class="vs-fill" style="width:${(totals[i] / max) * 100}%"></span></span>
      <span class="vs-count">${totals[i]}</span>
    </div>`).join('');

  document.getElementById('versus').innerHTML = `
    <div class="versus-head">
      <span class="versus-title">Tento týden</span>
      <span class="versus-verdict">${verdict}</span>
    </div>${rows}`;
}

function renderDeadline(ch) {
  const left = daysUntil(ch.deadline);
  if (left === null) return '';
  let cls = '', icon = '⏳', text = '';
  if (left > 0) {
    cls = left <= 7 ? 'soon' : '';
    text = `Zbývá ${left} ${czDays(left)}`;
  } else if (left === 0) {
    cls = 'today'; icon = '🎯'; text = 'Termín je dnes';
  } else {
    cls = 'past'; icon = '⏰';
    const a = Math.abs(left);
    text = `Po termínu o ${a} ${czDays(a)}`;
  }
  return `
    <div class="deadline ${cls}">
      <span class="dl-ic">${icon}</span>
      <span>${text}</span>
      <span class="dl-when">do ${formatCzDate(ch.deadline)}</span>
    </div>`;
}

function renderCard(ch) {
  const comp = ch.completions || {};
  const streak = computeStreak(comp);
  const wc = weekCount(comp);
  const target = ch.frequency === 'weekly' ? 1 : 7;
  const pct = Math.min(wc / target, 1) * 100;
  const t = todayKey();
  const doneToday = !!comp[t];

  const cells = lastNDays(28).map((k) => `
    <button class="heat-cell ${comp[k] ? 'done' : ''} ${k === t ? 'today' : ''}"
            data-action="toggle-day" data-id="${ch.id}" data-date="${k}"
            title="${k}" aria-label="${k}${comp[k] ? ' — splněno' : ''}"></button>`).join('');

  return `
    <article class="card">
      <div class="card-top">
        <div>
          <h3 class="card-title">${esc(ch.name)}</h3>
          ${ch.goal ? `<p class="card-goal">${esc(ch.goal)}</p>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="freq-tag">${ch.frequency === 'weekly' ? 'Týdně' : 'Denně'}</span>
          <button class="btn-del" data-action="delete" data-id="${ch.id}"
                  title="Smazat výzvu" aria-label="Smazat výzvu">✕</button>
        </div>
      </div>

      ${renderDeadline(ch)}

      <div class="stats">
        <div class="streak ${streak > 0 ? 'is-hot' : ''}">
          <span class="flame">🔥</span>
          <span class="num">${streak}</span>
          <span class="lbl">${czDays(streak)} v řadě</span>
        </div>
        <div class="week">
          <div class="week-head"><span>Tento týden</span><span>${doneToday || wc ? wc : 0}${target === 7 ? '/7' : '×'}</span></div>
          <div class="week-track"><span class="week-fill" style="width:${pct}%"></span></div>
        </div>
      </div>

      <button class="btn-today ${doneToday ? 'done' : ''}"
              data-action="toggle-day" data-id="${ch.id}" data-date="${t}">
        <span class="check">✓</span> ${doneToday ? 'Hotovo dnes' : 'Zapsat dnešek'}
      </button>

      <div class="heat">
        <div class="heat-label">Posledních 28 dní · klikni pro úpravu</div>
        <div class="heat-grid">${cells}</div>
      </div>

      <div class="dl-edit">
        <span class="dl-edit-lbl">Termín</span>
        <input type="date" class="dl-input" data-action="set-deadline"
               data-id="${ch.id}" value="${ch.deadline || ''}" />
      </div>
    </article>`;
}

function render() {
  renderVersus();
  for (const p of PROFILES) {
    const list = document.getElementById(`list-${p.id}`);
    if (!list) continue;
    const items = state.challenges.filter((c) => c.owner === p.id);
    list.innerHTML = items.length
      ? items.map(renderCard).join('')
      : `<div class="empty">Zatím žádná výzva.<br>Přidej první nahoře ↑</div>`;
  }
}

function updateTabs() {
  document.querySelectorAll('#tabs .tab').forEach((t) =>
    t.setAttribute('aria-selected', String(t.dataset.tab === state.activeTab)));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('is-active', p.dataset.owner === state.activeTab));
}

function renderSetupNotice() {
  document.getElementById('root').innerHTML = `
    <div class="notice">
      <h3>Skoro hotovo — chybí připojení k databázi</h3>
      <p>Otevři soubor <code>js/supabase-config.js</code> a doplň svůj
         <code>SUPABASE_URL</code> a <code>SUPABASE_KEY</code> (publishable key).</p>
      <p>Návod krok za krokem najdeš v souboru <code>README.md</code>.</p>
    </div>`;
}

function renderError(err) {
  document.getElementById('root').innerHTML = `
    <div class="notice">
      <h3>Nepodařilo se načíst data</h3>
      <p>${esc(err?.message || 'Neznámá chyba.')}</p>
      <p>Nejčastější příčina: ještě neproběhlo SQL nastavení tabulky
         <code>challenges</code> a pravidel. Zkontroluj krok 2 v <code>README.md</code>.</p>
      <p><button class="btn-add" style="width:auto" onclick="location.reload()">Zkusit znovu</button></p>
    </div>`;
  shellReady = false;
}

/* ---------- akce ---------- */
async function loadAndRender() {
  try {
    state.challenges = await fetchChallenges();
    if (!shellReady) { renderShell(); shellReady = true; }
    render();
    updateTabs();
  } catch (err) {
    console.error(err);
    renderError(err);
  }
}

async function onToggle(id, date) {
  const ch = state.challenges.find((c) => c.id === id);
  if (!ch) return;
  const comp = { ...(ch.completions || {}) };
  if (comp[date]) delete comp[date]; else comp[date] = true;
  ch.completions = comp;        // optimistická aktualizace
  render();
  try { await saveCompletions(id, comp); }
  catch (err) { console.error(err); await loadAndRender(); }
}

async function onSetDeadline(id, value) {
  const ch = state.challenges.find((c) => c.id === id);
  if (!ch) return;
  ch.deadline = value || null;   // optimistická aktualizace
  render();
  try { await saveDeadline(id, value); }
  catch (err) { console.error(err); await loadAndRender(); }
}

async function onAdd(form) {
  const owner = form.dataset.owner;
  const fd = new FormData(form);
  const name = (fd.get('name') || '').toString().trim();
  if (!name) return;
  try {
    await addChallenge({
      owner,
      name,
      goal: (fd.get('goal') || '').toString().trim(),
      frequency: (fd.get('frequency') || 'daily').toString(),
      deadline: (fd.get('deadline') || '').toString(),
    });
    form.reset();
    await loadAndRender();
  } catch (err) { console.error(err); alert('Nepodařilo se přidat výzvu.'); }
}

async function onDelete(id) {
  if (!confirm('Opravdu smazat tuto výzvu i s historií?')) return;
  try { await removeChallenge(id); await loadAndRender(); }
  catch (err) { console.error(err); alert('Nepodařilo se smazat výzvu.'); }
}

/* ---------- události (delegace) ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'theme') toggleTheme();
  else if (a === 'tab') { state.activeTab = el.dataset.tab; updateTabs(); }
  else if (a === 'toggle-day') onToggle(el.dataset.id, el.dataset.date);
  else if (a === 'delete') onDelete(el.dataset.id);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action="set-deadline"]');
  if (!el) return;
  onSetDeadline(el.dataset.id, el.value);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('.add-form');
  if (!form) return;
  e.preventDefault();
  onAdd(form);
});

/* ---------- start ---------- */
function init() {
  initTheme();
  if (!isConfigured) { renderSetupNotice(); return; }
  loadAndRender();
  subscribeToChanges(() => loadAndRender());
}
init();
