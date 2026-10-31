// Renderizador Canvas del juego: recibe el estado del motor (js/game-engine.js)
// y lo dibuja. No contiene reglas de juego ni maneja entrada: sólo visuales
// (fondo, grid, notas que caen, línea de acierto, teclado guía, partículas,
// countdown y textos transitorios).

import { midiToName } from './songs.js';

const GameRenderer = (canvas, engine) => {
  const HAND = {
    R: { fill: '#22c55e' },  // mano derecha: verde
    L: { fill: '#6366f1' },  // mano izquierda: morado
  };
  const GOLD = '#ffd166';
  const RED = '#ef4444';
  const BLACK_SET = new Set([1, 3, 6, 8, 10]); // midi % 12 → tecla negra
  const HIT_FADE = 0.6;      // s del destello dorado (coincide con el motor)

  let ctx = canvas.getContext('2d'), W = 0, H = 0;
  let kb = null;                    // geometría del teclado guía
  let particles = [], hitFx = [], wrongFlash = null, shake = 0;

  // Gradientes que no dependen de la partida: se crean una sola vez en resize()
  // (fondo y línea de acierto en sus dos intensidades) y se reutilizan en cada frame.
  let bgGrad = null, hitLineGrad = null, hitLineStrongGrad = null;
  let xCache = new Map();           // midi → centro X de tecla (O(1))
  let keyIndex = new Map();         // midi → índice de tecla blanca

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

  function makeHitLineGrad(strong) {
    const g = ctx.createLinearGradient(0, kb.hitY - 3, 0, kb.hitY + 3);
    g.addColorStop(0, 'rgba(255,209,102,0)');
    g.addColorStop(0.5, `rgba(255,209,102,${0.9 * strong})`);
    g.addColorStop(1, 'rgba(255,209,102,0)');
    return g;
  }

  function cacheGeometry() {
    // tablas de búsqueda para geometría de teclas (evita indexOf/escaneos por frame)
    const from = engine.state.song.whiteFrom, to = engine.state.song.whiteTo;
    const whites = kb.whitesMidi;
    xCache = new Map();
    keyIndex = new Map();
    for (let i = 0; i < whites.length; i++) {
      keyIndex.set(whites[i], i);
      xCache.set(whites[i], (i + 0.5) * kb.kw);
    }
    // negras: sobre la frontera entre la blanca anterior y la siguiente
    for (let m = from; m <= to; m++) {
      if (xCache.has(m)) continue;
      let prevI = 0;
      for (let k = 0; k < whites.length; k++) { if (whites[k] < m) prevI = k; else break; }
      xCache.set(m, (prevI + 1) * kb.kw);
    }
  }

  function keyX(m) { return xCache.get(m) ?? 0; }   // centro horizontal de la tecla
  function keyWidth(m) { return isBlack(m) ? kb.kw * 0.58 : kb.kw * 0.84; }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    W = r.width; H = r.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const song = engine.state.song;
    kb = { whitesMidi: [] };
    const from = song.whiteFrom, to = song.whiteTo;
    for (let w = from; w <= to; w++) { if (!isBlack(w)) kb.whitesMidi.push(w); }
    layout();
    cacheGeometry();
    // gradientes cacheados (una sola creación por resize, no por frame)
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#171325');
    bgGrad.addColorStop(1, '#221b3a');
    hitLineGrad = makeHitLineGrad(0.55);
    hitLineStrongGrad = makeHitLineGrad(1);
  }

  // Traduce los efectos de un solo disparo del motor en estado visual.
  function applyFx() {
    for (const f of engine.takeFx()) {
      if (f.type === 'hit') {
        hitFx.push({ midi: f.midi, t: 0.5 });
        spawnParticles(f.midi, f.burst || 10);
      } else if (f.type === 'wrong') {
        wrongFlash = { midi: f.midi, t: 0.55 };
        shake = 0.55;
      }
    }
  }

  function spawnParticles(midi, count) {
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

  function draw(dt) {
    const st = engine.state;
    const now = performance.now() / 1000;
    applyFx();

    // temporizadores visuales (sólo feedback; no afectan a la simulación)
    shake = Math.max(0, shake - dt);
    if (wrongFlash) { wrongFlash.t -= dt; if (wrongFlash.t <= 0) wrongFlash = null; }
    hitFx.forEach((f) => (f.t -= dt));
    hitFx = hitFx.filter((f) => f.t > 0);
    particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.life -= dt; });
    particles = particles.filter((p) => p.life > 0);

    // fondo (gradiente cacheado en resize())
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    drawGrid(st);
    drawNotes(st, now);
    drawHitLine(st);
    drawKeyboard(st, now);
    drawParticles();
    if (st.countdown > 0) drawCountdown(st);
    else if (st.songBeat < 0) drawReady(st);
  }

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

  function drawGrid(st) {
    const bpm = st.song.beatsPerMeasure;
    for (let k = Math.max(0, Math.floor(st.songBeat)); k <= st.song.totalBeats; k++) {
      const y = kb.hitY - (k - st.songBeat) * kb.pxBeat;
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

  function drawNotes(st, now) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, kb.hitY); ctx.clip();  // nada baja de la línea

    for (const n of st.notesVis) {
      const w = keyWidth(n.m);
      const x = keyX(n.m) - w / 2;
      const y = kb.hitY - (n.b - st.songBeat) * kb.pxBeat;   // cabeza de la nota
      const h = Math.max(20, n.d * kb.pxBeat - 4);
      if (y < -h - 20 || y > kb.hitY + 24) continue;

      // modo libre: nota acertada → destello dorado que se apaga y desaparece
      const gold = st.mode === 'free' ? st.hitMap.get(n.id) : undefined;
      if (gold !== undefined && gold <= 0) continue;

      const isPend = st.pending && st.pending.ev.notes.includes(n);
      const isHit = st.pending && st.pending.got.has(n.m);
      const isPast = n.b < st.songBeat - 0.01;
      const c = HAND[n.h];

      let dx = 0;
      if (isPend && shake > 0) dx = Math.sin(now * 42) * 5 * (shake / 0.55);

      ctx.globalAlpha = gold !== undefined
        ? 0.25 + 0.75 * (gold / HIT_FADE)
        : (isPast && !isPend ? 0.45 : (isHit ? 0.55 : 1));
      // cuerpo (color sólido: evita crear un CanvasGradient por nota y por frame)
      ctx.fillStyle = gold !== undefined ? GOLD : c.fill;
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

  function drawHitLine(st) {
    // gradiente cacheado (dos intensidades según haya nota pendiente o no)
    ctx.fillStyle = st.pending ? hitLineStrongGrad : hitLineGrad;
    ctx.fillRect(0, kb.hitY - 3, W, 6);
    const strong = st.pending ? 1 : 0.55;
    ctx.fillStyle = `rgba(255,209,102,${0.25 * strong})`;
    ctx.fillRect(0, kb.hitY, W, 3);
  }

  function drawKeyboard(st, now) {
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
    for (const m of st.pressed) {
      const i = keyIndex.get(m);
      if (i !== undefined) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(i * kb.kw + 1, kb.y + 2, kb.kw - 2, kb.h - 4);
      }
    }
    // resaltado de teclas objetivo (modo espera) / activas (escuchar) / acierto / error
    const hl = new Map();   // midi → color
    if (st.pending) {
      for (const n of st.pending.ev.notes) {
        if (!st.pending.got.has(n.m)) hl.set(n.m, HAND[n.h].fill);
      }
    }
    if (st.mode === 'listen') {
      for (const n of st.notesVis) {
        if (n.b <= st.songBeat && st.songBeat < n.b + n.d) hl.set(n.m, HAND[n.h].fill);
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
    // consultas O(1) de destellos (evita .some()/.find() por tecla iluminada)
    const hitT = new Map();
    for (const f of hitFx) hitT.set(f.midi, f.t);
    for (const [m, color] of hl) {
      const t = hitT.get(m);
      const isWrong = wrongFlash && wrongFlash.midi === m;
      const alpha = t !== undefined ? 0.75 * (t / 0.5)
        : isWrong ? 0.6 * (wrongFlash.t / 0.55)
        : 0.5 + Math.sin(now * 6) * 0.15;   // pulso de objetivo
      drawKeyOverlay(m, color, Math.max(0.15, alpha));
    }
    // negras (encima de las blancas)
    const from = st.song.whiteFrom, to = st.song.whiteTo;
    for (let m = from; m <= to; m++) {
      if (!isBlack(m)) continue;
      const w = kb.kw * 0.58;
      const x = keyX(m) - w / 2;
      ctx.fillStyle = '#0b0913';
      roundRect(x, kb.y, w, kb.h * 0.62, 4);
      ctx.fill();
    }
    // badge con el número de dedo sobre la tecla objetivo
    if (st.pending) {
      for (const n of st.pending.ev.notes) {
        if (st.pending.got.has(n.m)) continue;
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

  function drawReady(st) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `800 ${Math.max(22, H * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const msg = st.mode === 'listen' ? '🔊 Escucha…' : st.mode === 'free' ? '🎵 ¡Tú tocas!' : '¡Preparada…!';
    ctx.fillText(msg, W / 2, kb.hitY * 0.4);
  }

  function drawCountdown(st) {
    const n = Math.ceil(st.countdown);
    const frac = st.countdown - Math.floor(st.countdown);   // 1 → 0 dentro de cada número
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.65 * frac;
    ctx.fillStyle = GOLD;
    ctx.font = `900 ${Math.max(64, H * 0.28) * (1 + 0.15 * frac)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), W / 2, kb.hitY * 0.45);
    ctx.restore();
  }

  function _size() {
    return { W: W.toFixed(0), H: H.toFixed(0) };
  }

  return { resize, draw, _size };
};

export { GameRenderer };
