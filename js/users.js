// Perfiles de usuario (locales, sin contraseñas, exportables).
// Los datos viven en localStorage ('simple-piano-users-v1'). El progreso,
// la canción elegida y la velocidad preferida se guardan por jugador.
// El eco del teclado sigue siendo un ajuste del dispositivo (no por usuario).

const Users = (() => {
  const UKEY = 'simple-piano-users-v1';
  const LEGACY_PKEY = 'simple-piano-progress-v1';
  const LEGACY_SKEY = 'simple-piano-settings-v1';
  const EXPORT_PREFIX = 'SP1:';

  // Paleta cerrada de colores de jugador.
  const COLORS = [
    { id: 'rosa',      name: 'Rosa',      color: '#f472b6', dark: '#be185d', tint: 'rgba(244,114,182,0.16)', glow: 'rgba(244,114,182,0.30)' },
    { id: 'azul',      name: 'Azul cielo', color: '#38bdf8', dark: '#0284c7', tint: 'rgba(56,189,248,0.16)',  glow: 'rgba(56,189,248,0.30)' },
    { id: 'naranja',   name: 'Naranja',  color: '#fb923c', dark: '#ea580c', tint: 'rgba(251,146,60,0.16)',  glow: 'rgba(251,146,60,0.30)' },
    { id: 'violeta',   name: 'Violeta',  color: '#c084fc', dark: '#9333ea', tint: 'rgba(192,132,252,0.16)', glow: 'rgba(192,132,252,0.30)' },
    { id: 'esmeralda', name: 'Esmeralda', color: '#34d399', dark: '#059669', tint: 'rgba(52,211,153,0.16)',  glow: 'rgba(52,211,153,0.30)' },
    { id: 'ambar',     name: 'Ámbar',    color: '#facc15', dark: '#ca8a04', tint: 'rgba(250,204,21,0.16)',  glow: 'rgba(250,204,21,0.30)' },
    { id: 'coral',     name: 'Coral',    color: '#fb7185', dark: '#e11d48', tint: 'rgba(251,113,133,0.16)', glow: 'rgba(251,113,133,0.30)' },
    { id: 'turquesa',  name: 'Turquesa', color: '#2dd4bf', dark: '#0d9488', tint: 'rgba(45,212,191,0.16)',  glow: 'rgba(45,212,191,0.30)' },
  ];

  let state = { version: 1, activeUserId: null, users: [] };

  // ── carga / guardado ──
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(UKEY));
      if (raw && Array.isArray(raw.users)) {
        state.version = raw.version || 1;
        state.activeUserId = typeof raw.activeUserId === 'string' ? raw.activeUserId : null;
        state.users = raw.users.map(sanitizeUser).filter(Boolean);
      }
    } catch (e) { /* ignorar */ }
    // Saneamiento: el usuario activo siempre debe existir.
    if (!state.users.some((u) => u.id === state.activeUserId)) {
      state.activeUserId = state.users[0] ? state.users[0].id : null;
    }
    if (state.users.length === 0) migrateLegacy();
  }

  function save() {
    try { localStorage.setItem(UKEY, JSON.stringify(state)); } catch (e) { /* ignorar */ }
  }

  // Migración desde v0.2: el progreso global pasa al primer jugador.
  function migrateLegacy() {
    let legacyProgress = null, legacySettings = null;
    try { legacyProgress = JSON.parse(localStorage.getItem(LEGACY_PKEY)); } catch (e) { /* ignore */ }
    try { legacySettings = JSON.parse(localStorage.getItem(LEGACY_SKEY)); } catch (e) { /* ignore */ }
    if (!legacyProgress && !legacySettings) return;

    const user = {
      id: makeId(),
      name: 'Jugador 1',
      color: 'rosa',
      createdAt: new Date().toISOString(),
      prefs: {
        view: 'levels',
        levelId: null,
        songId: legacySettings && typeof legacySettings.songId === 'string' ? legacySettings.songId.slice(0, 80) : undefined,
        speed: legacySettings && typeof legacySettings.speed === 'number' && legacySettings.speed > 0 ? legacySettings.speed : undefined,
      },
      progress: sanitizeProgress(legacyProgress),
    };
    state.users.push(user);
    state.activeUserId = user.id;
    save();
    try { localStorage.removeItem(LEGACY_PKEY); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(LEGACY_SKEY); } catch (e) { /* ignore */ }
  }

  function makeId() {
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function colorOf(id) { return COLORS.find((c) => c.id === id) || COLORS[0]; }

  // ── saneamiento de esquema (importación / carga / migración) ──
  // Cualquier dato que entra de fuera (JSON, código SP1:, localStorage) se
  // normaliza aquí para no romper las cuentas de estrellas ni la UI.

  const VIEWS = ['levels', 'level', 'song'];
  const MODES = ['listen', 'rh', 'lh', 'both', 'free'];

  // Estrellas como entero entre 1 y 3 (siempre hay victoria, mínimo 1).
  function clampStars(v) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(3, Math.max(1, n)) : 1;
  }

  // Normaliza el progreso de un usuario: sólo modos conocidos, estrellas
  // enteras 1..3 y fechas como texto.
  function sanitizeProgress(prog) {
    const out = {};
    if (!prog || typeof prog !== 'object') return out;
    for (const songId of Object.keys(prog)) {
      if (typeof songId !== 'string' || !songId) continue;
      const entry = prog[songId];
      if (!entry || typeof entry !== 'object') continue;
      const clean = {};
      for (const mode of MODES) {
        const v = entry[mode];
        if (mode === 'listen') {
          if (v === true || v === 1 || (typeof v === 'object' && v && v.listen)) clean.listen = true;
        } else if (v && typeof v === 'object') {
          const date = typeof v.date === 'string' && v.date ? v.date : new Date().toISOString();
          clean[mode] = { stars: clampStars(v.stars), date };
        }
      }
      if (Object.keys(clean).length > 0) out[songId] = clean;
    }
    return out;
  }

  // Construye un usuario válido a partir de datos arbitrarios. Devuelve null
  // si no es recuperable (sin nombre válido).
  function sanitizeUser(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 20) : '';
    if (!name) return null;
    const p = raw.prefs && typeof raw.prefs === 'object' ? raw.prefs : {};
    const user = {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : makeId(),
      name,
      color: colorOf(raw.color).id,
      createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : new Date().toISOString(),
      prefs: {},
      progress: sanitizeProgress(raw.progress),
    };
    if (VIEWS.includes(p.view)) user.prefs.view = p.view;
    const levelId = Number(p.levelId);
    if (Number.isInteger(levelId)) user.prefs.levelId = levelId;
    if (typeof p.songId === 'string' && p.songId) user.prefs.songId = p.songId.slice(0, 80);
    const speed = Number(p.speed);
    if (Number.isFinite(speed) && speed > 0) user.prefs.speed = speed;
    return user;
  }

  // ── acceso ──
  function all() { return state.users; }
  function active() { return state.users.find((u) => u.id === state.activeUserId) || null; }
  function colors() { return COLORS; }

  function selectUser(id) {
    if (!state.users.some((u) => u.id === id)) return null;
    state.activeUserId = id;
    save();
    return active();
  }

  function createUser(name, colorId) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const user = {
      id: makeId(),
      name: clean.slice(0, 20),
      color: colorOf(colorId).id,
      createdAt: new Date().toISOString(),
      prefs: { view: 'levels', levelId: null, songId: undefined, speed: undefined },
      progress: {},
    };
    state.users.push(user);
    state.activeUserId = user.id;
    save();
    return user;
  }

  function updateUser(id, patch) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return null;
    if (patch.name !== undefined) u.name = String(patch.name).trim().slice(0, 20) || u.name;
    if (patch.color !== undefined) u.color = colorOf(patch.color).id;
    save();
    return u;
  }

  function deleteUser(id) {
    const i = state.users.findIndex((u) => u.id === id);
    if (i < 0) return false;
    state.users.splice(i, 1);
    if (state.activeUserId === id) {
      state.activeUserId = state.users[0] ? state.users[0].id : null;
    }
    save();
    return true;
  }

  // ── escrituras encapsuladas (validan y persisten automáticamente) ──
  // Toda mutación del estado de un usuario debe pasar por estos métodos; nada
  // de tocar `user.prefs` o `user.progress` desde fuera del módulo.

  // Ajusta preferencias de un jugador. Ignora claves desconocidas y normaliza
  // tipos/rangos. Devuelve el usuario actualizado o null si no existe.
  function setPrefs(id, patch) {
    const u = state.users.find((x) => x.id === id);
    if (!u || !patch || typeof patch !== 'object') return u;
    u.prefs = u.prefs || {};
    if (patch.speed !== undefined) {
      const v = Number(patch.speed);
      u.prefs.speed = Number.isFinite(v) && v > 0 ? v : undefined;
    }
    if (VIEWS.includes(patch.view)) u.prefs.view = patch.view;
    if (patch.levelId !== undefined) {
      const n = Number(patch.levelId);
      u.prefs.levelId = Number.isInteger(n) ? n : null;
    }
    if (patch.songId !== undefined) {
      u.prefs.songId = typeof patch.songId === 'string' ? patch.songId.slice(0, 80) : undefined;
    }
    save();
    return u;
  }

  // Registra el resultado de una partida: estrellas (1..3) o escucha completada.
  // Conserva el mejor resultado anterior. Devuelve false si los argumentos no
  // son válidos.
  function recordProgress(id, songId, mode, stars) {
    const u = state.users.find((x) => x.id === id);
    if (!u || typeof songId !== 'string' || !songId || !MODES.includes(mode)) return false;
    u.progress = u.progress || {};
    if (!u.progress[songId]) u.progress[songId] = {};
    if (mode === 'listen') {
      u.progress[songId].listen = true;
    } else {
      const s = clampStars(stars);
      const prev = u.progress[songId][mode];
      if (!prev || typeof prev.stars !== 'number' || s > prev.stars) {
        u.progress[songId][mode] = { stars: s, date: new Date().toISOString() };
      }
    }
    save();
    return true;
  }

  // Marca una canción como escuchada (modo Escuchar completado).
  function markListened(id, songId) {
    return recordProgress(id, songId, 'listen', 0);
  }

  // Borra todo el progreso de un jugador.
  function resetProgress(id) {
    const u = state.users.find((x) => x.id === id);
    if (!u) return false;
    u.progress = {};
    save();
    return true;
  }

  // ── tema (variables CSS) ──
  function applyTheme(user) {
    const c = colorOf(user ? user.color : undefined);
    const root = document.documentElement.style;
    root.setProperty('--user-color', c.color);
    root.setProperty('--user-color-dark', c.dark);
    root.setProperty('--user-glow', c.glow);
    root.setProperty('--user-bg-tint', c.tint);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && user) meta.setAttribute('content', c.dark);
  }

  // ── exportación / importación ──
  function exportAll() { return { version: 1, exportedAt: new Date().toISOString(), users: state.users }; }
  function exportActive() {
    const u = active();
    return u ? { version: 1, exportedAt: new Date().toISOString(), users: [u] } : null;
  }

  function utf8ToB64(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeObj(obj) {
    try {
      return EXPORT_PREFIX + utf8ToB64(JSON.stringify(obj));
    } catch (e) { return null; }
  }
  function decodeStr(str) {
    try {
      if (typeof str === 'string' && str.indexOf(EXPORT_PREFIX) === 0) str = str.slice(EXPORT_PREFIX.length);
      return JSON.parse(b64ToUtf8(String(str).trim()));
    } catch (e) { return null; }
  }

  // Fusiona usuarios importados con los locales, conservando las mejores
  // estrellas. Los datos de entrada se sanean antes de tocar el estado.
  function importData(obj) {
    if (!obj || !Array.isArray(obj.users)) return 0;
    let added = 0;
    for (const inUser of obj.users) {
      const clean = sanitizeUser(inUser);
      if (!clean) continue;
      const local = state.users.find((u) => u.id === clean.id);
      if (local) {
        mergeProgress(local.progress, clean.progress);
        local.prefs = local.prefs || {};
        Object.keys(clean.prefs).forEach((k) => {
          if (local.prefs[k] === undefined) local.prefs[k] = clean.prefs[k];
        });
      } else {
        state.users.push(clean);
        added++;
      }
    }
    if (added > 0 && !state.activeUserId) state.activeUserId = state.users[0].id;
    save();
    return added;
  }

  function mergeProgress(target, source) {
    for (const songId of Object.keys(source)) {
      if (!target[songId]) target[songId] = {};
      const st = source[songId], tt = target[songId];
      if (typeof st === 'object' && typeof tt === 'object') {
        for (const mode of Object.keys(st)) {
          if (mode === 'listen') {
            if (st.listen) tt.listen = true;
          } else if (st[mode] && typeof st[mode] === 'object') {
            const s = clampStars(st[mode].stars);
            const cur = tt[mode] && typeof tt[mode].stars === 'number' ? tt[mode].stars : 0;
            if (s > cur) tt[mode] = { stars: s, date: st[mode].date || new Date().toISOString() };
          }
        }
      }
    }
  }

  load();

  return {
    all, active, colors, colorOf,
    createUser, updateUser, deleteUser, selectUser, applyTheme,
    setPrefs, recordProgress, markListened, resetProgress,
    exportAll, exportActive, encodeObj, decodeStr, importData,
    persist: save,
  };
})();

export { Users };
