// Motor de sonido (Web Audio API, síntesis tipo piano suave). Dos usos:
//  1. Modo "Escuchar": la app toca la canción.
//  2. Eco del teclado: si el teclado de casa no tiene altavoces, la app suena
//     al tocar (se activa desde la pantalla de conexión / ajustes).
// Las voces activas se registran internamente para poder cortarlas con
// stopAll()/stopNote() si se pierde un noteoff, se sale de la partida o se
// desconecta el teclado (evita notas "colgadas" y solapamiento de audio).

const AudioEngine = (() => {
  let ctx = null, master = null;
  let echoOn = false;
  const live = new Set();         // todas las voces activas (mantenidas + notas programadas)
  const heldByMidi = new Map();   // nota mantenida (eco) → voz, para cortarla por tecla

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
      // Se registra para poder cortarla con stopAll() si se sale de la partida.
      const voice = {
        stop() {
          const t = ctx.currentTime;
          try {
            out.gain.cancelScheduledValues(t);
            out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
            out.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          } catch (e) { /* ignore */ }
          endAt(t + 0.08);
          live.delete(voice);
        },
      };
      live.add(voice);
      // Al terminar sola (o poco después) deja de estar activa.
      setTimeout(() => live.delete(voice), Math.round((d + 0.25) * 1000));
      return null;
    }
    // nota mantenida (eco del teclado): decae y se corta al soltar.
    // Se registra para que stopAll()/stopNote() la corten si el teclado
    // pierde un noteoff o el jugador sale de la pantalla.
    const prev = heldByMidi.get(midi);
    if (prev) prev.stop();
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
    endAt(t0 + 2.65);
    const voice = {
      stop() {
        const t = ctx.currentTime;
        try {
          out.gain.cancelScheduledValues(t);
          out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
          out.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        } catch (e) { /* ignore */ }
        endAt(t + 0.1);
        live.delete(voice);
        if (heldByMidi.get(midi) === voice) heldByMidi.delete(midi);
      },
    };
    live.add(voice);
    heldByMidi.set(midi, voice);
    return voice;
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
    } else if (kind === 'good') {
      // "ding" de acierto en la fase libre (suave, para no tapar su piano)
      blip(1046.5, t, 0.12, 0.10);
      blip(1568, t + 0.06, 0.18, 0.09);
    } else if (kind === 'win') {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => blip(f, t + i * 0.09, 0.35, 0.2));
    } else if (kind === 'tap') {
      blip(660, t, 0.06, 0.08);
    }
  }

  // Corta una nota mantenida concreta (p. ej. al soltar su tecla). No hace nada si no suena.
  function stopNote(midi) {
    const v = heldByMidi.get(midi);
    if (v) v.stop();
  }

  // Corta todas las voces activas (notas mantenidas y notas del modo Escuchar).
  // Se usa al salir de la partida o al desconectarse el teclado MIDI.
  function stopAll() {
    for (const v of [...live]) {
      try { v.stop(); } catch (e) { /* ignore */ }
    }
    live.clear();
    heldByMidi.clear();
  }

  return {
    unlock, unlockOnGesture, playNote, sfx, stopNote, stopAll,
    setEcho(v) { echoOn = v; },
    get echo() { return echoOn; },
  };
})();

export { AudioEngine };
