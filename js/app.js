// App principal: pantallas, progreso, conexión del teclado y celebración.

import { SONGS, LEVELS } from './songs.js';
import { Progression } from './progression.js';
import { AudioEngine } from './audio.js';
import { MIDI } from './midi.js';
import { Users } from './users.js';
import { Game } from './game.js';
import { HomeUI } from './ui-home.js';
import { UsersUI } from './ui-users.js';
import { ConnectUI } from './ui-connect.js';
import { DevKeys } from './keyboard-dev.js';

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

  // Reglas de dominio (modos, niveles, estrellas, puntuación) en js/progression.js.

  // Velocidad de la canción: multiplicador del tempo
  const SPEEDS = [
    { v: 0.7, icon: '🐢', label: 'Lenta' },
    { v: 1,   icon: '😊', label: 'Normal' },
    { v: 1.4, icon: '🐇', label: 'Rápida' },
  ];

  let song = SONGS[0];
  let currentMode = null;
  let wakeLock = null;
  let echoVoices = new Map();

  // ── navegación por niveles ──
  let view = 'levels';      // 'levels' (menú) | 'level' (canciones de un nivel) | 'song' (detalle de canción)
  let currentLevelId = 3;

  // ── perfiles de usuario (js/users.js) ──
  const SKEY = 'simple-piano-settings-v1';
  let activeUser = null;
  let settings = { echo: false };
  try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) { /* ignore */ }

  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify({ echo: settings.echo })); } catch (e) { /* ignore */ } }

  // Puente entre la app y los controladores de UI (js/ui-*.js): estado actual
  // y acciones de navegación que las vistas invocan sin conocer la app.
  const ctx = {
    get song() { return song; },
    get levelId() { return currentLevelId; },
    get user() { return activeUser; },
    get activeUser() { return activeUser; },
    selectLevel, selectSong,
    syncUserState, renderHome, launchGame,
    showOverlay, hideOverlay,
    setEcho(checked) { settings.echo = checked; saveSettings(); applyEcho(); },
  };

  function currentUser() { return (activeUser = Users.active()); }

  function syncUserState() {
    activeUser = Users.active();
    if (!activeUser) return;
    Users.applyTheme(activeUser);
    HomeUI.updateUserChip();
    updateGameUser();
    if (typeof activeUser.prefs.speed !== 'number' || !SPEEDS.some((s) => s.v === activeUser.prefs.speed)) {
      activeUser.prefs.speed = 1;
    }
    // ▸ nivel recordado (o el primero jugable si no existe / no tiene canciones aún)
    const storedLevel = activeUser.prefs.levelId;
    const playable = LEVELS.filter((l) => Progression.songsOfLevel(l.id).length > 0);
    currentLevelId = playable.some((l) => l.id === storedLevel) ? storedLevel : (playable[0] ? playable[0].id : 3);
    // ▸ canción recordada (debe pertenecer al nivel actual)
    let s = SONGS.find((x) => x.id === activeUser.prefs.songId && x.level === currentLevelId);
    if (!s) s = Progression.songsOfLevel(currentLevelId)[0] || SONGS[0];
    song = s;
    activeUser.prefs.songId = song.id;
    activeUser.prefs.levelId = currentLevelId;
    // ▸ vista recordada (menú de niveles, listado de canciones o detalle de canción)
    view = activeUser.prefs.view === 'level' ? 'level'
      : activeUser.prefs.view === 'song' ? 'song'
      : 'levels';
    Users.persist();
    updateSpeedUI();
  }

  // ── niveles: acceso y estrellas (reglas de dominio en js/progression.js) ──

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

    HomeUI.init(ctx);
    UsersUI.init(ctx);
    ConnectUI.init(ctx);
    DevKeys.setRoute(route);   // el modo prueba reenvía sus notas a la ruta de la app
    bindUI();
    registerSW();

    syncUserState();
    if (!activeUser) {
      // primer arranque: hay que crear un jugador antes de jugar
      UsersUI.open({ forceNew: true });
      return;
    }
    renderHome();
  }

  function onMidiEvent(type, note, vel) {
    if (type === 'status') { HomeUI.updateChip(); ConnectUI.updateLive(); return; }
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
      ConnectUI.testNote(note);
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
    setView('song');
  }

  function selectLevel(id) {
    const lvl = Progression.levelById(id);
    if (!lvl) return;
    if (Progression.songsOfLevel(id).length === 0) {
      $('#level-msg').textContent = 'Este nivel está en camino… ¡pronto habrá canciones!';
      return;
    }
    currentLevelId = id;
    const u = currentUser();
    if (u) { u.prefs.levelId = id; Users.persist(); }
    if (!Progression.songsOfLevel(id).some((s) => s.id === song.id)) {
      song = Progression.songsOfLevel(id)[0];
      if (u) { u.prefs.songId = song.id; Users.persist(); }
    }
    setView('level');
  }

  function backToLevels() {
    AudioEngine.sfx('tap');
    setView('levels');
  }

  function backToSongs() {
    AudioEngine.sfx('tap');
    setView('level');
  }

  function setView(v) {
    view = v;
    const u = currentUser();
    if (u) { u.prefs.view = v; Users.persist(); }
    HomeUI.show(v);
  }

  // Pinta la pantalla de inicio en la vista recordada por el jugador.
  function renderHome() {
    setView(view);
  }

  // Vistas de inicio (niveles, canciones, detalle, chips) en js/ui-home.js.

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
    if (m.practice && !MIDI.state.device && !ConnectUI.isDevMode()) {
      ConnectUI.show();
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
    // estrellas (cero castigo, siempre se gana): reglas en js/progression.js
    const { stars, stats } = Progression.scoreResult(res);
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
    const next = Progression.nextMode(currentMode, song);
    const btn = $('#win-next');
    if (next) { btn.classList.remove('hidden'); btn.textContent = `Siguiente: ${Progression.nextLabel(next)}`; }
    else btn.classList.add('hidden');

    $('#win-mode').value = currentMode;
    showOverlay('#win-overlay');
    confetti();
  }

  // Overlay de conexión del teclado en js/ui-connect.js.

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

  // Overlay de jugadores (lista, formulario, exportar/importar) en js/ui-users.js.

  function bindUI() {
    $('#midi-chip').addEventListener('click', () => ConnectUI.show());
    $('#btn-help').addEventListener('click', () => ConnectUI.show());
    $('#btn-back-levels').addEventListener('click', backToLevels);
    $('#btn-back-songs').addEventListener('click', backToSongs);

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

    // overlay conexión (bindings en js/ui-connect.js)

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
      const next = Progression.nextMode(currentMode, song);
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

    // overlay de jugadores (bindings en js/ui-users.js)
  }

  document.addEventListener('DOMContentLoaded', init);

  return { route, get devMode() { return ConnectUI.isDevMode(); } };
})();

export { App };

// Gancho de depuración/pruebas: un único espacio con nombre (intencional) para que
// la consola y los tests automáticos puedan inspeccionar los módulos.
window.__debug__ = { App, Game, SONGS, LEVELS, Users, MIDI, Progression, AudioEngine, HomeUI, UsersUI, ConnectUI, DevKeys };
