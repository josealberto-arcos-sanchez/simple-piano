// Motor de sonido (Web Audio API, síntesis tipo piano suave). Dos usos:
//  1. Modo "Escuchar": la app toca la canción.
//  2. Eco del teclado: si el teclado de casa no tiene altavoces, la app suena
//     al tocar (se activa desde la pantalla de conexión / ajustes).

const AudioEngine = (() => {
  let ctx = null, master = null;
  let echoOn = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Los móviles exigen un gesto del usuario antes de dejar sonar audio.
  function unlock() { try { ensure(); } catch (e) { /* ignore */ } }

  // Registra un gesto único (primer toque en cualquier sitio) para desbloquear.
  function unlockOnGesture() {
    const once = () => { unlock(); window.removeEventListener('pointerdown', once); };
    window.addEventListener('pointerdown', once);
  }

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Suena una nota. opts: { vel: 0-127, dur: segundos (si se omite, suena hasta stop()) }
  function playNote(midi, opts = {}) {
    ensure();
    const t0 = ctx.currentTime;
    const vel = Math.min(1, (opts.vel ?? 100) / 127);
    const f = midiToFreq(midi);
    const out = ctx.createGain();
    out.connect(master);

    const oscs = [];
    const partials = [[1, 1], [2, 0.45], [3, 0.18], [4.01, 0.07]];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      o.connect(g); g.connect(out);
      o.start(t0);
      oscs.push(o);
    }
    const endAt = (t) => oscs.forEach((o) => { try { o.stop(t); } catch (e) { /* ignore */ } });

    const peak = 0.35 * vel;
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);

    if (opts.dur) {
      const d = Math.max(0.12, opts.dur);
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      endAt(t0 + d + 0.2);
      return null;
    }
    // nota mantenida (eco del teclado): decae y se corta al soltar
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
    endAt(t0 + 2.65);
    return {
      stop() {
        const t = ctx.currentTime;
        try {
          out.gain.cancelScheduledValues(t);
          out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
          out.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        } catch (e) { /* ignore */ }
        endAt(t + 0.1);
      },
    };
  }

  function blip(freq, when, dur, gain, type = 'triangle') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.start(when); o.stop(when + dur + 0.05);
  }

  // Efectos suaves
  function sfx(kind) {
    ensure();
    const t = ctx.currentTime;
    if (kind === 'wrong') {
      // "bump" suave, nada castigador
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.15);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.2);
    } else if (kind === 'win') {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => blip(f, t + i * 0.09, 0.35, 0.2));
    } else if (kind === 'tap') {
      blip(660, t, 0.06, 0.08);
    }
  }

  return {
    unlock, unlockOnGesture, playNote, sfx,
    setEcho(v) { echoOn = v; },
    get echo() { return echoOn; },
  };
})();
