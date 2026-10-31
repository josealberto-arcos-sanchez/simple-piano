// Vistas de inicio: menú de niveles, listado de canciones, detalle de canción y chips.
// Recibe vía HomeUI.init(ctx) un contexto con el estado actual y acciones de navegación.

import { LEVELS } from './songs.js';
import { Progression } from './progression.js';
import { AudioEngine } from './audio.js';
import { Users } from './users.js';
import { MIDI } from './midi.js';
import { el } from './dom.js';

const HomeUI = (() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  let ctx = null;

  function init(c) { ctx = c; }

  // Estrellas conseguidas por el usuario en la canción actual y un modo.
  function starsOf(mode) {
    const u = ctx.user;
    if (!u) return 0;
    const s = u.progress[ctx.song.id] || {};
    return s[mode] ? s[mode].stars : 0;
  }

  // ── menú principal: tarjeta por nivel con sus estrellas (todas abiertas) ──
  function renderLevels() {
    updateChip();
    updateUserChip();
    const u = ctx.user;
    const list = $('#level-list');
    list.innerHTML = '';
    LEVELS.forEach((lvl) => {
      const maxS = Progression.maxStarsOfLevel(lvl.id);
      const got = u ? Progression.userStarsOfLevel(u, lvl.id) : 0;
      const done = maxS > 0 && got === maxS;

      const card = el('button', {
        type: 'button',
        className: 'level-card' + (done ? ' done' : '') + (maxS === 0 ? ' empty' : ''),
        on: { click: () => { AudioEngine.sfx('tap'); ctx.selectLevel(lvl.id); } },
      }, [
        el('span', { className: 'level-emoji', text: lvl.emoji }),
        el('h3', { text: lvl.title }),
        el('p', { className: 'level-desc', text: lvl.description }),
        maxS === 0
          ? el('p', { className: 'level-empty-note', text: 'Próximamente' })
          : [
              el('span', { className: 'level-score', text: `⭐ ${got} / ${maxS}` + (done ? ' 🏆' : '') }),
              el('div', { className: 'level-bar' },
                el('div', { className: 'level-bar-fill', style: { width: `${Math.round((got / maxS) * 100)}%` } })),
            ],
      ]);
      list.appendChild(card);
    });
  }

  // ── menú intermedio: listado de canciones del nivel, con sus estrellas ──
  function renderLevelView() {
    updateChip();
    updateUserChip();
    const lvl = Progression.levelById(ctx.levelId) || LEVELS[0];
    const u = ctx.user;
    const maxS = Progression.maxStarsOfLevel(lvl.id);
    const got = u ? Progression.userStarsOfLevel(u, lvl.id) : 0;

    $('#level-title').textContent = `${lvl.emoji} ${lvl.title}`;
    $('#level-sub').textContent = `${lvl.name} · ${lvl.description}`;
    $('#level-stars').textContent = `⭐ ${got} / ${maxS}`;

    const songs = Progression.songsOfLevel(lvl.id);
    const list = $('#song-list');
    list.innerHTML = '';
    songs.forEach((s) => {
      const sMax = Progression.maxStarsOfSong(s);
      const sGot = u ? Progression.userStarsOfSong(u, s) : 0;
      const done = sMax > 0 && sGot === sMax;

      const card = el('button', {
        type: 'button',
        className: 'level-card song-list-card' + (done ? ' done' : '') + (s.id === ctx.song.id ? ' on' : ''),
        on: { click: () => { AudioEngine.sfx('tap'); ctx.selectSong(s.id); } },
      }, [
        el('span', { className: 'level-emoji', text: s.emoji }),
        el('h3', { text: s.title }),
        el('p', { className: 'level-desc', text: [s.composer, s.subtitle].filter(Boolean).join(' · ') }),
        el('span', { className: 'level-score', text: `⭐ ${sGot} / ${sMax}` + (done ? ' 🏆' : '') }),
        el('div', { className: 'level-bar' },
          el('div', { className: 'level-bar-fill', style: { width: `${Math.round((sGot / sMax) * 100)}%` } })),
      ]);
      list.appendChild(card);
    });
  }

  // ── detalle de una canción: tarjeta con sus modos y velocidad ──
  function renderSongView() {
    updateChip();
    updateUserChip();
    const song = ctx.song;
    const lvl = Progression.levelById(ctx.levelId) || LEVELS[0];
    const u = ctx.user;

    $('#song-view-level-title').textContent = `${lvl.emoji} ${lvl.title}`;
    $('#song-view-level-sub').textContent = `${lvl.name} · ${lvl.description}`;
    $('#song-stars').textContent = `⭐ ${u ? Progression.userStarsOfSong(u, song) : 0} / ${Progression.maxStarsOfSong(song)}`;

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
    const modes = Progression.availableModes(song);
    $$('.mode-btn').forEach((b) => b.classList.toggle('hidden', !modes.includes(b.dataset.mode)));

    $('#stars-rh').textContent = fill('rh');
    $('#stars-lh').textContent = fill('lh');
    $('#stars-both').textContent = fill('both');
    $('#stars-free').textContent = fill('free');
    $('#done-listen').textContent = q('listen');
  }

  // ── chips del encabezado ──
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
    const user = ctx.user;
    if (!user) {
      chip.textContent = '👤';
      chip.className = 'chip user-chip';
      return;
    }
    const c = Users.colorOf(user.color);
    chip.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.background = c.color;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(` ${user.name} ▾`));
    chip.className = 'chip user-chip';
  }

  // Muestra la vista pedida (levels | level | song) y pinta su contenido.
  function show(v) {
    $('#levels-view').classList.toggle('hidden', v !== 'levels');
    $('#level-view').classList.toggle('hidden', v !== 'level');
    $('#song-view').classList.toggle('hidden', v !== 'song');
    $('#level-msg').textContent = '';
    if (v === 'levels') renderLevels();
    else if (v === 'level') renderLevelView();
    else renderSongView();
  }

  return { init, show, updateChip, updateUserChip };
})();

export { HomeUI };
