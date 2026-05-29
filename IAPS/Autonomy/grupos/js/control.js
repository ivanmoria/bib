import { ROLES, ROLES_PT, ROLE_COLORS, I18N } from './roles.js';

const BC_CHANNEL = 'improvisacao_local';
const SLOT_COUNT = 10;

let peer = null;
let connections = [];
let bc = null;
let currentLang = 'pt';
let isAudioEnabled = false;
let currentMode = 'dupla';
let intervalId = null;
let isRandomRunning = false;
let history = [];
let historyIdx = -1;
let baseId = '';

let slots = Array.from({ length: SLOT_COUNT }, () => ({
  name: '', role: 'Dependent', roleIdx: 0,
}));
let connectedSlots = new Set();
let pendingSlots = new Set();
let reconnectIntervalId = null;
let queuedCode = null;   // room code entered before peer was ready

// ── Init ──────────────────────────────────────────────────────────────────────

export function init() {
  bc = new BroadcastChannel(BC_CHANNEL);

  peer = new Peer();
  peer.on('open', () => {
    document.getElementById('status-dot').classList.add('online');
    if (queuedCode) { connectToScreens(queuedCode); queuedCode = null; }
  });
  peer.on('error', () => {
    document.getElementById('status-dot').classList.remove('online');
  });

  document.getElementById('target-id').addEventListener('input', e => {
    const val = e.target.value.trim();
    if (!/^\d{4}$/.test(val)) return;
    if (peer.open) {
      connectToScreens(val);
    } else {
      queuedCode = val;   // peer still initialising — connect once it opens
    }
  });

  applyLang();
  renderParticipants();
}

// ── Connection ─────────────────────────────────────────────────────────────────

function peerIdForSlot(base, idx) {
  return idx === 0 ? base : base + idx;
}

function connectToScreens(base) {
  baseId = base;
  clearInterval(reconnectIntervalId);
  connections.forEach(c => { try { c.close(); } catch (_) {} });
  connections = [];
  connectedSlots.clear();
  pendingSlots.clear();
  updateScreensCount();

  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('display-id').textContent = base;

  connectMissing(base);
  reconnectIntervalId = setInterval(() => connectMissing(base), 1500);
}

function connectMissing(base) {
  const count = currentMode === 'grupo' ? SLOT_COUNT : 2;
  for (let i = 0; i < count; i++) {
    if (connectedSlots.has(i) || pendingSlots.has(i)) continue;
    pendingSlots.add(i);
    const pid = peerIdForSlot(base, i);
    const conn = peer.connect(pid, { reliable: true });
    const slotIdx = i;

    // PeerJS sometimes never fires error for unreachable peers — force-clear after 2 s
    const timeout = setTimeout(() => pendingSlots.delete(slotIdx), 2000);

    const clear = () => { clearTimeout(timeout); pendingSlots.delete(slotIdx); };

    conn.on('open', () => {
      clear();
      connections.push(conn);
      connectedSlots.add(slotIdx);
      updateScreensCount();
      updateSlotDot(slotIdx, true);
      sendPayloadTo(conn, buildPayload());
    });
    conn.on('close', () => {
      connections = connections.filter(c => c !== conn);
      connectedSlots.delete(slotIdx);
      updateScreensCount();
      updateSlotDot(slotIdx, false);
      // Reconnect immediately instead of waiting for the next interval tick
      if (baseId) setTimeout(() => connectMissing(baseId), 200);
    });
    conn.on('error', () => {
      clear();
      connectedSlots.delete(slotIdx);
      updateSlotDot(slotIdx, false);
    });
  }
}

function updateScreensCount() {
  const n = connectedSlots.size;
  const t = I18N[currentLang].ui;
  const waiting = baseId && n === 0;
  const el = document.getElementById('screens-count');
  el.textContent = waiting
    ? (currentLang === 'pt' ? 'Aguardando telas…' : 'Waiting for screens…')
    : `${n} ${n === 1 ? t.participant : t.participants}`;
  el.classList.toggle('waiting', waiting);
}

function updateSlotDot(idx, on) {
  const dot = document.getElementById(`sdot-${idx}`);
  if (dot) dot.className = `slot-dot${on ? ' on' : ''}`;
}

// ── Payload ───────────────────────────────────────────────────────────────────

function buildPayload() {
  return {
    mode:      currentMode,
    slots:     slots.map(s => ({ name: s.name, role: s.role, roleIdx: s.roleIdx })),
    left:      slots[0].roleIdx,
    leftName:  slots[0].name,
    right:     slots[1].roleIdx,
    rightName: slots[1].name,
    lang:      currentLang,
  };
}

function sendPayloadTo(conn, payload) {
  try { conn.send(payload); } catch (_) {}
}

export function sendAll() {
  const payload = buildPayload();
  connections.forEach(c => sendPayloadTo(c, payload));
  bc.postMessage(payload);
}

// ── Participants UI ───────────────────────────────────────────────────────────

export function renderParticipants() {
  const row = document.getElementById('participantsRow');
  const count = currentMode === 'dupla' ? 2 : SLOT_COUNT;
  row.className = `participants-row${currentMode === 'grupo' ? ' grupo' : ''}`;
  row.innerHTML = Array.from({ length: count }, (_, i) => cardHTML(i)).join('');
}

function cardHTML(idx) {
  const s = slots[idx];
  const ri = s.roleIdx;
  const t = I18N[currentLang];

  const pills = ROLES.map((r, pi) => `
    <span class="role-pill role-color-${pi}${pi === ri ? ' active' : ''}"
          style="--rc:${ROLE_COLORS[pi]}"
          onclick="window._ctrl.updateSlotRole(${idx}, ${pi})">${t.roles[pi]}</span>`).join('');

  const trackLabels = t.roles.map(r => `<span>${r}</span>`).join('');

  return `
    <div class="p-card" id="pcard-${idx}">
      <div class="p-card-header">
        <div class="slot-dot${connectedSlots.has(idx) ? ' on' : ''}" id="sdot-${idx}"></div>
        <span class="p-slot-num">P${idx + 1}</span>
        <input class="p-name-input" type="text" id="nin-${idx}"
               placeholder="${t.ui.namePlaceholder}" value="${s.name}"
               oninput="window._ctrl.onNameInput(${idx}, this.value)">
      </div>
      <div class="role-selector">
        <div class="active-role-display">
          <div class="active-role-name role-color-${ri}" id="rlabel-${idx}" style="--rc:${ROLE_COLORS[ri]}">
            ${t.roles[ri]}
          </div>
          <span class="active-role-index" id="ridx-${idx}">${ri}/4</span>
        </div>
        <div class="role-track">
          <input type="range" id="rslider-${idx}"
                 min="0" max="4" step="1" value="${ri}"
                 oninput="window._ctrl.updateSlotRole(${idx}, this.value)">
        </div>
        <div class="role-pills" id="rpills-${idx}">${pills}</div>
      </div>
    </div>`;
}

export function updateSlotRole(idx, val) {
  const ri = parseInt(val, 10);
  slots[idx].roleIdx = ri;
  slots[idx].role = ROLES[ri];

  const t = I18N[currentLang];
  const label = document.getElementById(`rlabel-${idx}`);
  const idxEl = document.getElementById(`ridx-${idx}`);
  const slider = document.getElementById(`rslider-${idx}`);
  if (label) {
    label.textContent = t.roles[ri];
    label.className = `active-role-name role-color-${ri}`;
    label.style.setProperty('--rc', ROLE_COLORS[ri]);
  }
  if (idxEl) idxEl.textContent = `${ri}/4`;
  if (slider) slider.value = ri;

  const pillsEl = document.getElementById(`rpills-${idx}`);
  if (pillsEl) {
    pillsEl.querySelectorAll('.role-pill').forEach((p, pi) => {
      p.classList.toggle('active', pi === ri);
    });
  }
  sendAll();
  speakAssignment();
}

export function onNameInput(idx, val) {
  slots[idx].name = val;
  sendAll();
}

// ── Mode & Lang ───────────────────────────────────────────────────────────────

export function setMode(mode) {
  currentMode = mode;
  document.getElementById('btnModeDupla').classList.toggle('active', mode === 'dupla');
  document.getElementById('btnModeGrupo').classList.toggle('active', mode === 'grupo');
  renderParticipants();
  sendAll();
}

export function toggleLang() {
  currentLang = currentLang === 'pt' ? 'en' : 'pt';
  const btn = document.getElementById('langToggleBtn');
  btn.textContent = currentLang.toUpperCase();
  btn.className = `topbar-btn btn-${currentLang}`;
  applyLang();
  renderParticipants();
  sendAll();
}

function applyLang() {
  const t = I18N[currentLang].ui;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
  // Re-apply state-aware texts that may differ from defaults
  const randBtn = document.getElementById('toggleRandomBtn');
  if (randBtn) randBtn.textContent = isRandomRunning ? t.btnStop : t.btnStart;
  const audioBtn = document.getElementById('audioToggleBtn');
  if (audioBtn) audioBtn.textContent = isAudioEnabled ? t.audioOn : t.audioOff;
  updateScreensCount();
}

// ── Audio (control-local TTS only) ────────────────────────────────────────────

let ttsTimer = null;

function getVoice(lang) {
  const voices = window.speechSynthesis.getVoices();
  if (lang === 'pt') {
    return voices.find(v =>
      v.lang.includes('pt') &&
      (v.name.includes('Google') || v.name.includes('Daniel') ||
       v.name.includes('Maria') || v.name.includes('Premium'))
    ) || null;
  }
  return voices.find(v =>
    v.lang.includes('en') &&
    (v.name.includes('Samantha') || v.name.includes('Google'))
  ) || null;
}

function speakAssignment() {
  if (!isAudioEnabled) return;
  clearTimeout(ttsTimer);
  ttsTimer = setTimeout(() => {
    window.speechSynthesis.cancel();
    const t = I18N[currentLang];
    const count = currentMode === 'dupla' ? 2 : SLOT_COUNT;
    const text = slots.slice(0, count)
      .map((s, i) => `${t.ui.participant} ${i + 1}: ${t.roles[s.roleIdx]}`)
      .join('. ');
    const u = new SpeechSynthesisUtterance(text);
    u.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';
    u.volume = 1;
    u.rate = 1.1;
    const voice = getVoice(currentLang);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }, 400);
}

export function toggleAudio() {
  isAudioEnabled = !isAudioEnabled;
  const btn = document.getElementById('audioToggleBtn');
  const t = I18N[currentLang].ui;
  btn.textContent = isAudioEnabled ? t.audioOn : t.audioOff;
  btn.classList.toggle('muted', !isAudioEnabled);
  if (isAudioEnabled) {
    // Unlock speech synthesis with a user gesture and immediately read current assignment
    const silent = new SpeechSynthesisUtterance('');
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
    speakAssignment();
  } else {
    window.speechSynthesis.cancel();
  }
}

// ── Random ────────────────────────────────────────────────────────────────────

function generateRoles() {
  const count = currentMode === 'dupla' ? 2 : SLOT_COUNT;
  const shuffled = [...Array(ROLES.length).keys()].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function nextRandom() {
  historyIdx++;
  if (historyIdx >= history.length) {
    history.push(generateRoles());
  }
  applyRandomAssignment(history[historyIdx]);
}

export function prevRandom() {
  if (historyIdx > 0) {
    historyIdx--;
    applyRandomAssignment(history[historyIdx]);
  }
}

function applyRandomAssignment(assignment) {
  assignment.forEach((ri, i) => {
    if (i < SLOT_COUNT) {
      slots[i].roleIdx = ri;
      slots[i].role = ROLES[ri];
    }
  });
  renderParticipants();
  sendAll();
  speakAssignment();
}

export function toggleRandom() {
  isRandomRunning = !isRandomRunning;
  const btn = document.getElementById('toggleRandomBtn');
  const t = I18N[currentLang].ui;
  btn.textContent = isRandomRunning ? t.btnStop : t.btnStart;
  btn.classList.toggle('running', isRandomRunning);
  clearInterval(intervalId);
  intervalId = null;

  if (isRandomRunning) {
    nextRandom();
    const secs = parseInt(document.getElementById('minInterval').value, 10) || 5;
    intervalId = setInterval(() => nextRandom(), secs * 1000);
  }
}

// ── Monitor ───────────────────────────────────────────────────────────────────

export function openMonitor() {
  window.open('monitor.html', '_blank', 'width=1200,height=700');
}
