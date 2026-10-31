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

  // Modos disponibles según las manos que participan en una canción.
  // Nivel 1 (sólo R) → escuchar · derecha · libre · Nivel 2 (sólo L) → escuchar · izquierda · libre
  // Nivel 3 (R y L) → los cinco modos.
  function availableModes(song) {
    const hasR = song.notes.some((n) => n.h === R);
    const hasL = song.notes.some((n) => n.h === L);
    const modes = ['listen'];
    if (hasR) modes.push('rh');
    if (hasL) modes.push('lh');
    if (hasR && hasL) modes.push('both');
    modes.push('free');
    return modes;
  }

  // Modo siguiente al superar uno (respetando los modos de la canción).
  function nextMode(mode, song) {
    const modes = availableModes(song).filter((m) => m !== 'listen');
    const i = modes.indexOf(mode);
    return i >= 0 && i < modes.length - 1 ? modes[i + 1] : null;
  }
  function nextLabel(next) {
    if (next === 'free') return '🎵 ¡Toca libre!';
    if (next === 'lh') return '👈 Mano izquierda';
    if (next === 'both') return '✨ ¡Las dos manos!';
    return 'Siguiente ➡️';
  }

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

  // ── navegación por niveles ──
  let view = 'levels';      // 'levels' (menú) | 'level' (detalle de un nivel)
  let currentLevelId = 3;

  // ── perfiles de usuario (js/users.js) ──
  const SKEY = 'simple-piano-settings-v1';
  let activeUser = null;
  let selectedColor = Users.colors()[0].id;
  let forcedNew = false;
  let settings = { echo: false };
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) { /* ignore */ }

  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify({ echo: settings.echo })); } catch (e) { /* ignore */ } }

  function currentUser() { return (activeUser = Users.active()); }

  function syncUserState() {
    activeUser = Users.active();
    if (!activeUser) return;
    Users.applyTheme(activeUser);
    updateUserChip();
    updateGameUser();
    if (typeof activeUser.prefs.speed !== 'number' || !SPEEDS.some((s) => s.v === activeUser.prefs.speed)) {
      activeUser.prefs.speed = 1;
    }
    // ▸ nivel recordado (o el primero jugable si no existe / no tiene canciones aún)
    const storedLevel = activeUser.prefs.levelId;
    const playable = LEVELS.filter((l) => songsOfLevel(l.id).length > 0);
    currentLevelId = playable.some((l) => l.id === storedLevel) ? storedLevel : (playable[0] ? playable[0].id : 3);
    // ▸ canción recordada (debe pertenecer al nivel actual)
    let s = SONGS.find((x) => x.id === activeUser.prefs.songId && x.level === currentLevelId);
    if (!s) s = songsOfLevel(currentLevelId)[0] || SONGS[0];
    song = s;
    activeUser.prefs.songId = song.id;
    activeUser.prefs.levelId = currentLevelId;
    // ▸ vista recordada (menú de niveles o detalle de nivel)
    view = activeUser.prefs.view === 'level' ? 'level' : 'levels';
    Users.persist();
    updateSpeedUI();
  }

  // ── niveles: acceso y estrellas ──
  function levelById(id) { return LEVELS.find((l) => l.id === id) || null; }
  function songsOfLevel(id) { return SONGS.filter((s) => s.level === id); }

  // Estrellas máximas de una canción: 3 por cada modo practicable (escuchar no da estrellas).
  function maxStarsOfSong(s) {
    return availableModes(s).reduce((acc, m) => acc + (m === 'listen' ? 0 : 3), 0);
  }
  function userStarsOfSong(u, s) {
    if (!u) return 0;
    const prog = u.progress[s.id] || {};
    let t = 0;
    for (const m of availableModes(s)) {
      if (m === 'listen') continue;
      if (prog[m] && prog[m].stars) t += prog[m].stars;
    }
    return t;
  }
  function maxStarsOfLevel(id) {
    return songsOfLevel(id).reduce((acc, s) => acc + maxStarsOfSong(s), 0);
  }
  function userStarsOfLevel(u, id) {
    return songsOfLevel(id).reduce((acc, s) => acc + userStarsOfSong(u, s), 0);
  }

  function starTotal(u) {
    let t = 0;
    const prog = u.progress || {};
    for (const sid of Object.keys(prog)) {
      for (const m of Object.keys(prog[sid])) {
        if (prog[sid][m] && prog[sid][m].stars) t += prog[sid][m].stars;
      }
    }
    return t;
  }

  function starsOf(mode) {
    const u = currentUser();
    if (!u) return 0;
    const s = u.progress[song.id] || {};
    return s[mode] ? s[mode].stars : 0;
  }
  function setStars(mode, stars) {
    const u = currentUser();
    if (!u) return;
    if (!u.progress[song.id]) u.progress[song.id] = {};
    const prev = u.progress[song.id][mode];
    if (!prev || stars > prev.stars) {
      u.progress[song.id][mode] = { stars, date: new Date().toISOString() };
      Users.persist();
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
  function activeSpeed() {
    const u = currentUser();
    return u && typeof u.prefs.speed === 'number' ? u.prefs.speed : 1;
  }
  function speedPreset() { return SPEEDS.find((s) => s.v === activeSpeed()) || SPEEDS[1]; }

  function updateSpeedUI() {
    const p = speedPreset();
    $$('.speed-btn').forEach((b) => b.classList.toggle('on', +b.dataset.speed === activeSpeed()));
    const btn = $('#btn-speed');
    if (btn) { btn.textContent = p.icon; btn.title = `Velocidad: ${p.label}`; }
  }

  function applySpeed(v) {
    const u = currentUser();
    if (u) { u.prefs.speed = v; Users.persist(); }
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
    AudioEngine.unlockOnGesture();

    MIDI.init();
    MIDI.on(onMidiEvent);

    bindUI();
    registerSW();

    syncUserState();
    if (!activeUser) {
      // primer arranque: hay que crear un jugador antes de jugar
      openUserOverlay({ forceNew: true });
      return;
    }
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
    const found = SONGS.find((s) => s.id === id && s.level === currentLevelId);
    if (!found) return;
    song = found;
    const u = currentUser();
    if (u) { u.prefs.songId = song.id; Users.persist(); }
    renderLevelView();
  }

  function selectLevel(id) {
    const lvl = levelById(id);
    if (!lvl) return;
    if (songsOfLevel(id).length === 0) {
      $('#level-msg').textContent = 'Este nivel está en camino… ¡pronto habrá canciones!';
      return;
    }
    currentLevelId = id;
    const u = currentUser();
    if (u) { u.prefs.levelId = id; Users.persist(); }
    if (!songsOfLevel(id).some((s) => s.id === song.id)) {
      song = songsOfLevel(id)[0];
      if (u) { u.prefs.songId = song.id; Users.persist(); }
    }
    setView('level');
  }

  function backToLevels() {
    AudioEngine.sfx('tap');
    setView('levels');
  }

  function setView(v) {
    view = v;
    const u = currentUser();
    if (u) { u.prefs.view = v; Users.persist(); }
    $('#levels-view').classList.toggle('hidden', v !== 'levels');
    $('#level-view').classList.toggle('hidden', v !== 'level');
    $('#level-msg').textContent = '';
    if (v === 'levels') renderLevels(); else renderLevelView();
  }

  // Pinta la pantalla de inicio en la vista recordada por el jugador.
  function renderHome() {
    setView(view);
  }

  // Menú principal: tarjeta por nivel con sus estrellas (todas abiertas).
  function renderLevels() {
    updateChip();
    updateUserChip();
    const u = currentUser();
    const list = $('#level-list');
    list.innerHTML = '';
    LEVELS.forEach((lvl) => {
      const maxS = maxStarsOfLevel(lvl.id);
      const got = u ? userStarsOfLevel(u, lvl.id) : 0;
      const done = maxS > 0 && got === maxS;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card' + (done ? ' done' : '') + (maxS === 0 ? ' empty' : '');

      const emoji = document.createElement('span');
      emoji.className = 'level-emoji';
      emoji.textContent = lvl.emoji;
      const title = document.createElement('h3');
      title.textContent = lvl.title;
      const desc = document.createElement('p');
      desc.className = 'level-desc';
      desc.textContent = lvl.description;
      card.appendChild(emoji); card.appendChild(title); card.appendChild(desc);

      if (maxS === 0) {
        const note = document.createElement('p');
        note.className = 'level-empty-note';
        note.textContent = 'Próximamente';
        card.appendChild(note);
      } else {
        const score = document.createElement('span');
        score.className = 'level-score';
        score.textContent = `⭐ ${got} / ${maxS}` + (done ? ' 🏆' : '');
        card.appendChild(score);
        const bar = document.createElement('div');
        bar.className = 'level-bar';
        const fill = document.createElement('div');
        fill.className = 'level-bar-fill';
        fill.style.width = `${Math.round((got / maxS) * 100)}%`;
        bar.appendChild(fill);
        card.appendChild(bar);
      }

      card.addEventListener('click', () => {
        AudioEngine.sfx('tap');
        selectLevel(lvl.id);
      });
      list.appendChild(card);
    });
  }

  // Detalle de nivel: canciones del nivel + tarjeta con sus modos.
  function renderLevelView() {
    updateChip();
    updateUserChip();
    const lvl = levelById(currentLevelId) || LEVELS[0];
    const u = currentUser();
    const maxS = maxStarsOfLevel(lvl.id);
    const got = u ? userStarsOfLevel(u, lvl.id) : 0;

    $('#level-title').textContent = `${lvl.emoji} ${lvl.title}`;
    $('#level-sub').textContent = `${lvl.name} · ${lvl.description}`;
    $('#level-stars').textContent = `⭐ ${got} / ${maxS}`;

    // selector de canciones del nivel
    const songs = songsOfLevel(lvl.id);
    const picker = $('#song-picker');
    picker.classList.toggle('hidden', songs.length <= 1);
    picker.innerHTML = '';
    songs.forEach((s) => {
      const b = document.createElement('button');
      b.className = 'song-tab' + (s.id === song.id ? ' on' : '');
      b.textContent = `${s.emoji} ${s.title}`;
      const span = document.createElement('span');
      span.className = 'song-tab-stars';
      span.textContent = ` ⭐ ${userStarsOfSong(u, s)}/${maxStarsOfSong(s)}`;
      b.appendChild(span);
      b.addEventListener('click', () => { AudioEngine.sfx('tap'); selectSong(s.id); });
      picker.appendChild(b);
    });

    // tarjeta de la canción activa
    $('#song-title').textContent = `${song.emoji} ${song.title}`;
    $('#song-sub').textContent = [song.composer, song.subtitle].filter(Boolean).join(' · ');

    const prog = u ? u.progress || {} : {};
    const fill = (mode) => {
      const s = starsOf(mode);
      return s ? '⭐'.repeat(s) : '☆☆☆';
    };
    const q = (mode) => {
      const s = prog[song.id];
      return mode === 'listen' && s && s.listen ? ' ✅' : '';
    };

    // sólo se muestran los modos posibles para esta canción
    const modes = availableModes(song);
    $$('.mode-btn').forEach((b) => b.classList.toggle('hidden', !modes.includes(b.dataset.mode)));

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

  function updateUserChip() {
    const chip = $('#user-chip');
    if (!activeUser) {
      chip.textContent = '👤';
      chip.className = 'chip user-chip';
      return;
    }
    const c = Users.colorOf(activeUser.color);
    chip.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.background = c.color;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(` ${activeUser.name} ▾`));
    chip.className = 'chip user-chip';
  }

  function updateGameUser() {
    const el = $('#game-user');
    if (!el) return;
    if (!activeUser) { el.textContent = ''; return; }
    const c = Users.colorOf(activeUser.color);
    el.textContent = activeUser.name;
    el.style.borderColor = c.color;
    el.style.color = c.color;
    el.title = activeUser.name;
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
    updateGameUser();
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
    }, activeSpeed());
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
      const u = currentUser();
      if (u) {
        u.progress[song.id] = u.progress[song.id] || {};
        u.progress[song.id].listen = true;
        Users.persist();
      }
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

    const praise = ['¡LO CONSEGUISTE!', '¡MUY BIEN!', '¡GENIAL!'][Math.min(2, Math.floor(Math.random() * 3))];
    const nm = activeUser ? activeUser.name : '';
    $('#win-title').textContent = nm ? praise.replace('!', `, ${nm}!`) : praise;
    $$('#win-stars .star').forEach((el, i) => {
      el.classList.toggle('on', i < stars);
      el.classList.remove('pop');
      if (i < stars) { void el.offsetWidth; el.classList.add('pop'); }
    });
    $('#win-stats').textContent = stats;
    const next = nextMode(currentMode, song);
    const btn = $('#win-next');
    if (next) { btn.classList.remove('hidden'); btn.textContent = `Siguiente: ${nextLabel(next)}`; }
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
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.update();
      }).catch(() => { /* ignore */ });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing && $('#screen-game').classList.contains('hidden')) {
          refreshing = true;
          location.reload();
        }
      });
    }
  }

  async function forceUpdate() {
    const btn = $('#set-update');
    btn.textContent = '⏳ Actualizando…';
    btn.disabled = true;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* ignore */ }
    location.reload();
  }

  // ── UI ──
  function showOverlay(sel) { $(sel).classList.remove('hidden'); }
  function hideOverlay(sel) { $(sel).classList.add('hidden'); }

  // ── overlay de jugadores ──
  function flashMsg(text) {
    const el = $('#user-msg');
    el.textContent = text;
    clearTimeout(flashMsg.timer);
    flashMsg.timer = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function countStars(u) { return starTotal(u); }

  function renderUserList() {
    const list = $('#user-list');
    list.innerHTML = '';
    const eaBtn = $('#user-export-active');
    if (eaBtn) {
      eaBtn.textContent = activeUser
        ? `📤 Guardar copia de ${activeUser.name} (archivo)`
        : '📤 Guardar copia de este jugador (archivo)';
    }
    const users = Users.all();
    if (users.length === 0) {
      list.innerHTML = '<p class="user-empty">Todavía no hay jugadores.</p>';
      return;
    }
    const selId = activeUser ? activeUser.id : null;
    users.forEach((u) => {
      const c = Users.colorOf(u.color);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'user-card' + (u.id === selId ? ' on' : '');

      const avatar = document.createElement('span');
      avatar.className = 'user-avatar';
      avatar.style.background = c.color;
      avatar.textContent = u.name.charAt(0).toUpperCase();

      const info = document.createElement('span');
      info.className = 'user-info';
      const nm = document.createElement('span'); nm.className = 'user-name'; nm.textContent = u.name;
      const st = document.createElement('span'); st.className = 'user-stars'; st.textContent = `⭐ ${countStars(u)}`;
      info.appendChild(nm); info.appendChild(st);

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'mini-btn';
      edit.textContent = '📝';
      edit.title = 'Editar';
      edit.addEventListener('click', (ev) => { ev.stopPropagation(); showUserForm(u); });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'mini-btn danger';
      del.textContent = '🗑️';
      del.title = 'Borrar';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (confirm(`¿Borrar a ${u.name}? Su progreso se perderá.`)) {
          Users.deleteUser(u.id);
          syncUserState();
          renderUserList();
        }
      });

      card.addEventListener('click', () => {
        Users.selectUser(u.id);
        syncUserState();
        hideUserForm();
        renderHome();
        forcedNew = false;
        hideOverlay('#user-overlay');
      });

      card.appendChild(avatar); card.appendChild(info); card.appendChild(edit); card.appendChild(del);
      list.appendChild(card);
    });
  }

  function showUserForm(u) {
    const form = $('#user-form');
    form.classList.remove('hidden');
    $('#user-add').classList.add('hidden');
    $('#user-form-title').textContent = u ? `Editar a ${u.name}` : '➕ Nuevo jugador';
    $('#user-input').value = u ? u.name : '';
    selectedColor = u ? u.color : Users.colors()[0].id;
    const picker = $('#user-color-picker');
    picker.innerHTML = '';
    Users.colors().forEach((c) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'color-swatch' + (c.id === selectedColor ? ' on' : '');
      sw.style.background = c.color;
      sw.addEventListener('click', () => {
        selectedColor = c.id;
        $$('.color-swatch').forEach((x) => x.classList.toggle('on', x === sw));
      });
      picker.appendChild(sw);
    });
    $('#user-save').dataset.mode = u ? u.id : 'new';
    $('#user-input').focus();
  }

  function hideUserForm() {
    $('#user-form').classList.add('hidden');
    $('#user-add').classList.remove('hidden');
    $('#user-input').value = '';
  }

  function openUserOverlay(opts) {
    opts = opts || {};
    forcedNew = !!opts.forceNew;
    renderUserList();
    if (forcedNew) {
      $('#user-close').classList.add('hidden');
      $('#user-transfer').classList.add('hidden');
      showUserForm(null);
    } else {
      $('#user-close').classList.remove('hidden');
      $('#user-transfer').classList.remove('hidden');
      hideUserForm();
    }
    showOverlay('#user-overlay');
  }

  function afterImportOrSelect() {
    syncUserState();
    renderUserList();
    renderHome();
    if (forcedNew && Users.active()) {
      forcedNew = false;
      hideOverlay('#user-overlay');
    }
  }

  function bindUI() {
    $('#midi-chip').addEventListener('click', showConnect);
    $('#btn-help').addEventListener('click', showConnect);
    $('#btn-back-levels').addEventListener('click', backToLevels);

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
      const i = SPEEDS.findIndex((s) => s.v === activeSpeed());
      applySpeed(SPEEDS[(i + 1) % SPEEDS.length].v);
    });
    // Volver a empezar la canción desde el principio (por si se equivoca)
    $('#btn-restart').addEventListener('click', () => {
      AudioEngine.sfx('tap');
      launchGame();
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
      const next = nextMode(currentMode, song);
      hideOverlay('#win-overlay');
      if (next) startMode(next); else { showScreen('home'); renderHome(); }
    });

    // ajustes
    $('#btn-settings').addEventListener('click', () => showOverlay('#settings-overlay'));
    $('#settings-close').addEventListener('click', () => hideOverlay('#settings-overlay'));
    $('#set-echo').addEventListener('change', (e) => {
      settings.echo = e.target.checked; saveSettings(); applyEcho();
    });
    $('#set-update').addEventListener('click', forceUpdate);
    $('#set-reset').addEventListener('click', () => {
      const u = currentUser();
      const who = u ? ` de ${u.name}` : '';
      if (confirm(`¿Borrar el progreso${who}?`)) {
        if (u) { u.progress = {}; Users.persist(); }
        renderHome();
        hideOverlay('#settings-overlay');
      }
    });

    // overlay de jugadores
    $('#user-chip').addEventListener('click', () => openUserOverlay());
    $('#user-close').addEventListener('click', () => {
      forcedNew = false;
      hideOverlay('#user-overlay');
    });
    $('#user-add').addEventListener('click', () => showUserForm(null));

    $('#user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#user-input').value.trim();
      if (!name) { flashMsg('Escribe un nombre antes de continuar.'); return; }
      const mode = $('#user-save').dataset.mode;
      let created = false;
      if (mode === 'new') {
        created = !!Users.createUser(name, selectedColor);
        if (created) flashMsg('¡Jugador creado! 🎉');
      } else {
        Users.updateUser(mode, { name, color: selectedColor });
        flashMsg('Jugador actualizado.');
      }
      hideUserForm();
      syncUserState();
      renderUserList();
      renderHome();
      if (forcedNew && created) {
        forcedNew = false;
        hideOverlay('#user-overlay');
      }
    });

    $('#user-export').addEventListener('click', () => {
      const data = Users.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simple-piano-usuarios-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      flashMsg('Fichero descargado ✅');
    });

    $('#user-export-active').addEventListener('click', () => {
      const u = Users.active();
      if (!u) { flashMsg('No hay ningún jugador activo.'); return; }
      const data = Users.exportActive();
      if (!data) { flashMsg('No se pudo exportar el jugador.'); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = u.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jugador';
      a.download = `simple-piano-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
      flashMsg(`Fichero de ${u.name} descargado ✅`);
    });

    $('#user-copy').addEventListener('click', async () => {
      const code = Users.encodeObj(Users.exportAll());
      if (!code) { flashMsg('No se pudo generar el código.'); return; }
      try {
        await navigator.clipboard.writeText(code);
        flashMsg('Código copiado ✔ Pégalo en el otro dispositivo.');
      } catch (e) {
        prompt('Copia este texto manualmente:', code);
      }
    });

    $('#user-paste').addEventListener('click', () => {
      const code = prompt('Pega aquí el código de usuarios (empieza por SP1:):');
      if (!code) return;
      const obj = Users.decodeStr(code);
      if (!obj) { flashMsg('El código no es válido ❌'); return; }
      const n = Users.importData(obj);
      afterImportOrSelect();
      flashMsg(n > 0 ? `Añadidos ${n} jugador(es) ✅` : 'Progreso fusionado ✅');
    });

    $('#user-import').addEventListener('click', () => $('#user-import-file').click());
    $('#user-import-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const n = Users.importData(JSON.parse(reader.result));
          afterImportOrSelect();
          flashMsg(n > 0 ? `Añadidos ${n} jugador(es) ✅` : 'Progreso fusionado ✅');
        } catch (err) {
          flashMsg('El fichero no es válido ❌');
        }
      };
      reader.readAsText(f);
      e.target.value = '';
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { route, get devMode() { return devMode; } };
})();
