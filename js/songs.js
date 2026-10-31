// Canciones del método.
// Cada nota: { m: nota MIDI, b: pulso de inicio, d: duración en pulsos, h: mano ('R'|'L'), f: dedo }
// MIDI: DO central (C4) = 60 · DO grave (C3) = 48. Dedos: 1 = pulgar … 5 = meñique.
// Cada canción en SONGS tiene los campos: id, title, composer, subtitle (opcional), emoji,
// bpm, beatsPerMeasure, totalBeats, whiteFrom, whiteTo, notes y level (id de su nivel en LEVELS).
// LEVELS es la lista de niveles: añadir un nivel nuevo = añadir un objeto a LEVELS.
// Todos los niveles están abiertos; la dificultad la marca el contenido de cada canción.

const NOTE_NAMES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
function midiToName(m) { return NOTE_NAMES[((m % 12) + 12) % 12]; }

const R = 'R', L = 'L';

// ── Niveles del método (número indeterminado: añadir más = añadir objetos aquí) ──
// Todos los niveles están siempre abiertos para todos los jugadores.
const LEVELS = [
  {
    id: 1,
    title: 'Nivel 1',
    emoji: '👉',
    name: 'Mano derecha',
    description: 'Sólo con la mano derecha, sin moverla de su sitio.',
  },
  {
    id: 2,
    title: 'Nivel 2',
    emoji: '👈',
    name: 'Mano izquierda',
    description: 'Sólo con la mano izquierda, sin moverla de su sitio.',
  },
  {
    id: 3,
    title: 'Nivel 3',
    emoji: '✨',
    name: 'Las dos manos',
    description: 'Canciones sencillas con las dos manos, sin moverlas de su sitio.',
  },
];

// ── Himno de la Alegría (Beethoven) · Do mayor · 4/4 · 8 compases ──
// Mano derecha: melodía con 5 notas en posición fija (DO central).
// Mano izquierda: acompañamiento con DO y SOL. Ninguna mano salta de su sitio.
const ODE_TO_JOY = {
  id: 'himno-alegria',
  title: 'Himno de la Alegría',
  composer: 'L. van Beethoven',
  subtitle: 'Nivel 3 · Do mayor',
  emoji: '🎶',
  level: 3,
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

// ── Un pequeño sueño (original) · Do mayor · 4/4 · 8 compases ──
// Mano derecha: melodía en posición de DO central. Mano izquierda: una nota larga por compás.
const UN_PEQUENO_SUENO = {
  id: 'pequeno-sueno',
  title: 'Un pequeño sueño',
  composer: 'ChatGPT',
  subtitle: 'Nivel 3 · Do mayor',
  emoji: '🌙',
  level: 3,
  bpm: 65,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: [
    // ── Mano derecha (melodía) ──
    // compás 1
    { m: 64, b: 0,  d: 1, h: R, f: 3 }, { m: 67, b: 1,  d: 1, h: R, f: 5 },
    { m: 67, b: 2,  d: 1, h: R, f: 5 }, { m: 64, b: 3,  d: 1, h: R, f: 3 },
    // compás 2
    { m: 62, b: 4,  d: 1, h: R, f: 2 }, { m: 64, b: 5,  d: 1, h: R, f: 3 },
    { m: 60, b: 6,  d: 2, h: R, f: 1 },
    // compás 3
    { m: 64, b: 8,  d: 1, h: R, f: 3 }, { m: 65, b: 9,  d: 1, h: R, f: 4 },
    { m: 67, b: 10, d: 1, h: R, f: 5 }, { m: 64, b: 11, d: 1, h: R, f: 3 },
    // compás 4
    { m: 62, b: 12, d: 1, h: R, f: 2 }, { m: 60, b: 13, d: 3, h: R, f: 1 },
    // compás 5
    { m: 64, b: 16, d: 1, h: R, f: 3 }, { m: 67, b: 17, d: 1, h: R, f: 5 },
    { m: 67, b: 18, d: 1, h: R, f: 5 }, { m: 64, b: 19, d: 1, h: R, f: 3 },
    // compás 6
    { m: 62, b: 20, d: 1, h: R, f: 2 }, { m: 64, b: 21, d: 1, h: R, f: 3 },
    { m: 67, b: 22, d: 2, h: R, f: 5 },
    // compás 7
    { m: 67, b: 24, d: 1, h: R, f: 5 }, { m: 65, b: 25, d: 1, h: R, f: 4 },
    { m: 64, b: 26, d: 1, h: R, f: 3 }, { m: 62, b: 27, d: 1, h: R, f: 2 },
    // compás 8
    { m: 60, b: 28, d: 4, h: R, f: 1 },

    // ── Mano izquierda (una nota larga por compás) ──
    { m: 48, b: 0,  d: 4, h: L, f: 5 },
    { m: 55, b: 4,  d: 4, h: L, f: 1 },
    { m: 53, b: 8,  d: 4, h: L, f: 2 },
    { m: 48, b: 12, d: 4, h: L, f: 5 },
    { m: 48, b: 16, d: 4, h: L, f: 5 },
    { m: 55, b: 20, d: 4, h: L, f: 1 },
    { m: 53, b: 24, d: 4, h: L, f: 2 },
    { m: 48, b: 28, d: 4, h: L, f: 5 },
  ],
};

// ── El primer rayo de sol (Gemini) · Do mayor · 4/4 · 8 compases ──
// Posición fija de Do mayor: ninguna mano se mueve de sitio.
// Mano derecha: melodía con las 5 notas centrales. Mano izquierda: una nota larga por compás.
const PRIMER_RAYO_DE_SOL = {
  id: 'primer-rayo-sol',
  title: 'El primer rayo de sol',
  composer: 'Gemini',
  subtitle: 'Nivel 3 · Do mayor',
  emoji: '☀️',
  level: 3,
  bpm: 72,                // tempo tranquilo y fluido
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,          // DO grave
  whiteTo: 72,            // DO agudo → 15 teclas blancas
  notes: [
    // ── Mano derecha (melodía) ──
    // compás 1
    { m: 60, b: 0,  d: 1, h: R, f: 1 }, { m: 62, b: 1,  d: 1, h: R, f: 2 },
    { m: 64, b: 2,  d: 1, h: R, f: 3 }, { m: 67, b: 3,  d: 1, h: R, f: 5 },
    // compás 2 (silencio en el 4º tiempo)
    { m: 64, b: 4,  d: 1, h: R, f: 3 }, { m: 62, b: 5,  d: 1, h: R, f: 2 },
    { m: 60, b: 6,  d: 1, h: R, f: 1 },
    // compás 3
    { m: 64, b: 8,  d: 1, h: R, f: 3 }, { m: 65, b: 9,  d: 1, h: R, f: 4 },
    { m: 67, b: 10, d: 1, h: R, f: 5 }, { m: 64, b: 11, d: 1, h: R, f: 3 },
    // compás 4
    { m: 62, b: 12, d: 4, h: R, f: 2 },
    // compás 5
    { m: 67, b: 16, d: 1, h: R, f: 5 }, { m: 65, b: 17, d: 1, h: R, f: 4 },
    { m: 64, b: 18, d: 1, h: R, f: 3 }, { m: 62, b: 19, d: 1, h: R, f: 2 },
    // compás 6
    { m: 60, b: 20, d: 1, h: R, f: 1 }, { m: 64, b: 21, d: 1, h: R, f: 3 },
    { m: 67, b: 22, d: 1, h: R, f: 5 }, { m: 64, b: 23, d: 1, h: R, f: 3 },
    // compás 7 (4º tiempo: Do para mantener la posición fija)
    { m: 62, b: 24, d: 1, h: R, f: 2 }, { m: 64, b: 25, d: 1, h: R, f: 3 },
    { m: 62, b: 26, d: 1, h: R, f: 2 }, { m: 60, b: 27, d: 1, h: R, f: 1 },
    // compás 8 (final dulce: Do sostenido)
    { m: 60, b: 28, d: 4, h: R, f: 1 },

    // ── Mano izquierda (una nota larga por compás) ──
    { m: 48, b: 0,  d: 4, h: L, f: 5 },
    { m: 55, b: 4,  d: 3, h: L, f: 1 },
    { m: 48, b: 8,  d: 4, h: L, f: 5 },
    { m: 55, b: 12, d: 4, h: L, f: 1 },
    { m: 52, b: 16, d: 4, h: L, f: 3 },
    { m: 48, b: 20, d: 4, h: L, f: 5 },
    { m: 55, b: 24, d: 4, h: L, f: 1 },
    { m: 48, b: 28, d: 4, h: L, f: 5 },
  ],
};

// ── Mary tenía un corderito (Popular) · Do mayor · 4/4 · 8 compases ──
// Nivel 1: mano derecha SOLA, posición fija de Do central (60–67). Ninguna mano salta.
const MARY_CORDERITO = {
  id: 'mary-corderito',
  title: 'Mary tenía un corderito',
  composer: 'Popular',
  subtitle: 'Nivel 1 · Mano derecha · Do mayor',
  emoji: '🐑',
  bpm: 76,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  level: 1,
  notes: [
    // ── Mano derecha (melodía) ──
    // compás 1
    { m: 64, b: 0,  d: 1, h: R, f: 3 }, { m: 62, b: 1,  d: 1, h: R, f: 2 },
    { m: 60, b: 2,  d: 1, h: R, f: 1 }, { m: 62, b: 3,  d: 1, h: R, f: 2 },
    // compás 2
    { m: 64, b: 4,  d: 1, h: R, f: 3 }, { m: 64, b: 5,  d: 1, h: R, f: 3 },
    { m: 64, b: 6,  d: 2, h: R, f: 3 },
    // compás 3
    { m: 62, b: 8,  d: 1, h: R, f: 2 }, { m: 62, b: 9,  d: 1, h: R, f: 2 },
    { m: 62, b: 10, d: 2, h: R, f: 2 },
    // compás 4
    { m: 64, b: 12, d: 1, h: R, f: 3 }, { m: 67, b: 13, d: 1, h: R, f: 5 },
    { m: 67, b: 14, d: 2, h: R, f: 5 },
    // compás 5 (como el 1)
    { m: 64, b: 16, d: 1, h: R, f: 3 }, { m: 62, b: 17, d: 1, h: R, f: 2 },
    { m: 60, b: 18, d: 1, h: R, f: 1 }, { m: 62, b: 19, d: 1, h: R, f: 2 },
    // compás 6
    { m: 64, b: 20, d: 1, h: R, f: 3 }, { m: 64, b: 21, d: 1, h: R, f: 3 },
    { m: 64, b: 22, d: 1, h: R, f: 3 }, { m: 64, b: 23, d: 1, h: R, f: 3 },
    // compás 7
    { m: 62, b: 24, d: 1, h: R, f: 2 }, { m: 62, b: 25, d: 1, h: R, f: 2 },
    { m: 64, b: 26, d: 1, h: R, f: 3 }, { m: 62, b: 27, d: 1, h: R, f: 2 },
    // compás 8
    { m: 60, b: 28, d: 4, h: R, f: 1 },
  ],
};

// ── Pan caliente (Popular) · Do mayor · 4/4 · 5 compases ──
// Nivel 1: mano derecha SOLA, posición fija de Do central (60–67).
const PAN_CALIENTE = {
  id: 'pan-caliente',
  title: 'Pan caliente',
  composer: 'Popular',
  subtitle: 'Nivel 1 · Mano derecha · Do mayor',
  emoji: '🥖',
  bpm: 84,
  beatsPerMeasure: 4,
  totalBeats: 20,
  whiteFrom: 48,
  whiteTo: 72,
  level: 1,
  notes: [
    // ── Mano derecha (melodía) ──
    { m: 64, b: 0,  d: 1, h: R, f: 3 }, { m: 62, b: 1,  d: 1, h: R, f: 2 },
    { m: 60, b: 2,  d: 1, h: R, f: 1 },
    { m: 64, b: 4,  d: 1, h: R, f: 3 }, { m: 62, b: 5,  d: 1, h: R, f: 2 },
    { m: 60, b: 6,  d: 1, h: R, f: 1 },
    { m: 60, b: 8,  d: 1, h: R, f: 1 }, { m: 60, b: 9,  d: 1, h: R, f: 1 },
    { m: 60, b: 10, d: 1, h: R, f: 1 }, { m: 60, b: 11, d: 1, h: R, f: 1 },
    { m: 62, b: 12, d: 1, h: R, f: 2 }, { m: 62, b: 13, d: 1, h: R, f: 2 },
    { m: 62, b: 14, d: 1, h: R, f: 2 }, { m: 62, b: 15, d: 1, h: R, f: 2 },
    { m: 64, b: 16, d: 1, h: R, f: 3 }, { m: 62, b: 17, d: 1, h: R, f: 2 },
    { m: 60, b: 18, d: 2, h: R, f: 1 },
  ],
};

// ── El tren de madera (original) · Do mayor · 4/4 · 6 compases ──
// Nivel 2: mano izquierda SOLA, posición fija de Do grave (48–55).
const TREN_MADERA = {
  id: 'tren-madera',
  title: 'El tren de madera',
  composer: 'Original',
  subtitle: 'Nivel 2 · Mano izquierda · Do mayor',
  emoji: '🚂',
  bpm: 72,
  beatsPerMeasure: 4,
  totalBeats: 24,
  whiteFrom: 48,
  whiteTo: 72,
  level: 2,
  notes: [
    // ── Mano izquierda (melodía) ──
    { m: 55, b: 0,  d: 1, h: L, f: 1 }, { m: 55, b: 1,  d: 1, h: L, f: 1 },
    { m: 48, b: 2,  d: 1, h: L, f: 5 }, { m: 48, b: 3,  d: 1, h: L, f: 5 },
    { m: 50, b: 4,  d: 1, h: L, f: 4 }, { m: 50, b: 5,  d: 1, h: L, f: 4 },
    { m: 52, b: 6,  d: 1, h: L, f: 3 }, { m: 52, b: 7,  d: 1, h: L, f: 3 },
    { m: 48, b: 8,  d: 1, h: L, f: 5 }, { m: 48, b: 9,  d: 1, h: L, f: 5 },
    { m: 55, b: 10, d: 1, h: L, f: 1 }, { m: 55, b: 11, d: 1, h: L, f: 1 },
    { m: 52, b: 12, d: 1, h: L, f: 3 }, { m: 50, b: 13, d: 1, h: L, f: 4 },
    { m: 48, b: 14, d: 1, h: L, f: 5 }, { m: 48, b: 15, d: 1, h: L, f: 5 },
    { m: 55, b: 16, d: 1, h: L, f: 1 }, { m: 55, b: 17, d: 1, h: L, f: 1 },
    { m: 52, b: 18, d: 1, h: L, f: 3 }, { m: 50, b: 19, d: 1, h: L, f: 4 },
    { m: 48, b: 20, d: 4, h: L, f: 5 },
  ],
};

// ── La ronda del sol (original) · Do mayor · 4/4 · 8 compases ──
// Nivel 2: mano izquierda SOLA, posición fija de Do grave (48–55).
const RONDA_SOL = {
  id: 'ronda-sol',
  title: 'La ronda del sol',
  composer: 'Original',
  subtitle: 'Nivel 2 · Mano izquierda · Do mayor',
  emoji: '🌞',
  bpm: 76,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,
  whiteTo: 72,
  level: 2,
  notes: [
    // ── Mano izquierda (melodía) ──
    // compás 1
    { m: 48, b: 0,  d: 1, h: L, f: 5 }, { m: 52, b: 1,  d: 1, h: L, f: 3 },
    { m: 55, b: 2,  d: 1, h: L, f: 1 }, { m: 52, b: 3,  d: 1, h: L, f: 3 },
    // compás 2
    { m: 50, b: 4,  d: 1, h: L, f: 4 }, { m: 55, b: 5,  d: 1, h: L, f: 1 },
    { m: 52, b: 6,  d: 1, h: L, f: 3 }, { m: 50, b: 7,  d: 1, h: L, f: 4 },
    // compás 3
    { m: 48, b: 8,  d: 1, h: L, f: 5 }, { m: 52, b: 9,  d: 1, h: L, f: 3 },
    { m: 55, b: 10, d: 1, h: L, f: 1 }, { m: 52, b: 11, d: 1, h: L, f: 3 },
    // compás 4
    { m: 52, b: 12, d: 1, h: L, f: 3 }, { m: 50, b: 13, d: 1, h: L, f: 4 },
    { m: 48, b: 14, d: 1, h: L, f: 5 }, { m: 48, b: 15, d: 1, h: L, f: 5 },
    // compás 5
    { m: 55, b: 16, d: 1, h: L, f: 1 }, { m: 52, b: 17, d: 1, h: L, f: 3 },
    { m: 50, b: 18, d: 1, h: L, f: 4 }, { m: 50, b: 19, d: 1, h: L, f: 4 },
    // compás 6
    { m: 52, b: 20, d: 1, h: L, f: 3 }, { m: 50, b: 21, d: 1, h: L, f: 4 },
    { m: 48, b: 22, d: 1, h: L, f: 5 }, { m: 50, b: 23, d: 1, h: L, f: 4 },
    // compás 7
    { m: 52, b: 24, d: 1, h: L, f: 3 }, { m: 55, b: 25, d: 1, h: L, f: 1 },
    { m: 52, b: 26, d: 1, h: L, f: 3 }, { m: 50, b: 27, d: 1, h: L, f: 4 },
    // compás 8
    { m: 48, b: 28, d: 4, h: L, f: 5 },
  ],
};

const SONGS = [ODE_TO_JOY, UN_PEQUENO_SUENO, PRIMER_RAYO_DE_SOL, MARY_CORDERITO, PAN_CALIENTE, TREN_MADERA, RONDA_SOL];

export { SONGS, LEVELS, R, L, midiToName };
