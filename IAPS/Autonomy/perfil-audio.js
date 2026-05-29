// ══════════════════════════════════════════════════
//  PERFIL AUDIO ENGINE  v5  —  Audiodescritivo / Acessível
//
//  Lê TODO o conteúdo da página em sequência:
//    título, lead, seções, prose (palavra a palavra),
//    citação, cards, referências, perguntas de reflexão.
//
//  • Clique em qualquer elemento legível → pula para ali (só se play ativo)
//  • Lang switch → continua do mesmo segmento, sem reiniciar
//  • Pause/Resume, Mute
//  • ARIA live region anuncia o segmento atual para leitores de tela
//  • tabindex=0 + role=button em todos os elementos clicáveis
// ══════════════════════════════════════════════════

(function () {

  // ══ STATE ══════════════════════════════════════
  let audioPlaying   = false;
  let audioPaused    = false;
  let audioCancelled = false;
  let langSwitching  = false;
  let localMute      = false;
  let currentSegIdx  = -1;
  let segments       = [];   // built on play / lang switch
  let currentLang    = document.body.classList.contains('lang-en') ? 'en' : 'pt';

  // ══ ARIA LIVE REGION ════════════════════════════
  let ariaLive;
  function ensureAriaLive() {
    if (ariaLive) return;
    ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.setAttribute('aria-atomic', 'true');
    Object.assign(ariaLive.style, {
      position:'absolute', width:'1px', height:'1px',
      overflow:'hidden', clip:'rect(0,0,0,0)', whiteSpace:'nowrap'
    });
    document.body.appendChild(ariaLive);
  }
  function announceAria(text) {
    ensureAriaLive();
    ariaLive.textContent = '';
    requestAnimationFrame(() => { ariaLive.textContent = text; });
  }

  // ══ VOICE ═══════════════════════════════════════
  function getVoice(lang) {
    const voices = window.speechSynthesis.getVoices();
    return lang === 'pt'
      ? voices.find(v => v.lang.includes('pt-BR') &&
          (v.name.includes('Google') || v.name.includes('Premium') ||
           v.name.includes('Daniel') || v.name.includes('Maria'))) || null
      : voices.find(v => v.lang.includes('en-US') &&
          (v.name.includes('Google') || v.name.includes('Samantha'))) || null;
  }

  // ══ CORE UTTERANCE ══════════════════════════════
  function speak(text, lang, onBoundary, onEnd) {
    if (audioCancelled) return;
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang   = lang === 'pt' ? 'pt-BR' : 'en-US';
    msg.rate   = 1.0; msg.pitch = 1.0;
    msg.volume = localMute ? 0 : 1.0;
    const v = getVoice(lang); if (v) msg.voice = v;
    if (onBoundary) msg.onboundary = onBoundary;
    msg.onend  = () => { if (!audioCancelled && !langSwitching) onEnd(); };
    msg.onerror = e => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      if (!audioCancelled && !langSwitching) onEnd();
    };
    window.speechSynthesis.speak(msg);
  }

  // ══ BUTTON STATE ════════════════════════════════
  function updateButtons() {
    const play   = document.getElementById('btn-audio-read');
    const pause  = document.getElementById('btn-audio-pause');
    const iPlay  = document.getElementById('icon-play');
    const iStop  = document.getElementById('icon-stop');
    const iPause = document.getElementById('icon-pause');
    const iRes   = document.getElementById('icon-resume');
    if (!play) return;

    if (audioPlaying) {
      play.classList.add('playing');
      play.setAttribute('aria-label', currentLang === 'pt' ? 'Parar leitura' : 'Stop reading');
      if (iPlay) iPlay.style.display = 'none';
      if (iStop) iStop.style.display = '';
      if (pause) {
        pause.style.display = 'flex';
        if (audioPaused) {
          pause.classList.remove('playing'); pause.classList.add('paused');
          pause.setAttribute('aria-label', currentLang === 'pt' ? 'Retomar leitura' : 'Resume reading');
          if (iPause) iPause.style.display = 'none';
          if (iRes)   iRes.style.display   = '';
        } else {
          pause.classList.add('playing'); pause.classList.remove('paused');
          pause.setAttribute('aria-label', currentLang === 'pt' ? 'Pausar leitura' : 'Pause reading');
          if (iPause) iPause.style.display = '';
          if (iRes)   iRes.style.display   = 'none';
        }
      }
    } else {
      play.classList.remove('playing', 'paused');
      play.setAttribute('aria-label', currentLang === 'pt' ? 'Iniciar leitura' : 'Start reading');
      if (iPlay) iPlay.style.display = '';
      if (iStop) iStop.style.display = 'none';
      if (pause) {
        pause.style.display = 'none';
        pause.classList.remove('playing', 'paused');
      }
    }
  }

  // ══ HIGHLIGHT ═══════════════════════════════════
  function clearAllHighlights() {
    document.querySelectorAll('.audio-active').forEach(el => {
      el.classList.remove('audio-active');
    });
    document.querySelectorAll('.word-span').forEach(s =>
      s.classList.remove('word-active', 'word-past')
    );
  }

  function highlightSegment(el) {
    clearAllHighlights();
    if (!el) return;
    el.classList.add('audio-active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ══ BUILD SEGMENTS ══════════════════════════════
  // Walks the page and collects every readable element in order.

  // Extract text for the active lang from an element that may contain
  // [data-lang] children — never grabs both langs at once.
  function langText(el, lang) {
    if (!el) return '';
    // Only look at direct children — avoids recursing into nested [data-lang] blocks.
    // CSS hides the inactive lang span, but innerText on a hidden element returns ''
    // in most browsers. We use textContent as fallback to be safe.
    const span = el.querySelector(`:scope > [data-lang="${lang}"]`);
    if (span) return (span.innerText || span.textContent || '').replace(/\s+/g, ' ').trim();
    // Element has no lang children — it is lang-neutral (hero-number, cite, etc.)
    return el.innerText.replace(/\s+/g, ' ').trim();
  }

  function buildSegments(lang) {
    const segs = [];

    function add(type, el, text) {
      if (!text || !text.trim()) return;
      segs.push({ type, el, text: text.trim() });
    }

    // ── Hero ──────────────────────────────────────
    const heroNum = document.querySelector('.hero-number');
    if (heroNum) add('hero-num', heroNum, heroNum.innerText.replace(/\s+/g, ' ').trim());

    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) add('title', heroTitle, langText(heroTitle, lang));

    const heroLead = document.querySelector('.hero-lead');
    if (heroLead) add('lead', heroLead, langText(heroLead, lang));

    // ── Sections ─────────────────────────────────
    document.querySelectorAll('.section').forEach(section => {

      // Section title
      const secTitle = section.querySelector('.section-title');
      if (secTitle) add('section-title', secTitle, langText(secTitle, lang));

      // Prose paragraphs — word-by-word
      const proseBlock = section.querySelector(`.prose [data-lang="${lang}"]`);
      if (proseBlock) {
        proseBlock.querySelectorAll('p').forEach(p => {
          add('prose-p', p, p.innerText.replace(/\s+/g, ' ').trim());
        });
      }

      // Pull-quote
      const quote = section.querySelector(`blockquote[data-lang="${lang}"]`);
      if (quote) {
        const prefix = lang === 'pt' ? 'Citação: ' : 'Quote: ';
        add('quote', quote, prefix + quote.innerText.replace(/\s+/g, ' ').trim());
      }
      const cite = section.querySelector('cite');
      if (cite) add('cite', cite, cite.innerText.replace(/\s+/g, ' ').trim());

      // Example cards
      const grid = section.querySelector(`.examples-grid[data-lang="${lang}"]`);
      if (grid) {
        grid.querySelectorAll('.example-card').forEach((card, i) => {
          const tag  = card.querySelector('.example-tag')?.innerText?.trim() || '';
          const body = card.querySelector('p')?.innerText?.trim() || '';
          const prefix = lang === 'pt' ? `Exemplo ${i+1}. ` : `Example ${i+1}. `;
          add('card', card, `${prefix}${tag}. ${body}`);
        });
      }

      // References
      const refList = section.querySelector(`ul.ref-list[data-lang="${lang}"]`);
      if (refList) {
        add('ref-heading', null,
          lang === 'pt' ? 'Referências bibliográficas.' : 'Bibliographic references.');
        refList.querySelectorAll('li').forEach(li => {
          add('ref-item', li, li.innerText.replace(/\s+/g, ' ').trim());
        });
      }

      // Reflection questions
      const reflList = section.querySelector(`ol.reflection-questions[data-lang="${lang}"]`);
      if (reflList) {
        add('refl-heading', null,
          lang === 'pt' ? 'Exercício de reflexão.' : 'Reflection exercise.');
        reflList.querySelectorAll('li').forEach((li, i) => {
          const prefix = lang === 'pt' ? `Pergunta ${i+1}: ` : `Question ${i+1}: `;
          add('refl-item', li, prefix + li.innerText.replace(/\s+/g, ' ').trim());
        });
      }
    });

    return segs;
  }

  // ══ WORD WRAP ═══════════════════════════════════
  function wrapParagraphWords(p) {
    if (p.dataset.wordWrapped) return;
    const words = p.innerText.replace(/\s+/g, ' ').trim().split(' ');
    p.innerHTML = words.map((w, i) =>
      `<span class="word-span" data-wi="${i}">${w}</span>`
    ).join(' ');
    p.dataset.wordWrapped = '1';

    p.querySelectorAll('.word-span').forEach(span => {
      span.setAttribute('tabindex', '0');
      span.setAttribute('role', 'button');
      span.setAttribute('aria-label', span.textContent);
      span.addEventListener('click', e => {
        e.stopPropagation();
        if (!audioPlaying || audioPaused) return;
        seekToWord(p, parseInt(span.dataset.wi, 10));
      });
      span.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); span.click(); }
      });
    });
  }

  // ══ SPEAK ONE SEGMENT ═══════════════════════════
  function speakSegment(idx) {
    if (audioCancelled || idx >= segments.length) {
      stopAudio(); return;
    }

    currentSegIdx = idx;
    const seg = segments[idx];

    highlightSegment(seg.el);
    announceAria(seg.text);

    if (seg.type === 'prose-p') {
      wrapParagraphWords(seg.el);
      const spans = Array.from(seg.el.querySelectorAll('.word-span'));

      speak(seg.text, currentLang,
        evt => {
          if (audioCancelled || langSwitching || evt.name !== 'word') return;
          const before = seg.text.substring(0, evt.charIndex);
          const wi = before.split(/\s+/).filter(Boolean).length;
          spans.forEach((s, i) => {
            s.classList.remove('word-active', 'word-past');
            if (i < wi) s.classList.add('word-past');
            else if (i === wi) s.classList.add('word-active');
          });
        },
        () => {
          spans.forEach(s => { s.classList.remove('word-active'); s.classList.add('word-past'); });
          setTimeout(() => speakSegment(idx + 1), 250);
        }
      );

    } else {
      const gap = seg.type === 'section-title' ? 400 : 200;
      speak(seg.text, currentLang, null,
        () => setTimeout(() => speakSegment(idx + 1), gap)
      );
    }
  }

  // ══ STOP ════════════════════════════════════════
  function stopAudio() {
    audioCancelled = true; audioPlaying = false; audioPaused = false;
    window.speechSynthesis.cancel();
    clearAllHighlights();
    updateButtons();
  }

  // ══ CANCEL + RESUME HELPER ══════════════════════
  function cancelAndRun(fn) {
    langSwitching = true;
    window.speechSynthesis.cancel();
    langSwitching = false;
    audioCancelled = false;
    clearAllHighlights();
    setTimeout(fn, 80);
  }

  // ══ SEEK: jump to any segment by element ════════
  function seekToSegmentEl(el) {
    if (!audioPlaying || audioPaused) return;
    const idx = segments.findIndex(s => s.el === el);
    if (idx === -1) return;
    cancelAndRun(() => speakSegment(idx));
  }

  // ══ SEEK: jump to word inside a prose paragraph ═
  function seekToWord(paragraphEl, targetWi) {
    if (!audioPlaying || audioPaused) return;
    const idx = segments.findIndex(s => s.el === paragraphEl);
    if (idx === -1) return;

    cancelAndRun(() => {
      currentSegIdx = idx;
      const seg = segments[idx];
      highlightSegment(seg.el);
      wrapParagraphWords(seg.el);

      const spans = Array.from(seg.el.querySelectorAll('.word-span'));
      const words = seg.text.split(/\s+/);
      const remaining = words.slice(targetWi).join(' ');

      spans.forEach((s, i) => {
        s.classList.remove('word-active', 'word-past');
        if (i < targetWi) s.classList.add('word-past');
      });

      if (!remaining) { speakSegment(idx + 1); return; }

      speak(remaining, currentLang,
        evt => {
          if (audioCancelled || langSwitching || evt.name !== 'word') return;
          const before = remaining.substring(0, evt.charIndex);
          const rel = before.split(/\s+/).filter(Boolean).length;
          const wi = targetWi + rel;
          spans.forEach((s, i) => {
            s.classList.remove('word-active', 'word-past');
            if (i < wi) s.classList.add('word-past');
            else if (i === wi) s.classList.add('word-active');
          });
        },
        () => {
          spans.forEach(s => { s.classList.remove('word-active'); s.classList.add('word-past'); });
          setTimeout(() => speakSegment(idx + 1), 250);
        }
      );
    });
  }

  // ══ ATTACH CLICK HANDLERS ═══════════════════════
  function attachClickHandlers() {
    segments.forEach(seg => {
      if (!seg.el) return;
      // Already bound for this lang — skip
      if (seg.el.dataset.audioBound === currentLang) return;
      // Was bound for a different lang — clone to strip old listeners
      if (seg.el.dataset.audioBound) {
        const fresh = seg.el.cloneNode(true);
        seg.el.parentNode.replaceChild(fresh, seg.el);
        seg.el = fresh;
      }
      seg.el.dataset.audioBound = currentLang;

      if (!seg.el.hasAttribute('tabindex')) seg.el.setAttribute('tabindex', '0');
      if (!seg.el.hasAttribute('role'))     seg.el.setAttribute('role', 'button');
      seg.el.setAttribute('aria-label',
        (currentLang === 'pt' ? 'Clique para ouvir: ' : 'Click to hear: ') + seg.text
      );
      seg.el.style.cursor = 'pointer';

      seg.el.addEventListener('click', () => seekToSegmentEl(seg.el));
      seg.el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seg.el.click(); }
      });
    });
  }

  // ══ PUBLIC: PLAY / STOP ═════════════════════════
  window.toggleAudioRead = function () {
    if (audioPlaying) { stopAudio(); return; }

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => window.toggleAudioRead();
      return;
    }

    segments = buildSegments(currentLang);
    audioCancelled = false; audioPlaying = true; audioPaused = false;
    clearAllHighlights();
    updateButtons();
    attachClickHandlers();
    speakSegment(0);
  };

  // ══ PUBLIC: PAUSE / RESUME ═══════════════════════
  window.togglePause = function () {
    if (!audioPlaying || audioPaused) return;
    if (!audioPaused) {
      audioPaused = true;
      window.speechSynthesis.pause();
    } else {
      audioPaused = false;
      window.speechSynthesis.resume();
    }
    updateButtons();
  };

  // ══ PUBLIC: MUTE ════════════════════════════════
  window.toggleMuteRead = function () {
    localMute = !localMute;
    const btn = document.getElementById('btn-mute-read');
    if (localMute) {
      if (btn) { btn.textContent = '🔇'; btn.classList.add('active'); }
      if (window.speechSynthesis.speaking) window.speechSynthesis.pause();
    } else {
      if (btn) { btn.textContent = '🔊'; btn.classList.remove('active'); }
      if (audioPlaying && window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
  };

  // ══ PUBLIC: LANG SWITCH ══════════════════════════
  window.onLangSwitch = function (newLang) {
    if (newLang === currentLang) return;

    const wasActive = audioPlaying;
    const wasPaused = audioPaused;
    const resumeIdx = currentSegIdx;

    currentLang = newLang;

    if (!wasActive) {
      clearAllHighlights();
      segments = [];
      updateButtons();
      return;
    }

    langSwitching  = true;
    audioCancelled = true;
    audioPlaying   = false;
    audioPaused    = false;
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    clearAllHighlights();
    updateButtons();

    segments = buildSegments(newLang);
    attachClickHandlers();

    if (wasPaused) {
      langSwitching = false;
      return;
    }

    setTimeout(() => {
      langSwitching  = false;
      audioCancelled = false;
      audioPlaying   = true;
      audioPaused    = false;
      updateButtons();
      const idx = Math.max(0, Math.min(resumeIdx, segments.length - 1));
      speakSegment(idx);
    }, 350);
  };

  // ══ INIT ════════════════════════════════════════
  window.speechSynthesis.getVoices();
  if (speechSynthesis.onvoiceschanged !== undefined)
    speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

  document.addEventListener('DOMContentLoaded', () => {
    updateButtons();
    ensureAriaLive();
  });

})();
