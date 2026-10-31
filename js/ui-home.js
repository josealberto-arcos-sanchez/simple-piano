// Vistas de inicio: menú de niveles, listado de canciones, detalle de canción y chips.
// Recibe vía HomeUI.init(ctx) un contexto con el estado actual y acciones de navegación.

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
        ctx.selectLevel(lvl.id);
      });
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

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card song-list-card' + (done ? ' done' : '') + (s.id === ctx.song.id ? ' on' : '');

      const emoji = document.createElement('span');
      emoji.className = 'level-emoji';
      emoji.textContent = s.emoji;
      const title = document.createElement('h3');
      title.textContent = s.title;
      const desc = document.createElement('p');
      desc.className = 'level-desc';
      desc.textContent = [s.composer, s.subtitle].filter(Boolean).join(' · ');
      card.appendChild(emoji); card.appendChild(title); card.appendChild(desc);

      const score = document.createElement('span');
      score.className = 'level-score';
      score.textContent = `⭐ ${sGot} / ${sMax}` + (done ? ' 🏆' : '');
      card.appendChild(score);

      const bar = document.createElement('div');
      bar.className = 'level-bar';
      const fill = document.createElement('div');
      fill.className = 'level-bar-fill';
      fill.style.width = `${Math.round((sGot / sMax) * 100)}%`;
      bar.appendChild(fill);
      card.appendChild(bar);

      card.addEventListener('click', () => {
        AudioEngine.sfx('tap');
        ctx.selectSong(s.id);
      });
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
