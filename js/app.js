// App principal: pantallas, progreso, conexión del teclado y celebración.

const App = (() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const MODES = {
    listen: { title: '🔊 Escuchar', hint: 'Escucha y mira las teclas que se iluminan. Toca la pantalla para pausar.', practice: false },
    rh:     { title: '👉 Mano derecha', hint: 'Toca en tu piano las teclas verdes. Sin prisa: te esperan.', practice: true },
    lh:     { title: '👈 Mano izquierda', hint: 'Ahora las moradas. Sin prisa: te esperan.', practice: true },
    both:   { title: '✨ ¡Las dos manos!', hint: '¡Verdes y moradas juntas! Tú puedes.', practice: true },
    free:   { title: '🎵 ¡Toca libre!', hint: '¡Ahora la música no se para! Toca cada nota cuando su rectángulo cruce la línea dorada. Cambia la velocidad con el botón de arriba.', practice: true },
  };
  const NEXT = { rh: 'lh', lh: 'both', both: 'free' };
  const NEXT_LABEL = { rh: '👈 Mano izquierda', lh: '✨ ¡Las dos manos!', both: '🎵 ¡Toca libre!' };

  // Velocidad de la canción: multiplicador del tempo
  const SPEEDS = [
    { v: 0.7, icon: '🐢', label: 'Lenta' },
    { v: 1,   icon: '😊', label: 'Normal' },
    { v: 1.4, icon: '🐇', label: 'Rápida' },
  ];

  let song = SONGS[0];
  let currentMode = null;
  let devMode = false;
  let wakeLock = null;
  let echoVoices = new Map();

  // ── progreso (localStorage) ──
  const PKEY = 'simple-piano-progress-v1';
  const SKEY = 'simple-piano-settings-v1';
  let progress = {};
  let settings = { echo: false, speed: 1, songId: SONGS[0].id };
  try { progress = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { progress = {}; }
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) { /* ignore */ }
  if (!SPEEDS.some((s) => s.v === settings.speed)) settings.speed = 1;   // valor desconocido → normal
  song = SONGS.find((s) => s.id === settings.songId) || SONGS[0];

  function saveProgress() { try { localStorage.setItem(PKEY, JSON.stringify(progress)); } catch (e) { /* ignore */ } }
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  function starsOf(mode) {
    const s = progress[song.id] || {};
    return s[mode] ? s[mode].stars : 0;
  }
  function setStars(mode, stars) {
    if (!progress[song.id]) progress[song.id] = {};
    const prev = progress[song.id][mode];
    if (!prev || stars > prev.stars) {
      progress[song.id][mode] = { stars, date: new Date().toISOString() };
      saveProgress();
    }
  }

  // ── eco del teclado (si el teclado no suena por sí solo) ──
  function applyEcho() {
    AudioEngine.setEcho(settings.echo);
    ['#set-echo', '#connect-echo'].forEach((sel) => {
      const cb = $(sel);
      if (cb) cb.checked = settings.echo;
    });
  }

  // ── velocidad de la canción (🐢 lenta · 😊 normal · 🐇 rápida) ──
  function speedPreset() { return SPEEDS.find((s) => s.v === settings.speed) || SPEEDS[1]; }

  function updateSpeedUI() {
    const p = speedPreset();
    $$('.speed-btn').forEach((b) => b.classList.toggle('on', +b.dataset.speed === settings.speed));
    const btn = $('#btn-speed');
    if (btn) { btn.textContent = p.icon; btn.title = `Velocidad: ${p.label}`; }
  }

  function applySpeed(v) {
    settings.speed = v;
    saveSettings();
    Game.setSpeed(v);
    updateSpeedUI();
    if (!$('#screen-game').classList.contains('hidden')) {
      const p = speedPreset();
      showHint(`Velocidad: ${p.icon} ${p.label}`);
    }
  }

  // ── ciclo de vida ──
  function init() {
    applyEcho();
    updateSpeedUI();
    AudioEngine.unlockOnGesture();

    MIDI.init();
    MIDI.on(onMidiEvent);

    bindUI();
    registerSW();
    renderHome();
  }

  function onMidiEvent(type, note, vel) {
    if (type === 'status') { updateChip(); updateConnectLive(); return; }
    route(type, note, vel);
  }

  // TODAS las notas (teclado real o teclas de prueba) pasan por aquí
  function route(type, note, vel) {
    if (type === 'noteon') {
      if (AudioEngine.echo) {
        const old = echoVoices.get(note);
        if (old) old.stop();
        echoVoices.set(note, AudioEngine.playNote(note, { vel: vel || 100 }));
      }
      Game.noteon(note, vel);
      connectTestNote(note);
    } else {
      const v = echoVoices.get(note);
      if (v) v.stop();
      echoVoices.delete(note);
      Game.noteoff(note);
    }
  }

  // ── pantallas ──
  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== `screen-${name}`));
  }

  function selectSong(id) {
    const found = SONGS.find((s) => s.id === id);
    if (!found) return;
    song = found;
    settings.songId = song.id;
    saveSettings();
    renderHome();
  }

  function renderHome() {
    updateChip();
    $('#song-title').textContent = `${song.emoji} ${song.title}`;
    $('#song-sub').textContent = [song.composer, song.subtitle].filter(Boolean).join(' · ');
    const picker = $('#song-picker');
    if (picker) {
      picker.classList.toggle('hidden', SONGS.length <= 1);
      picker.innerHTML = '';
      SONGS.forEach((s) => {
        const b = document.createElement('button');
        b.className = 'song-tab' + (s.id === song.id ? ' on' : '');
        const done = progress[s.id] && progress[s.id].free ? ' ⭐' : '';
        b.textContent = `${s.emoji} ${s.title}${done}`;
        b.addEventListener('click', () => { AudioEngine.sfx('tap'); selectSong(s.id); });
        picker.appendChild(b);
      });
    }
    const fill = (mode) => {
      const s = starsOf(mode);
      return s ? '⭐'.repeat(s) : '☆☆☆';
    };
    const q = (mode) => {
      const s = progress[song.id];
      return mode === 'listen' && s && s.listen ? ' ✅' : '';
    };
    $('#stars-rh').textContent = fill('rh');
    $('#stars-lh').textContent = fill('lh');
    $('#stars-both').textContent = fill('both');
    $('#stars-free').textContent = fill('free');
    $('#done-listen').textContent = q('listen');
  }

  function updateChip() {
    const chip = $('#midi-chip');
    const st = MIDI.state;
    let txt, cls;
    if (st.supported === false) { txt = '⚠️ Abre la app con Chrome'; cls = 'chip-warn'; }
    else if (st.device && st.ready) { txt = `🎹 ${st.lastName || 'Teclado'} listo`; cls = 'chip-ok'; }
    else if (st.device) { txt = '🎹 Conectado · toca una tecla'; cls = 'chip-mid'; }
    else { txt = '🔌 Conecta el teclado'; cls = 'chip-off'; }
    chip.textContent = txt;
    chip.className = `chip ${cls}`;
  }

  // ── empezar un modo ──
  function startMode(mode) {
    currentMode = mode;
    const m = MODES[mode];
    if (m.practice && !MIDI.state.device && !devMode) {
      showConnect();
      return;
    }
    launchGame();
  }

  function launchGame() {
    const m = MODES[currentMode];
    showScreen('game');
    $('#game-title').textContent = `${song.emoji} ${song.title} · ${m.title}`;
    $('#bar-fill').style.width = '0%';
    $('#game-text').textContent = '¡Preparada!';
    requestWakeLock();
    Game.start(song, currentMode, {
      progress: (frac, meas, beat, idx, total, errors) => {
        $('#bar-fill').style.width = `${(frac * 100).toFixed(1)}%`;
        const totalMeas = song.totalBeats / song.beatsPerMeasure;
        const head = `Compás ${Math.min(totalMeas, meas)}/${totalMeas}`;
        $('#game-text').textContent =
          currentMode === 'listen' ? head
          : currentMode === 'free' ? `${head} · 🎵 ${idx}/${total}`
          : `${head} · Nota ${idx}/${total}`;
      },
      finish: onFinish,
    }, settings.speed);
    showHint(m.hint);
  }

  let hintTimer = 0;
  function showHint(text) {
    const el = $('#game-hint');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove('show'), 6000);
  }

  function onFinish(res) {
    releaseWakeLock();
    if (res.listen) {
      const s = progress[song.id] = progress[song.id] || {};
      s.listen = true; saveProgress();
      showScreen('home'); renderHome();
      AudioEngine.sfx('win');
      return;
    }
    // estrellas (cero castigo, siempre se gana):
    // · fases con espera: 0 ayuditas = 3 · ≤3 = 2 · resto 1
    // · fase libre: ≥85% de notas = 3 · ≥55% = 2 · resto 1
    let stars, stats;
    if (res.free) {
      const pct = res.total ? res.hits / res.total : 0;
      stars = pct >= 0.85 ? 3 : pct >= 0.55 ? 2 : 1;
      stats = res.wrong === 0
        ? `¡Tocaste ${res.hits} de ${res.total} notas y ninguna fuera de su sitio!`
        : `¡Tocaste ${res.hits} de ${res.total} notas! (${res.wrong} notitas fuera de su rectángulo)`;
    } else {
      stars = res.errors === 0 ? 3 : res.errors <= 3 ? 2 : 1;
      stats = res.errors === 0
        ? '¡Perfecto, sin ninguna ayudita!'
        : `Sólo ${res.errors} ayudita${res.errors > 1 ? 's' : ''} — ¡repite y a por las 3 estrellas!`;
    }
    setStars(currentMode, stars);
    AudioEngine.sfx('win');

    $('#win-title').textContent = ['¡LO CONSEGUISTE!', '¡MUY BIEN!', '¡GENIAL!'][Math.min(2, Math.floor(Math.random() * 3))];
    $$('#win-stars .star').forEach((el, i) => {
      el.classList.toggle('on', i < stars);
      el.classList.remove('pop');
      if (i < stars) { void el.offsetWidth; el.classList.add('pop'); }
    });
    $('#win-stats').textContent = stats;
    const next = NEXT[currentMode];
    const btn = $('#win-next');
    if (next) { btn.classList.remove('hidden'); btn.textContent = `Siguiente: ${NEXT_LABEL[currentMode]}`; }
    else btn.classList.add('hidden');

    $('#win-mode').value = currentMode;
    showOverlay('#win-overlay');
    confetti();
  }

  // ── overlay de conexión del teclado ──
  function showConnect() {
    showOverlay('#connect-overlay');
    $('#connect-last-note').textContent = '';
    updateConnectLive();
  }
  function updateConnectLive() {
    if ($('#connect-overlay').classList.contains('hidden')) return;
    const el = $('#connect-status');
    const st = MIDI.state;
    const startBtn = $('#connect-start');
    let html;
    if (st.supported === false) {
      html = '⚠️ Este navegador no lee teclados MIDI.<br>Abre Simple Piano con <b>Chrome</b> y prueba otra vez.';
    } else if (st.ready) {
      html = `✅ ¡Perfecto! <b>${st.lastName || 'Teclado'}</b> conectado y sonando.`;
    } else if (st.device) {
      html = `🎹 Teclado detectado (<b>${st.lastName || 'ok'}</b>).<br>¡Toca cualquier tecla para probar!`;
    } else {
      html = '🔌 Esperando… Conecta el cable USB y enciende el teclado.<br><small>En el teclado, si hay menú USB, elige <b>MIDI</b>.</small>';
    }
    el.innerHTML = html;
    const canStart = st.device || devMode;
    startBtn.disabled = !canStart;
    startBtn.textContent = devMode ? '¡A jugar! (modo prueba)' : canStart ? '¡A jugar! 🎹' : 'Esperando teclado…';
  }

  function connectTestNote(midi) {
    if ($('#connect-overlay').classList.contains('hidden')) return;
    const el = $('#connect-last-note');
    el.textContent = `${midiToName(midi)} 🎉`;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  // ── confeti ──
  function confetti() {
    const host = $('#win-overlay');
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = ['#ffd166', '#22c55e', '#6366f1', '#ec4899', '#38bdf8'][i % 5];
      c.style.animationDelay = `${Math.random() * 1.2}s`;
      c.style.animationDuration = `${2 + Math.random() * 1.6}s`;
      const s = 6 + Math.random() * 7;
      c.style.width = `${s}px`; c.style.height = `${s * 0.6}px`;
      host.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }

  // ── mantener la pantalla encendida mientras se juega ──
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* ignore */ }
  }
  function releaseWakeLock() {
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) { /* ignore */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !$('#screen-game').classList.contains('hidden')) requestWakeLock();
  });

  // ── service worker (instalable / offline) ──
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
    }
  }

  // ── UI ──
  function showOverlay(sel) { $(sel).classList.remove('hidden'); }
  function hideOverlay(sel) { $(sel).classList.add('hidden'); }

  function bindUI() {
    $('#midi-chip').addEventListener('click', showConnect);
    $('#btn-help').addEventListener('click', showConnect);

    $$('.mode-btn').forEach((b) => b.addEventListener('click', () => {
      AudioEngine.sfx('tap');
      startMode(b.dataset.mode);
    }));

    $('#btn-back').addEventListener('click', () => {
      Game.stop(); releaseWakeLock(); hideOverlay('#win-overlay');
      showScreen('home'); renderHome();
    });
    $('#btn-fs').addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          try { await screen.orientation.lock('landscape'); } catch (e) { /* ignore */ }
        } else await document.exitFullscreen();
      } catch (e) { /* ignore */ }
    });

    $('#stage').addEventListener('pointerdown', () => Game.tap());

    // velocidad de la canción
    $$('.speed-btn').forEach((b) => b.addEventListener('click', () => {
      AudioEngine.sfx('tap');
      applySpeed(+b.dataset.speed);
    }));
    $('#btn-speed').addEventListener('click', () => {
      AudioEngine.sfx('tap');
      const i = SPEEDS.findIndex((s) => s.v === settings.speed);
      applySpeed(SPEEDS[(i + 1) % SPEEDS.length].v);
    });

    // overlay conexión
    $('#connect-start').addEventListener('click', () => {
      hideOverlay('#connect-overlay');
      launchGame();
    });
    $('#connect-close').addEventListener('click', () => hideOverlay('#connect-overlay'));
    $('#connect-dev').addEventListener('click', () => {
      devMode = true;
      DevKeys.enable(true);
      $('#dev-keys').classList.remove('hidden');
      updateConnectLive();
    });
    $('#connect-echo').addEventListener('change', (e) => {
      settings.echo = e.target.checked;
      saveSettings(); applyEcho();
    });

    // overlay victoria
    $('#win-again').addEventListener('click', () => {
      hideOverlay('#win-overlay');
      launchGame();
    });
    $('#win-home').addEventListener('click', () => {
      hideOverlay('#win-overlay');
      showScreen('home'); renderHome();
    });
    $('#win-next').addEventListener('click', () => {
      const next = NEXT[currentMode];
      hideOverlay('#win-overlay');
      startMode(next);
    });

    // ajustes
    $('#btn-settings').addEventListener('click', () => showOverlay('#settings-overlay'));
    $('#settings-close').addEventListener('click', () => hideOverlay('#settings-overlay'));
    $('#set-echo').addEventListener('change', (e) => {
      settings.echo = e.target.checked; saveSettings(); applyEcho();
    });
    $('#set-reset').addEventListener('click', () => {
      if (confirm('¿Borrar estrellas y progreso?')) {
        progress = {}; saveProgress(); renderHome();
        hideOverlay('#settings-overlay');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { route, get devMode() { return devMode; } };
})();
