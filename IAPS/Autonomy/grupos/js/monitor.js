import { ROLES, ROLES_PT, ROLE_COLORS, PANEL_COLORS, I18N } from './roles.js';

const BC_CHANNEL = 'improvisacao_local';
const SLOT_COUNT = 10;

let bc = null;
let lastPayload = null;
let viewMode = 'monitor';

export function init() {
  bc = new BroadcastChannel(BC_CHANNEL);
  bc.onmessage = e => handlePayload(e.data);
}

export function toggleView() {
  viewMode = viewMode === 'monitor' ? 'projection' : 'monitor';
  document.body.classList.toggle('proj-mode', viewMode === 'projection');
  const btn = document.getElementById('view-toggle-btn');
  if (btn) btn.textContent = viewMode === 'projection' ? '▣ Monitor' : '▣ Projeção';
  if (viewMode === 'projection' && lastPayload) renderProjection(lastPayload);
}

function handlePayload(data) {
  if (!data || !data.slots) return;
  lastPayload = data;

  document.getElementById('no-signal').style.display = 'none';
  const main = document.getElementById('main-area');

  document.getElementById('live-dot').classList.add('active');
  document.getElementById('last-update').textContent =
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const mode = data.mode || 'dupla';
  const lang = data.lang || 'pt';

  document.getElementById('conn-badge').textContent =
    `${(data.slots || []).filter(s => s.name).length} conectado(s)`;

  if (viewMode === 'projection') {
    main.style.display = 'none';
    renderProjection(data);
  } else {
    main.style.display = '';
    renderMonitorCards(data, mode, lang);
  }
}

function renderMonitorCards(data, mode, lang) {
  document.getElementById('mode-label').textContent =
    `MODO: ${mode.toUpperCase()} · ${lang.toUpperCase()}`;

  const grid = document.getElementById('cards-grid');
  grid.className = mode === 'grupo' ? 'grid-grupo' : 'grid-dupla';

  const count = mode === 'grupo' ? SLOT_COUNT : 2;
  const slots = data.slots || [];
  grid.innerHTML = slots.slice(0, count).map((s, i) => cardHTML(s, i, lang)).join('');
}

function renderProjection(data) {
  const pv = document.getElementById('projection-view');
  if (!pv) return;

  const lang = data.lang || 'pt';
  const mode = data.mode || 'dupla';
  const t = I18N[lang];
  const count = mode === 'grupo' ? SLOT_COUNT : 2;

  pv.className = `proj-${mode}`;
  pv.innerHTML = (data.slots || []).slice(0, count).map((s, i) => {
    const ri = s.roleIdx ?? 0;
    return `
      <div class="proj-panel" style="background-color:${PANEL_COLORS[ri]}">
        <div class="proj-slot">P${i + 1}</div>
        <div class="proj-role">${t.roles[ri]}</div>
        <div class="proj-desc">${t.descriptions[ri]}</div>
        ${s.name ? `<div class="proj-name">${s.name}</div>` : ''}
      </div>`;
  }).join('');
}

function cardHTML(slot, idx, lang) {
  const ri = slot.roleIdx ?? 0;
  const roleColor = ROLE_COLORS[ri];
  const roleName = lang === 'pt' ? ROLES_PT[ri] : ROLES[ri];
  const roleNameAlt = lang === 'pt' ? ROLES[ri] : ROLES_PT[ri];
  const hasName = !!slot.name;

  const pills = ROLES.map((r, pi) => `
    <span class="mon-pill${pi === ri ? ' active' : ''}"
          style="${pi === ri ? `--card-color:${ROLE_COLORS[pi]}` : ''}">${
      lang === 'pt' ? ROLES_PT[pi] : ROLES[pi]
    }</span>`).join('');

  const fillPct = (ri / 4) * 100;

  return `
    <div class="mon-card${hasName ? ' connected' : ' waiting'}" style="--card-color:${roleColor}">
      <div class="mon-card-top">
        <span class="mon-slot-num">P${idx + 1}</span>
        <span class="mon-name${hasName ? '' : ' empty'}">${hasName ? slot.name : '—'}</span>
        <span class="conn-dot${hasName ? ' on' : ''}"></span>
      </div>
      <div class="mon-card-body">
        <div class="mon-role-big" style="--card-color:${roleColor}">
          ${roleName}
          <div class="mon-role-en">${roleNameAlt}</div>
        </div>
        <div class="mon-role-bar">
          <div class="mon-role-fill" style="width:${fillPct}%;--card-color:${roleColor}"></div>
        </div>
        <div class="mon-pills">${pills}</div>
      </div>
    </div>`;
}
