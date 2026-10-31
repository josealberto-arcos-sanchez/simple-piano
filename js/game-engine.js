// Motor de la partida (simulación pura): reglas de los modos escuchar / espera /
// libre, aciertos y errores, ventanas de tiempo, velocidad y progreso.
// No toca el DOM ni el <canvas>: emite efectos visuales de un solo disparo en
// `fx` (acierto / error / partículas) que consume el renderizador
// (js/game-render.js). Así toda la lógica es testeable sin canvas.

import { AudioEngine } from './audio.js';

const GameEngine = () => {
  // ── constantes del dominio ──
  const FREE_GRACE = 0.35;   // pulsos de ventana antes de que la cabeza toque la línea
  const FREE_TAIL = 0.15;    // margen tras terminar de cruzar el rectángulo
  const REHIT_MERCY = 0.25;  // s que se ignora un rebote de la misma tecla (sin castigo)
  const HIT_FADE = 0.6;      // s del destello dorado al acertar
  const FREE_COUNTDOWN = 3;  // s de cuenta atrás (3, 2, 1) antes de la fase libre

  // ── estado de la partida ──
  let song = null, mode = 'both';
  let events = [], notesVis = [];   // eventos = notas agrupadas por pulso
  let songBeat = -2, eventIdx = 0, pending = null;
  let errors = 0;
  let running = false;
  let listenPaused = false;
  let speed = 1;                    // multiplicador de velocidad (🐢😊🐇, cambiable en vivo)
  let hitMap = new Map();           // modo libre: id de nota → s de destello dorado restantes
  let freeStats = { hits: 0, wrong: 0 };
  let countdown = 0;                // modo libre: s que faltan para que empiece la canción
  let lastHitAt = new Map();        // modo libre: cuándo se acertó cada tecla (anti-rebote)
  let ui = {};
  const pressed = new Set();        // teclas de su piano mantenidas ahora
  let lastProgress = '';
  let fx = [];                      // efectos visuales para el renderizador (un solo disparo)

  // Agrupa las notas (filtradas por mano según el modo) en eventos por pulso.
  function compile() {
    const hand = { rh: 'R', lh: 'L' }[mode];
    // Se clonan las notas (no se mutan las de SONGS): el id por ocurrencia
    // es local a esta partida y lo usa el modo libre.
    notesVis = song.notes.filter((n) => !hand || n.h === hand)
      .map((n, i) => ({ ...n, id: i }));
    const map = new Map();
    for (const n of notesVis) {
      if (!map.has(n.b)) map.set(n.b, []);
      map.get(n.b).push(n);
    }
    events = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([b, ns]) => ({ beat: b, notes: ns }));
  }

  function start(s, m, uiCallbacks, spd = 1) {
    song = s; mode = m; ui = uiCallbacks; speed = spd > 0 ? spd : 1;
    compile();
    songBeat = -2; eventIdx = 0; pending = null; errors = 0;
    hitMap = new Map(); freeStats = { hits: 0, wrong: 0 }; lastHitAt = new Map();
    countdown = m === 'free' ? FREE_COUNTDOWN : 0;
    listenPaused = false; pressed.clear(); lastProgress = ''; fx = [];
    running = true;
  }

  // Olvida las teclas mantenidas (si el teclado pierde un noteoff o se desconecta).
  function resetInput() {
    pressed.clear();
    lastHitAt.clear();
  }

  function stop() {
    resetInput();
    running = false;
  }

  // Velocidad de la canción: tempo × multiplicador (ajustable en vivo)
  function effBpm() { return song.bpm * speed; }
  function setSpeed(spd) { if (spd > 0) speed = spd; }

  // Un frame de simulación (lo usa el bucle y los tests automáticos).
  function step(dt) {
    update(dt);
  }

  // ── lógica ──
  function update(dt) {
    if (!running) return;

    if (hitMap.size) for (const [id, t] of hitMap) { if (t > 0) hitMap.set(id, Math.max(0, t - dt)); }

    if (mode === 'listen') {
      if (!listenPaused) {
        const bps = effBpm() / 60;
        const prev = songBeat;
        songBeat += bps * dt;
        for (const n of notesVis) {
          if (n.b > prev && n.b <= songBeat) {
            AudioEngine.playNote(n.m, { dur: n.d * 60 / effBpm(), vel: 95 });
          }
        }
        if (songBeat >= song.totalBeats + 2.5) { finish(true); return; }
      }
    } else if (mode === 'free') {
      // fase libre: cuenta atrás y luego la canción avanza siempre — sin frenadas ni esperas
      if (countdown > 0) {
        countdown = Math.max(0, countdown - dt);
      } else {
        songBeat += (effBpm() / 60) * dt;
        if (songBeat >= song.totalBeats + 1.5) { finishFree(); return; }
      }
    } else {
      if (!pending && eventIdx < events.length) {
        const target = events[eventIdx].beat;
        if (songBeat < target) {
          const bps = Math.max(1.1, effBpm() / 60);
          const BRAKE = 0.6;                                  // pulsos de frenada
          const dist = target - songBeat;
          let sp = bps;
          if (dist < BRAKE) sp = bps * Math.sqrt(Math.max(0, dist) / BRAKE); // ease-out
          songBeat = Math.min(target, songBeat + sp * dt);
          if (target - songBeat < 0.004) songBeat = target;   // enganchar en la línea
        }
        if (songBeat === target) {
          const ev = events[eventIdx];
          pending = { ev, need: new Set(ev.notes.map((n) => n.m)), got: new Set() };
        }
      }
      if (!pending && eventIdx >= events.length) {
        songBeat += dt * 2;
        if (songBeat >= song.totalBeats + 1.5) { finish(false); return; }
      }
    }

    const total = events.length || 1;
    const free = mode === 'free';
    const frac = mode === 'listen' || free
      ? Math.max(0, songBeat / song.totalBeats)
      : eventIdx / total;
    const meas = Math.min(song.totalBeats / song.beatsPerMeasure,
      Math.floor(Math.max(0, songBeat) / song.beatsPerMeasure) + 1);
    // en modo libre, idx/total son aciertos/notas totales (para el marcador)
    const idx = free ? freeStats.hits : eventIdx;
    const shown = free ? notesVis.length : total;
    const str = `${mode}:${frac.toFixed(3)}:${meas}:${errors}:${idx}`;
    if (str !== lastProgress && ui.progress) {
      lastProgress = str;
      ui.progress(frac, meas, songBeat, idx, shown, errors);
    }
  }

  // Nota recibida de su teclado (o del teclado de prueba)
  function noteon(midi, vel) {
    if (!running) return;
    pressed.add(midi);
    if (mode === 'listen') return;
    if (mode === 'free') { if (countdown <= 0) freeNoteon(midi); return; }
    if (pending && pending.need.has(midi)) {
      if (pending.got.has(midi)) return;      // repetir la misma tecla no penaliza
      pending.got.add(midi);
      fx.push({ type: 'hit', midi, burst: 10 });
      if (pending.got.size === pending.need.size) {
        pending = null;
        eventIdx++;
      }
    } else if (pending) {
      errors++;
      fx.push({ type: 'wrong', midi });
      AudioEngine.sfx('wrong');
    }
  }
  function noteoff(midi) { pressed.delete(midi); }

  // Fase libre: ¿hay un rectángulo de esa tecla cruzando la línea dorada ahora?
  // Sí → acierto (destello dorado + partículas + "ding"). No → ayudita (rojo suave).
  function freeNoteon(midi) {
    let best = null;
    for (const n of notesVis) {
      if (n.m !== midi || hitMap.has(n.id)) continue;      // esa ocurrencia ya está acertada
      const from = n.b - FREE_GRACE;
      const to = n.b + Math.max(n.d, 0.5) + FREE_TAIL;
      if (songBeat >= from && songBeat <= to && (!best || n.b < best.b)) best = n;
    }
    if (best) {
      hitMap.set(best.id, HIT_FADE);
      freeStats.hits++;
      fx.push({ type: 'hit', midi, burst: 14 });
      lastHitAt.set(midi, performance.now());
      AudioEngine.sfx('good');
      return;
    }
    const last = lastHitAt.get(midi);
    if (last !== undefined && performance.now() - last < REHIT_MERCY * 1000) return; // rebote: se ignora
    freeStats.wrong++;
    fx.push({ type: 'wrong', midi });
    AudioEngine.sfx('wrong');
  }

  function finish(listen) {
    stop();
    if (ui.finish) ui.finish({ listen, errors });
  }

  function finishFree() {
    stop();
    if (ui.finish) ui.finish({ free: true, hits: freeStats.hits, total: notesVis.length, wrong: freeStats.wrong });
  }

  // clic/toque sobre el escenario: pausa en modo Escuchar
  function tap() {
    if (running && mode === 'listen') listenPaused = !listenPaused;
  }

  // Recoge y vacía los efectos emitidos desde el último frame (para el renderizador).
  function takeFx() {
    const out = fx;
    fx = [];
    return out;
  }

  // depuración (consola del navegador): se combina con el tamaño del
  // renderizador en Game._dbg().
  function _dbg() {
    return {
      mode, running, speed, songBeat: +songBeat.toFixed(2), eventIdx, errors,
      free: mode === 'free' ? { ...freeStats, total: notesVis.length } : null,
      pending: pending ? { beat: pending.ev.beat, need: [...pending.need], got: [...pending.got] } : null,
      pressed: [...pressed],
    };
  }

  return {
    start, stop, resetInput, noteon, noteoff, tap, setSpeed, step, takeFx, _dbg,
    get running() { return running; },
    // Estado vivo que lee el renderizador cada frame (referencias, sólo lectura).
    get state() {
      return { song, mode, events, notesVis, songBeat, eventIdx, pending, errors, listenPaused, hitMap, freeStats, countdown, pressed };
    },
  };
};

export { GameEngine };
