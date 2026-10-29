// El escenario: notas que caen hacia el teclado guía (estilo SimplyPiano).
// El teclado de la pantalla es SÓLO guía: la niña toca en su piano real (Web MIDI).
// Modo espera: la nota frena en la línea de acierto y no avanza hasta acertar.

const Game = (() => {
  const HAND = {
    R: { fill: '#22c55e', edge: '#86efac' },  // mano derecha: verde
    L: { fill: '#6366f1', edge: '#a5b4fc' },  // mano izquierda: morado
  };
  const GOLD = '#ffd166';
  const RED = '#ef4444';
  const BLACK_SET = new Set([1, 3, 6, 8, 10]); // midi % 12 → tecla negra

  // ── fase 5: ¡Toca libre! (la canción no se para) ──
  const FREE_GRACE = 0.35;   // pulsos de ventana antes de que la cabeza toque la línea
  const FREE_TAIL = 0.15;    // margen tras terminar de cruzar el rectángulo
  const REHIT_MERCY = 0.25;  // s que se ignora un rebote de la misma tecla (sin castigo)
  const HIT_FADE = 0.6;      // s del destello dorado al acertar
  const FREE_COUNTDOWN = 3;  // s de cuenta atrás (3, 2, 1) antes de que empiece la canción

  // ── estado ──
  let canvas, ctx, W = 0, H = 0;
  let kb = null;                    // geometría del teclado guía
  let song = null, mode = 'both';
  let events = [], notesVis = [];   // eventos = notas agrupadas por pulso
  let songBeat = -2, eventIdx = 0, pending = null;
  let errors = 0;
  let running = false, rafId = 0, lastT = 0;
  let particles = [], hitFx = [], wrongFlash = null, shake = 0;
  let listenPaused = false;
  let speed = 1;                    // multiplicador de velocidad (🐢😊🐇, cambiable en vivo)
  let hitMap = new Map();           // modo libre: id de nota → s de destello dorada restantes
  let freeStats = { hits: 0, wrong: 0 };
  let countdown = 0;                // modo libre: s que faltan para que empiece la canción
  let lastHitAt = new Map();        // modo libre: cuándo se acertó cada tecla (anti-rebote)
  let ui = {};
  const pressed = new Set();        // teclas de su piano mantenidas ahora
  let lastProgress = '';

  function isBlack(m) { return BLACK_SET.has(((m % 12) + 12) % 12); }

  function layout() {
    const whites = kb.whitesMidi;
    kb.h = Math.max(110, Math.min(230, H * 0.30));
    kb.y = H - kb.h;
    kb.w = W;
    kb.kw = W / whites.length;
    kb.hitY = kb.y - 12;
    kb.pxBeat = kb.hitY / 4.6;      // ~4,5 pulsos visibles por pantalla
  }

  function keyX(m) {               // centro horizontal de la tecla
    const wm = kb.whitesMidi;
    const i = wm.indexOf(m);
    if (i >= 0) return (i + 0.5) * kb.kw;
    let prevI = 0;
    for (let k = 0; k < wm.length; k++) { if (wm[k] < m) prevI = k; else break; }
    return (prevI + 1) * kb.kw;    // las negras van sobre la frontera entre blancas
  }
  function keyWidth(m) { return isBlack(m) ? kb.kw * 0.58 : kb.kw * 0.84; }

  // Agrupa las notas (filtradas por mano según el modo) en eventos por pulso
  function compile() {
    const hand = { rh: 'R', lh: 'L' }[mode];
    notesVis = song.notes.filter((n) => !hand || n.h === hand);
    notesVis.forEach((n, i) => { n.id = i; });   // id por ocurrencia (lo usa el modo libre)
    const map = new Map();
    for (const n of notesVis) {
      if (!map.has(n.b)) map.set(n.b, []);
      map.get(n.b).push(n);
    }
    events = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([b, ns]) => ({ beat: b, notes: ns }));
  }

  function start(s, m, uiCallbacks, spd = 1) {
    song = s; mode = m; ui = uiCallbacks; speed = spd > 0 ? spd : 1;
    canvas = document.getElementById('stage');
    ctx = canvas.getContext('2d');
    kb = { whitesMidi: [] };
    const from = s.whiteFrom, to = s.whiteTo;
    for (let w = from; w <= to; w++) { if (!isBlack(w)) kb.whitesMidi.push(w); }
    compile();
    songBeat = -2; eventIdx = 0; pending = null; errors = 0;
    particles = []; hitFx = []; wrongFlash = null; shake = 0;
    hitMap = new Map(); freeStats = { hits: 0, wrong: 0 }; lastHitAt = new Map();
    countdown = m === 'free' ? FREE_COUNTDOWN : 0;
    listenPaused = false; pressed.clear(); lastProgress = '';
    resize();
    running = true; lastT = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stop() { running = false; cancelAnimationFrame(rafId); }

  // Velocidad de la canción: tempo × multiplicador (ajustable en vivo)
  function effBpm() { return song.bpm * speed; }
  function setSpeed(spd) { if (spd > 0) speed = spd; }

  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    W = r.width; H = r.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    step(dt);
    rafId = requestAnimationFrame(loop);
  }

  // un frame de simulación+ dibujo (lo usa el bucle y los tests automáticos)
  function step(dt) {
    update(dt);
    draw();
  }

  // ── lógica ──
  function update(dt) {
    shake = Math.max(0, shake - dt);
    if (wrongFlash) { wrongFlash.t -= dt; if (wrongFlash.t <= 0) wrongFlash = null; }
    hitFx.forEach((f) => (f.t -= dt));
    hitFx = hitFx.filter((f) => f.t > 0);
    if (hitMap.size) for (const [id, t] of hitMap) { if (t > 0) hitMap.set(id, Math.max(0, t - dt)); }
    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.life -= dt; });
    particles = particles.filter((p) => p.life > 0);

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
      hitFx.push({ midi, t: 0.5 });
      spawnParticles(midi);
      if (pending.got.size === pending.need.size) {
        pending = null;
        eventIdx++;
      }
    } else if (pending) {
      errors++;
      wrongFlash = { midi, t: 0.55 };
      shake = 0.55;
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
      hitFx.push({ midi, t: 0.5 });
      spawnParticles(midi, 14);
      lastHitAt.set(midi, performance.now());
      AudioEngine.sfx('good');
      return;
    }
    const last = lastHitAt.get(midi);
    if (last !== undefined && performance.now() - last < REHIT_MERCY * 1000) return; // rebote: se ignora
    freeStats.wrong++;
    wrongFlash = { midi, t: 0.55 };
    shake = 0.55;
    AudioEngine.sfx('wrong');
  }

  function spawnParticles(midi, count = 10) {
    const x = keyX(midi), y = kb.hitY;
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 260,
        vy: -120 - Math.random() * 220,
        life: 0.4 + Math.random() * 0.3,
        r: 2.5 + Math.random() * 3,
        color: Math.random() < 0.5 ? GOLD : '#ffffff',
      });
    }
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

  // ── dibujo ──
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function draw() {
    const now = performance.now() / 1000;
    // fondo
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#171325');
    bg.addColorStop(1, '#221b3a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawNotes(now);
    drawHitLine();
    drawKeyboard(now);
    drawParticles();
    if (countdown > 0) drawCountdown();
    else if (songBeat < 0) drawReady();
  }

  function drawGrid() {
    const bpm = song.beatsPerMeasure;
    for (let k = Math.max(0, Math.floor(songBeat)); k <= song.totalBeats; k++) {
      const y = kb.hitY - (k - songBeat) * kb.pxBeat;
      if (y < -4 || y > kb.hitY + 4) continue;
      const isMeasure = k % bpm === 0;
      ctx.strokeStyle = isMeasure ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (isMeasure) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = `600 11px system-ui, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`${k / bpm + 1}`, 8, y - 9);
      }
    }
  }

  function drawNotes(now) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, kb.hitY); ctx.clip();  // nada baja de la línea

    for (const n of notesVis) {
      const w = keyWidth(n.m);
      const x = keyX(n.m) - w / 2;
      const y = kb.hitY - (n.b - songBeat) * kb.pxBeat;   // cabeza de la nota
      const h = Math.max(20, n.d * kb.pxBeat - 4);
      if (y < -h - 20 || y > kb.hitY + 24) continue;

      // modo libre: nota acertada → destello dorado que se apaga y desaparece
      const gold = mode === 'free' ? hitMap.get(n.id) : undefined;
      if (gold !== undefined && gold <= 0) continue;

      const isPend = pending && pending.ev.notes.includes(n);
      const isHit = pending && pending.got.has(n.m);
      const isPast = n.b < songBeat - 0.01;
      const c = HAND[n.h];

      let dx = 0;
      if (isPend && shake > 0) dx = Math.sin(now * 42) * 5 * (shake / 0.55);

      ctx.globalAlpha = gold !== undefined
        ? 0.25 + 0.75 * (gold / HIT_FADE)
        : (isPast && !isPend ? 0.45 : (isHit ? 0.55 : 1));
      // cuerpo
      const grad = ctx.createLinearGradient(0, y - h, 0, y);
      if (gold !== undefined) {
        grad.addColorStop(0, '#fff7d6');
        grad.addColorStop(0.25, GOLD);
        grad.addColorStop(1, '#f59e0b');
      } else {
        grad.addColorStop(0, c.edge);
        grad.addColorStop(0.25, c.fill);
        grad.addColorStop(1, c.fill);
      }
      ctx.fillStyle = grad;
      roundRect(x + dx, y - h, w, h, 9);
      ctx.fill();
      // brillo superior
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(x + dx, y - h, w, Math.min(h * 0.3, 22), 9);
      ctx.fill();
      // borde
      ctx.strokeStyle = isPend ? '#ffffff' : 'rgba(0,0,0,0.25)';
      ctx.lineWidth = isPend ? 3 : 1.5;
      roundRect(x + dx, y - h, w, h, 9);
      ctx.stroke();

      // número de dedo (grande) + nombre de nota (pequeño)
      const pulse = isPend && !isHit ? 1 + Math.sin(now * 6) * 0.08 : 1;
      const numSize = Math.max(14, Math.min(26, kb.kw * 0.34)) * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${numSize}px system-ui, sans-serif`;
      ctx.fillText(n.f, x + dx + w / 2, y - Math.min(16, h * 0.35));
      if (h > 74) {
        ctx.font = `700 ${Math.max(10, kb.kw * 0.18)}px system-ui, sans-serif`;
        ctx.globalAlpha *= 0.75;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(midiToName(n.m), x + dx + w / 2, y - h + 16);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHitLine() {
    const glow = ctx.createLinearGradient(0, kb.hitY - 3, 0, kb.hitY + 3);
    const strong = pending ? 1 : 0.55;
    glow.addColorStop(0, `rgba(255,209,102,0)`);
    glow.addColorStop(0.5, `rgba(255,209,102,${0.9 * strong})`);
    glow.addColorStop(1, `rgba(255,209,102,0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, kb.hitY - 3, W, 6);
    ctx.fillStyle = `rgba(255,209,102,${0.25 * strong})`;
    ctx.fillRect(0, kb.hitY, W, 3);
  }

  function drawKeyboard(now) {
    const wm = kb.whitesMidi;
    // blancas
    for (let i = 0; i < wm.length; i++) {
      const m = wm[i];
      const x = i * kb.kw;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(x + 0.5, kb.y, kb.kw - 1, kb.h);
      // nombre de la nota (DO RE MI…)
      ctx.fillStyle = m === 60 ? '#0f172a' : '#64748b';
      ctx.font = `700 ${Math.max(10, Math.min(17, kb.kw * 0.24))}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(midiToName(m), x + kb.kw / 2, kb.y + kb.h - 8);
    }
    // teclas mantenidas por la niña ahora mismo (feedback vivo)
    for (const m of pressed) {
      const i = wm.indexOf(m);
      if (i >= 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(i * kb.kw + 1, kb.y + 2, kb.kw - 2, kb.h - 4);
      }
    }
    // resaltado de teclas objetivo (modo espera) / activas (escuchar) / acierto / error
    const hl = new Map();   // midi → color
    if (pending) {
      for (const n of pending.ev.notes) {
        if (!pending.got.has(n.m)) hl.set(n.m, HAND[n.h].fill);
      }
    }
    if (mode === 'listen') {
      for (const n of notesVis) {
        if (n.b <= songBeat && songBeat < n.b + n.d) hl.set(n.m, HAND[n.h].fill);
      }
    }
    for (const f of hitFx) {
      if (!hl.has(f.midi)) hl.set(f.midi, GOLD);
    }
    if (wrongFlash) hl.set(wrongFlash.midi, RED);

    const drawKeyOverlay = (m, color, alpha) => {
      const w = keyWidth(m);
      const x = keyX(m) - w / 2;
      const h = isBlack(m) ? kb.h * 0.62 : kb.h;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      roundRect(x + 1, kb.y + 1, w - 2, h - 2, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    for (const [m, color] of hl) {
      const isHitFx = hitFx.some((f) => f.midi === m);
      const isWrong = wrongFlash && wrongFlash.midi === m;
      const alpha = isHitFx ? 0.75 * (hitFx.find((f) => f.midi === m).t / 0.5)
        : isWrong ? 0.6 * (wrongFlash.t / 0.55)
        : 0.5 + Math.sin(now * 6) * 0.15;   // pulso de objetivo
      drawKeyOverlay(m, color, Math.max(0.15, alpha));
    }
    // negras (encima de las blancas)
    const from = song.whiteFrom, to = song.whiteTo;
    for (let m = from; m <= to; m++) {
      if (!isBlack(m)) continue;
      const w = kb.kw * 0.58;
      const x = keyX(m) - w / 2;
      ctx.fillStyle = '#0b0913';
      roundRect(x, kb.y, w, kb.h * 0.62, 4);
      ctx.fill();
    }
    // badge con el número de dedo sobre la tecla objetivo
    if (pending) {
      for (const n of pending.ev.notes) {
        if (pending.got.has(n.m)) continue;
        const x = keyX(n.m);
        const y = kb.y + kb.h * (isBlack(n.m) ? 0.30 : 0.42);
        const r = Math.max(11, kb.kw * 0.26) * (1 + Math.sin(now * 6) * 0.06);
        ctx.fillStyle = HAND[n.h].fill;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.max(11, r * 0.9)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.f, x, y + 1);
      }
    }
    // borde superior del teclado
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, kb.y, W, 2);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawReady() {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `800 ${Math.max(22, H * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const msg = mode === 'listen' ? '🔊 Escucha…' : mode === 'free' ? '🎵 ¡Tú tocas!' : '¡Preparada…!';
    ctx.fillText(msg, W / 2, kb.hitY * 0.4);
  }

  function drawCountdown() {
    const n = Math.ceil(countdown);
    const frac = countdown - Math.floor(countdown);   // 1 → 0 dentro de cada número
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * frac;
    ctx.fillStyle = GOLD;
    ctx.font = `900 ${Math.max(64, H * 0.28) * (1 + 0.15 * frac)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), W / 2, kb.hitY * 0.45);
    ctx.restore();
  }

  window.addEventListener('resize', () => { if (running) resize(); });

  // depuración (consola del navegador): Game._dbg() · Game._step(dt)
  function _dbg() {
    return {
      mode, running, speed, songBeat: +songBeat.toFixed(2), eventIdx, errors,
      free: mode === 'free' ? { ...freeStats, total: notesVis.length } : null,
      pending: pending ? { beat: pending.ev.beat, need: [...pending.need], got: [...pending.got] } : null,
      W: W.toFixed(0), H: H.toFixed(0),
    };
  }

  return { start, stop, noteon, noteoff, tap, resize, setSpeed, _dbg, _step: step };
})();
