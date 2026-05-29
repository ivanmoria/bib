import { ROLES, ROLES_PT, ROLE_COLORS, PANEL_COLORS, CARD_COLORS, I18N } from './roles.js';

// basePath: relative path prefix for IAPS profile links.
// tela.html uses '../'  (Live Server / relative)
// telagrupo.html uses '/IAPS/Autonomy/' (GitHub Pages absolute)
let cfg = { basePath: '../' };

let peer = null;
let mySlotIndex = 0;
let currentLang = 'pt';
let localLangOverride = false;
let controlLang = 'pt';
let isScreenActive = false;
let localMute = true;
let menuTimeout = null;

// Audio state
let audioPlaying = false;
let audioCancelled = false;
let explainAudioActive = false;
let currentCardIdx = -1;

// Last displayed roles (for replay on unmute)
let lastRoles = {};   // { left: ri, right: ri } or { solo: ri }
let rolesTtsTimer = null;

// URL params
const urlParams = new URLSearchParams(window.location.search);
const isPreview = urlParams.has('preview');

export function init(options = {}) {
  Object.assign(cfg, options);

  const myID = urlParams.get('id') ||
    Math.floor(1000 + Math.random() * 9000).toString();
  document.getElementById('peer-id-input').value = myID;

  if (isPreview) {
    document.body.classList.add('is-preview');
  }

  renderWelcomeText();
  renderCards();
  applyLangLabels();

  window.speechSynthesis.onvoiceschanged = () => {};

  // Auto-register with PeerJS so control can find this screen immediately
  setTimeout(() => startConnection(), 400);
}

// ── Language ──────────────────────────────────────────────────────────────────

export function toggleLocalLang() {
  const wasPlaying = audioPlaying;
  const wasCardIdx = currentCardIdx;
  if (wasPlaying) stopAudio();

  currentLang = currentLang === 'pt' ? 'en' : 'pt';
  localLangOverride = currentLang !== controlLang;

  document.getElementById('btn-lang-local').textContent = currentLang.toUpperCase();
  renderWelcomeText();
  renderCards();
  applyLangLabels();

  if (isScreenActive) {
    const leftRoleEl = document.getElementById('left-role');
    const rawRole = leftRoleEl?.dataset.rawRole;
    if (rawRole) updateUI('left', rawRole);
    const rightRoleEl = document.getElementById('right-role');
    const rawRoleR = rightRoleEl?.dataset.rawRole;
    if (rawRoleR) updateUI('right', rawRoleR);
  }

  if (wasPlaying) {
    setTimeout(() => {
      audioCancelled = false;
      audioPlaying = true;
      if (wasCardIdx === -1) {
        toggleAudioDescription();
      } else {
        speakCard(currentLang, wasCardIdx);
      }
    }, 300);
  }
}

export function toggleMute() {
  localMute = !localMute;
  const btn = document.getElementById('btn-mute-local');
  if (localMute) {
    btn.textContent = '🔇';
    btn.classList.remove('active');
    window.speechSynthesis.cancel();
  } else {
    btn.textContent = '🔊';
    btn.classList.add('active');
    // Unlock speech synthesis with a silent utterance (required on iOS)
    const silent = new SpeechSynthesisUtterance('');
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
    // Replay the current role so the user immediately hears something
    if (isScreenActive) speakCurrentRole();
  }
}

// ── PeerJS connection ─────────────────────────────────────────────────────────

export async function startConnection() {
  const myID = document.getElementById('peer-id-input').value;

  // Unlock speech synthesis on iOS
  const silent = new SpeechSynthesisUtterance('');
  silent.volume = 0;
  window.speechSynthesis.speak(silent);

  document.activeElement?.blur();

  if (peer) peer.destroy();

  let connected = false;
  let tries = 0;
  const btn = document.getElementById('btn-connect');
  btn.textContent = '...';

  while (!connected && tries < 10) {
    const candidateId = tries === 0 ? myID : myID + tries;
    connected = await new Promise(resolve => {
      let done = false;
      const finish = result => { if (!done) { done = true; resolve(result); } };

      const newPeer = new Peer(candidateId);
      // Destroy the attempt on timeout so a late-firing 'open' can't
      // overwrite peer after the loop has already moved on.
      const tid = setTimeout(() => { newPeer.destroy(); finish(false); }, 1500);

      newPeer.on('open', () => {
        clearTimeout(tid);
        peer = newPeer;
        mySlotIndex = tries;
        finish(true);
      });
      newPeer.on('error', () => {
        clearTimeout(tid);
        newPeer.destroy();
        finish(false);
      });
    });
    tries++;
  }

  if (peer) {
    btn.textContent = '✓';
    btn.classList.add('connected');
    document.body.classList.add('is-connected');
    // Close gear menu if it was open (user-triggered connect); ignore if already closed
    setTimeout(() => {
      const menu = document.getElementById('peer-info');
      if (menu?.classList.contains('expanded')) {
        menu.classList.remove('expanded');
        clearTimeout(menuTimeout);
      }
    }, 2000);

    peer.on('connection', conn => {
      conn.on('data', msg => handleData(msg));
      conn.on('close', () => {});
    });

    // Auto-recover if the PeerJS server registration drops
    peer.on('disconnected', () => {
      setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 1000);
    });
    peer.on('error', () => {
      btn.classList.remove('connected');
      document.body.classList.remove('is-connected');
    });
  } else {
    btn.textContent = 'Erro';
  }
}

function handleData(data) {
  if (!data) return;
  if (!isPreview && data.targetID && data.targetID !== String(mySlotIndex)) return;

  if (!isScreenActive) {
    isScreenActive = true;
    document.body.classList.add('is-ready');
    if (audioPlaying) stopAudio();
  }

  controlLang = data.lang || 'pt';
  if (!localLangOverride) currentLang = controlLang;

  const mode = data.mode || 'dupla';
  document.body.classList.toggle('is-grupo', mode === 'grupo');
  document.body.classList.toggle('is-dupla', mode === 'dupla');

  if (mode === 'grupo') {
    const slot = data.slots?.[mySlotIndex];
    if (slot) renderSoloView(slot, mySlotIndex);
  } else {
    updateUI('left',  data.left,  data.leftName);
    updateUI('right', data.right, data.rightName);
  }
}

// ── Screen views ──────────────────────────────────────────────────────────────

function updateUI(side, roleIdx, name) {
  const ri = typeof roleIdx === 'number' ? roleIdx : parseInt(roleIdx, 10);
  const t = I18N[currentLang];
  const roleEl = document.getElementById(`${side}-role`);
  const descEl = document.getElementById(`${side}-description`);
  const nameEl = document.getElementById(`${side}-name`);

  if (roleEl) {
    roleEl.textContent = t.roles[ri];
    roleEl.dataset.rawRole = ri;
  }
  if (descEl) descEl.textContent = t.descriptions[ri];
  if (nameEl) nameEl.textContent = name || '';

  const participant = document.getElementById(`${side}-participant`);
  if (participant) participant.style.backgroundColor = PANEL_COLORS[ri];

  lastRoles[side] = ri;
  scheduleSpeakRoles();
}

function renderSoloView(slot, idx) {
  const ri = slot.roleIdx ?? 0;
  const t = I18N[currentLang];

  document.getElementById('solo-num').textContent = `P${idx + 1}`;
  document.getElementById('solo-role').textContent = t.roles[ri];
  document.getElementById('solo-description').textContent = t.descriptions[ri];
  document.getElementById('solo-name').textContent = slot.name || '';

  const container = document.getElementById('solo-container');
  if (container) container.style.backgroundColor = PANEL_COLORS[ri];

  lastRoles.solo = ri;
  scheduleSpeakRoles();
}

// ── Welcome panel ─────────────────────────────────────────────────────────────

function renderWelcomeText(lang) {
  const l = lang || currentLang;
  const t = I18N[l];
  const el = document.getElementById('welcome-text-container');
  if (!el) return;
  el.innerHTML = t.intro.split(' ')
    .map((w, i) => `<span class="word-span" data-idx="${i}">${w}</span>`)
    .join(' ');

  const cardNote = document.getElementById('card-note');
  if (cardNote) cardNote.textContent = t.cardNote;
}

function renderCards(lang) {
  const l = lang || currentLang;
  const t = I18N[l];
  const grid = document.getElementById('info-grid');
  if (!grid) return;

  grid.innerHTML = ROLES.map((role, i) => `
    <div class="info-card" id="card-${role}"
         style="--card-color:${CARD_COLORS[role]}"
         onclick="window._tela.jumpToCard(${i})">
      <div class="card-number">0${i + 1}</div>
      <h4>${t.roles[i]}</h4>
      <div class="card-accent-bar"></div>
      <p>${t.cardTexts[i]}</p>
      <a class="card-link"
         href="${cfg.basePath}${role.toLowerCase()}.html"
         onclick="event.stopPropagation()">
        ${t.learnMore}
      </a>
    </div>`).join('');

  const iapsLabel = document.getElementById('btn-iaps-label');
  if (iapsLabel) {
    iapsLabel.querySelector('.btn-iaps-label-pt').textContent = I18N.pt.iapsRef;
    iapsLabel.querySelector('.btn-iaps-label-en').textContent = I18N.en.iapsRef;
  }
}

function applyLangLabels() {
  const t = I18N[currentLang];
  const titleEl = document.getElementById('t-title');
  const subtitleEl = document.getElementById('t-subtitle');
  const audioTextEl = document.getElementById('audio-text');
  if (titleEl) titleEl.textContent = t.title;
  if (subtitleEl) subtitleEl.textContent = t.subtitle;
  if (audioTextEl) audioTextEl.textContent = audioPlaying ? t.stopBtn : t.listenBtn;
}

// ── Gear menu ─────────────────────────────────────────────────────────────────

export function toggleMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('peer-info');
  menu.classList.toggle('expanded');
  if (menu.classList.contains('expanded')) resetMenuTimer();
}

function resetMenuTimer() {
  clearTimeout(menuTimeout);
  menuTimeout = setTimeout(() => {
    document.getElementById('peer-info')?.classList.remove('expanded');
  }, 4000);
}

document.addEventListener('click', () => {
  const menu = document.getElementById('peer-info');
  if (menu?.classList.contains('expanded')) {
    menu.classList.remove('expanded');
    clearTimeout(menuTimeout);
  }
});

// ── Audio / TTS ───────────────────────────────────────────────────────────────

// Debounced so left+right updates in dupla arrive together before speaking
function scheduleSpeakRoles() {
  if (localMute || audioPlaying) return;
  clearTimeout(rolesTtsTimer);
  rolesTtsTimer = setTimeout(() => {
    window.speechSynthesis.cancel();
    const t = I18N[currentLang];
    let text;
    if ('solo' in lastRoles) {
      text = `${t.ui.participant} ${mySlotIndex + 1}: ${t.roles[lastRoles.solo]}`;
    } else {
      const parts = [];
      if (lastRoles.left  !== undefined) parts.push(`${t.ui.participant} 1: ${t.roles[lastRoles.left]}`);
      if (lastRoles.right !== undefined) parts.push(`${t.ui.participant} 2: ${t.roles[lastRoles.right]}`);
      text = parts.join('. ');
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = currentLang === 'pt' ? 'pt-BR' : 'en-US';
    u.volume = 1;
    u.rate = 1.1;
    const voice = getVoice(currentLang);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }, 80);
}

function speakCurrentRole() {
  scheduleSpeakRoles();
}

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

function utterance(text, lang, onBoundary, onEnd) {
  if (audioCancelled) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
  u.volume = (!localMute || explainAudioActive) ? 1 : 0;
  u.rate = 1.05;
  u.pitch = 1;
  if (onBoundary) u.onboundary = onBoundary;
  const voice = getVoice(lang);
  if (voice) u.voice = voice;
  u.onend = () => { if (!audioCancelled) onEnd(); };
  u.onerror = () => { if (!audioCancelled) onEnd(); };
  window.speechSynthesis.speak(u);
}

export function toggleAudioDescription() {
  if (audioPlaying) { stopAudio(); return; }

  currentCardIdx = -1;
  audioCancelled = false;
  audioPlaying = true;
  explainAudioActive = true;

  document.getElementById('btn-master-audio')?.classList.add('playing');
  document.getElementById('audio-text').textContent = I18N[currentLang].stopBtn;

  const lang = currentLang;
  const words = Array.from(document.querySelectorAll('.word-span'));
  words.forEach(w => w.classList.remove('word-active', 'word-past'));

  utterance(
    I18N[lang].intro, lang,
    e => {
      if (audioCancelled || e.name !== 'word') return;
      const wordIdx = I18N[lang].intro.substring(0, e.charIndex).split(' ').length - 1;
      words.forEach((w, i) => {
        w.classList.remove('word-active', 'word-past');
        if (i < wordIdx) w.classList.add('word-past');
        else if (i === wordIdx) w.classList.add('word-active');
      });
    },
    () => {
      words.forEach(w => {
        w.classList.remove('word-active');
        w.classList.add('word-past');
      });
      speakCard(lang, 0);
    }
  );
}

function speakCard(lang, idx) {
  if (audioCancelled || idx >= ROLES.length) { stopAudio(); return; }
  currentCardIdx = idx;

  document.querySelectorAll('.info-card').forEach(c => c.classList.remove('card-active'));
  const card = document.getElementById('card-' + ROLES[idx]);
  if (card) {
    card.classList.add('card-active');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  utterance(
    I18N[lang].cardTexts[idx], lang, null,
    () => setTimeout(() => speakCard(lang, idx + 1), 250)
  );
}

export function jumpToCard(idx) {
  if (!audioPlaying) return;
  audioCancelled = true;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    audioCancelled = false;
    speakCard(currentLang, idx);
  }, 80);
}

function stopAudio() {
  audioCancelled = true;
  audioPlaying = false;
  explainAudioActive = false;
  window.speechSynthesis.cancel();

  document.getElementById('btn-master-audio')?.classList.remove('playing');
  document.getElementById('audio-text').textContent = I18N[currentLang].listenBtn;

  document.querySelectorAll('.word-span').forEach(w =>
    w.classList.remove('word-active', 'word-past'));
  document.querySelectorAll('.info-card').forEach(c =>
    c.classList.remove('card-active'));
}
