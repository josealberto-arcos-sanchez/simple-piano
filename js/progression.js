// Reglas de dominio de canciones/niveles: modos disponibles, estrellas y puntuación.
// Depende de SONGS / LEVELS / R / L (js/songs.js). No toca el DOM ni la UI.

const Progression = (() => {
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

  // Puntuación al terminar una partida (cero castigo, siempre se gana):
  // · fases con espera: 0 ayuditas = 3 · ≤3 = 2 · resto 1
  // · fase libre: ≥85% de notas = 3 · ≥55% = 2 · resto 1
  function scoreResult(res) {
    if (res.free) {
      const pct = res.total ? res.hits / res.total : 0;
      const stars = pct >= 0.85 ? 3 : pct >= 0.55 ? 2 : 1;
      const stats = res.wrong === 0
        ? `¡Tocaste ${res.hits} de ${res.total} notas y ninguna fuera de su sitio!`
        : `¡Tocaste ${res.hits} de ${res.total} notas! (${res.wrong} notitas fuera de su rectángulo)`;
      return { stars, stats };
    }
    const stars = res.errors === 0 ? 3 : res.errors <= 3 ? 2 : 1;
    const stats = res.errors === 0
      ? '¡Perfecto, sin ninguna ayudita!'
      : `Sólo ${res.errors} ayudita${res.errors > 1 ? 's' : ''} — ¡repite y a por las 3 estrellas!`;
    return { stars, stats };
  }

  return {
    availableModes, nextMode, nextLabel,
    levelById, songsOfLevel,
    maxStarsOfSong, userStarsOfSong, maxStarsOfLevel, userStarsOfLevel, starTotal,
    scoreResult,
  };
})();
