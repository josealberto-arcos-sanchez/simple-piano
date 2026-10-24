// Canciones del método.
// Cada nota: { m: nota MIDI, b: pulso de inicio, d: duración en pulsos, h: mano ('R'|'L'), f: dedo }
// MIDI: DO central (C4) = 60 · DO grave (C3) = 48. Dedos: 1 = pulgar … 5 = meñique.

const NOTE_NAMES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
function midiToName(m) { return NOTE_NAMES[((m % 12) + 12) % 12]; }

const R = 'R', L = 'L';

// ── Himno de la Alegría (Beethoven) · Do mayor · 4/4 · 8 compases ──
// Mano derecha: melodía con 5 notas en posición fija (DO central).
// Mano izquierda: acompañamiento con DO y SOL. Ninguna mano salta de su sitio.
const ODE_TO_JOY = {
  id: 'himno-alegria',
  title: 'Himno de la Alegría',
  composer: 'L. van Beethoven',
  emoji: '🎶',
  bpm: 84,                 // tempo del modo Escuchar
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // primera tecla blanca visible del teclado guía (DO grave)
  whiteTo: 72,             // última (DO agudo) → 15 teclas blancas
  notes: [
    // ── Mano derecha (melodía) ──
    // compás 1
    { m: 64, b: 0,  d: 1, h: R, f: 3 }, { m: 64, b: 1,  d: 1, h: R, f: 3 },
    { m: 65, b: 2,  d: 1, h: R, f: 4 }, { m: 67, b: 3,  d: 1, h: R, f: 5 },
    // compás 2
    { m: 67, b: 4,  d: 1, h: R, f: 5 }, { m: 65, b: 5,  d: 1, h: R, f: 4 },
    { m: 64, b: 6,  d: 1, h: R, f: 3 }, { m: 62, b: 7,  d: 1, h: R, f: 2 },
    // compás 3
    { m: 60, b: 8,  d: 1, h: R, f: 1 }, { m: 60, b: 9,  d: 1, h: R, f: 1 },
    { m: 62, b: 10, d: 1, h: R, f: 2 }, { m: 64, b: 11, d: 1, h: R, f: 3 },
    // compás 4
    { m: 64, b: 12, d: 1, h: R, f: 3 }, { m: 62, b: 13, d: 1, h: R, f: 2 },
    { m: 62, b: 14, d: 2, h: R, f: 2 },
    // compás 5
    { m: 64, b: 16, d: 1, h: R, f: 3 }, { m: 64, b: 17, d: 1, h: R, f: 3 },
    { m: 65, b: 18, d: 1, h: R, f: 4 }, { m: 67, b: 19, d: 1, h: R, f: 5 },
    // compás 6
    { m: 67, b: 20, d: 1, h: R, f: 5 }, { m: 65, b: 21, d: 1, h: R, f: 4 },
    { m: 64, b: 22, d: 1, h: R, f: 3 }, { m: 62, b: 23, d: 1, h: R, f: 2 },
    // compás 7
    { m: 60, b: 24, d: 1, h: R, f: 1 }, { m: 60, b: 25, d: 1, h: R, f: 1 },
    { m: 62, b: 26, d: 1, h: R, f: 2 }, { m: 64, b: 27, d: 1, h: R, f: 3 },
    // compás 8
    { m: 62, b: 28, d: 1, h: R, f: 2 }, { m: 60, b: 29, d: 1, h: R, f: 1 },
    { m: 60, b: 30, d: 2, h: R, f: 1 },

    // ── Mano izquierda (acompañamiento: DO y SOL) ──
    { m: 48, b: 0,  d: 4, h: L, f: 5 },
    { m: 55, b: 4,  d: 4, h: L, f: 1 },
    { m: 48, b: 8,  d: 4, h: L, f: 5 },
    { m: 48, b: 12, d: 2, h: L, f: 5 }, { m: 55, b: 14, d: 2, h: L, f: 1 },
    { m: 48, b: 16, d: 4, h: L, f: 5 },
    { m: 55, b: 20, d: 4, h: L, f: 1 },
    { m: 48, b: 24, d: 4, h: L, f: 5 },
    { m: 55, b: 28, d: 2, h: L, f: 1 }, { m: 48, b: 30, d: 2, h: L, f: 5 },
  ],
};

const SONGS = [ODE_TO_JOY];
