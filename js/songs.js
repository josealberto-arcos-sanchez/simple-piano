// Canciones del método.
// Formato interno de cada nota: { m: nota MIDI, b: pulso de inicio, d: duración en pulsos,
// h: mano ('R'|'L'), f: dedo }
// MIDI: DO central (C4) = 60 · DO grave (C3) = 48. Dedos: 1 = pulgar … 5 = meñique.
//
// Cada canción en SONGS tiene los campos: id, title, composer, subtitle (opcional), emoji,
// bpm, beatsPerMeasure, totalBeats, whiteFrom, whiteTo, notes y level (id de su nivel en LEVELS).
// LEVELS es la lista de niveles: añadir un nivel nuevo = añadir un objeto a LEVELS.
// Todos los niveles están abiertos; la dificultad la marca el contenido de cada canción.
//
// NOTACIÓN COMPACTA (recomendada) para notes: en lugar de escribir `b` a mano, se definen
// pistas por mano (R / L) con tokens y el pulsador calcula el pulso b automáticamente:
//   notes: {
//     R: [ 'E4:1/3', 'D4:1/2', ... ],   // mano derecha
//     L: [ 'C3:4/5', 'G3:4/1', ... ],   // mano izquierda
//   }
// Token de nota:   'NOTA:duración/dedo'  (p. ej. 'E4:1/3' = MI4, negra, dedo 3)
//                   'NOTA' → negra (duración 1) sin dedo (la validación avisará)
// Acorde:          [ 'C4:4/1', 'E4:4/3' ]  o 'C4+E4:G4' → suenan juntas en el mismo pulso;
//                   el cursor avanza con la duración más larga del acorde.
// Silencio:        '&:1' → salta 1 pulso (también '&:0.5', '&:2', …)
// Salto absoluto:  '@12' → coloca el cursor en el pulso 12 (recupera el sitio tras un
//                   silencio largo o para empezar en un compás distinto).
// El formato clásico (array de objetos { m, b, d, h, f }) sigue siendo válido.

const NOTE_NAMES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
function midiToName(m) { return NOTE_NAMES[((m % 12) + 12) % 12]; }

// Nombre de nota ('C3', 'E4', 'F#4', 'Bb3'…) → número MIDI. NaN si el nombre es inválido.
const NOTE_BASE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function midiFromName(name) {
  const m = /^([a-gA-G])([#b]?)(\d)$/.exec(String(name).trim());
  if (!m) return NaN;
  const base = NOTE_BASE[m[1].toLowerCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const oct = parseInt(m[3], 10);
  return base + acc + (oct + 1) * 12;
}

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
  {
    id: 4,
    title: 'Nivel 4',
    emoji: '🤝',
    name: 'Manos en equipo',
    description: 'Las dos manos se ayudan: una llama y la otra responde, o tocan acordes sencillos juntas, sin moverse de sitio.',
  },
];

// ── Compilador de la notación compacta → formato interno ──
// Devuelve { jump } (salto @), { rest } (silencio &) o { m, d, f } (nota).
function parseNoteToken(tok) {
  const t = String(tok).trim();
  if (!t) return null;
  if (t[0] === '@') {
    const beat = parseFloat(t.slice(1));
    return { jump: Number.isFinite(beat) && beat >= 0 ? beat : 0 };
  }
  if (t[0] === '&') {
    // '&' o '&:duración' (p. ej. '&:1', '&:0.5', '&:4').
    // El separador es ':' (igual que en las notas); si falta o es inválido, 1 pulso.
    let d = 1;
    const c = t.indexOf(':');
    if (c >= 0) {
      const v = parseFloat(t.slice(c + 1));
      if (Number.isFinite(v) && v > 0) d = v;
    }
    return { rest: d };
  }
  const i = t.indexOf(':');
  const name = (i >= 0 ? t.slice(0, i) : t).trim();
  const spec = i >= 0 ? t.slice(i + 1).trim() : '';
  let dur = 1, finger = null;
  if (spec) {
    const [ds, fs] = spec.split('/');
    if (ds !== undefined && ds !== '') { const d = parseFloat(ds); if (Number.isFinite(d) && d > 0) dur = d; }
    if (fs !== undefined && fs !== '') { const f = parseInt(fs, 10); if (Number.isInteger(f)) finger = f; }
  }
  return { m: midiFromName(name), d: dur, f: finger };
}

// Convierte una pista de tokens en notas { m, b, d, h, f } con pulso b automático.
function compileTrack(tokens, hand) {
  const out = [];
  let beat = 0;
  for (const tok of tokens) {
    if (Array.isArray(tok)) {
      // acorde: todas las notas suenan en `beat`; el cursor avanza la duración más larga
      let maxD = 0;
      for (const sub of tok) {
        const p = parseNoteToken(sub);
        if (!p || p.jump !== undefined || p.rest !== undefined) continue;
        out.push({ m: p.m, b: beat, d: p.d, h: hand, f: p.f });
        maxD = Math.max(maxD, p.d);
      }
      beat += maxD;
      continue;
    }
    const p = parseNoteToken(tok);
    if (!p) continue;
    if (p.jump !== undefined) { beat = p.jump; continue; }
    if (p.rest !== undefined) { beat += p.rest; continue; }
    out.push({ m: p.m, b: beat, d: p.d, h: hand, f: p.f });
    beat += p.d;
  }
  return out;
}

// Acepta el formato interno (array) o la notación compacta ({ R: [...], L: [...] }).
function compileNotes(notes) {
  if (Array.isArray(notes)) return notes;
  const out = [];
  for (const h of [R, L]) {
    const toks = notes[h];
    if (Array.isArray(toks)) out.push(...compileTrack(toks, h));
  }
  return out;
}

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
  notes: {
    R: [
      // compases 1–2
      'E4:1/3', 'E4:1/3', 'F4:1/4', 'G4:1/5',
      'G4:1/5', 'F4:1/4', 'E4:1/3', 'D4:1/2',
      // compases 3–4
      'C4:1/1', 'C4:1/1', 'D4:1/2', 'E4:1/3',
      'E4:1/3', 'D4:1/2', 'D4:2/2',
      // compases 5–6
      'E4:1/3', 'E4:1/3', 'F4:1/4', 'G4:1/5',
      'G4:1/5', 'F4:1/4', 'E4:1/3', 'D4:1/2',
      // compases 7–8
      'C4:1/1', 'C4:1/1', 'D4:1/2', 'E4:1/3',
      'D4:1/2', 'C4:1/1', 'C4:2/1',
    ],
    L: [
      'C3:4/5', 'G3:4/1', 'C3:4/5', 'C3:2/5', 'G3:2/1',
      'C3:4/5', 'G3:4/1', 'C3:4/5', 'G3:2/1', 'C3:2/5',
    ],
  },
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
  notes: {
    R: [
      'E4:1/3', 'G4:1/5', 'G4:1/5', 'E4:1/3',
      'D4:1/2', 'E4:1/3', 'C4:2/1',
      'E4:1/3', 'F4:1/4', 'G4:1/5', 'E4:1/3',
      'D4:1/2', 'C4:3/1',
      'E4:1/3', 'G4:1/5', 'G4:1/5', 'E4:1/3',
      'D4:1/2', 'E4:1/3', 'G4:2/5',
      'G4:1/5', 'F4:1/4', 'E4:1/3', 'D4:1/2',
      'C4:4/1',
    ],
    L: [
      'C3:4/5', 'G3:4/1', 'E3:4/2', 'C3:4/5',
      'C3:4/5', 'G3:4/1', 'E3:4/2', 'C3:4/5',
    ],
  },
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
  notes: {
    R: [
      'C4:1/1', 'D4:1/2', 'E4:1/3', 'G4:1/5',
      'E4:1/3', 'D4:1/2', 'C4:1/1', '&:1',   // compás 2 con silencio en el 4º tiempo
      'E4:1/3', 'F4:1/4', 'G4:1/5', 'E4:1/3',
      'D4:4/2',
      'G4:1/5', 'F4:1/4', 'E4:1/3', 'D4:1/2',
      'C4:1/1', 'E4:1/3', 'G4:1/5', 'E4:1/3',
      'D4:1/2', 'E4:1/3', 'D4:1/2', 'C4:1/1',
      'C4:4/1',
    ],
    L: [
      'C3:4/5', 'G3:3/1', 'C3:4/5', 'G3:4/1',
      'E3:4/3', 'C3:4/5', 'G3:4/1', 'C3:4/5',
    ],
  },
};

// ── Dulce Navidad / Jingle Bells (J. L. Pierpont) · Do mayor · 4/4 · 8 compases ──
// Posición fija de Do mayor: ninguna mano se mueve de sitio.
// Mano derecha: estribillo clásico con las 5 notas centrales (DO4–SOL4).
// Mano izquierda: acompañamiento armónico de redondas (DO3, FA3 y SOL3).
const DULCE_NAVIDAD = {
  id: 'dulce-navidad',
  title: 'Dulce Navidad',
  composer: 'J. L. Pierpont',
  subtitle: 'Nivel 3 · Do mayor',
  emoji: '🎄',
  level: 3,
  bpm: 84,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: {
    R: [
      // compases 1–2
      'E4:1/3', 'E4:1/3', 'E4:2/3',
      'E4:1/3', 'E4:1/3', 'E4:2/3',
      // compases 3–4
      'E4:1/3', 'G4:1/5', 'C4:1/1', 'D4:1/2',
      'E4:4/3',
      // compases 5–6
      'F4:1/4', 'F4:1/4', 'F4:1/4', 'F4:1/4',
      'F4:1/4', 'E4:1/3', 'E4:1/3', 'E4:1/3',
      // compases 7–8
      'G4:1/5', 'G4:1/5', 'F4:1/4', 'D4:1/2',
      'C4:4/1',
    ],
    L: [
      'C3:4/5', 'G3:4/1', 'C3:4/5', 'G3:4/1',
      'F3:4/2', 'C3:4/5', 'G3:4/1', 'C3:4/5',
    ],
  },
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
  notes: {
    R: [
      'E4:1/3', 'D4:1/2', 'C4:1/1', 'D4:1/2',
      'E4:1/3', 'E4:1/3', 'E4:2/3',
      'D4:1/2', 'D4:1/2', 'D4:2/2',
      'E4:1/3', 'G4:1/5', 'G4:2/5',
      'E4:1/3', 'D4:1/2', 'C4:1/1', 'D4:1/2',
      'E4:1/3', 'E4:1/3', 'E4:1/3', 'E4:1/3',
      'D4:1/2', 'D4:1/2', 'E4:1/3', 'D4:1/2',
      'C4:4/1',
    ],
  },
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
  notes: {
    R: [
      'E4:1/3', 'D4:1/2', 'C4:1/1', '&:1',
      'E4:1/3', 'D4:1/2', 'C4:1/1', '&:1',
      'C4:1/1', 'C4:1/1', 'C4:1/1', 'C4:1/1',
      'D4:1/2', 'D4:1/2', 'D4:1/2', 'D4:1/2',
      'E4:1/3', 'D4:1/2', 'C4:2/1',
    ],
  },
};

// ── Claro de luna / Au clair de la lune (Tradicional) · Do mayor · 4/4 · 8 compases ──
// Nivel 1: mano derecha SOLA, posición fija de Do central (60–67).
// Melodía suave y cantabile; empieza con los dedos 1–3 y abre al 4 y 5 en la segunda mitad.
const CLARO_DE_LUNA = {
  id: 'claro-de-luna',
  title: 'Claro de luna',
  composer: 'Tradicional',
  subtitle: 'Nivel 1 · Mano derecha · Do mayor',
  emoji: '🌕',
  bpm: 72,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,
  whiteTo: 72,
  level: 1,
  notes: {
    R: [
      // compases 1–2 (8 pulsos)
      'C4:1/1', 'C4:1/1', 'C4:1/1', 'D4:1/2',
      'E4:2/3', 'D4:2/2',
      // compases 3–4 (8 pulsos)
      'C4:1/1', 'E4:1/3', 'D4:1/2', 'D4:1/2',
      'C4:4/1',
      // compases 5–6 (8 pulsos)
      'D4:1/2', 'D4:1/2', 'D4:1/2', 'D4:1/2',
      'E4:2/3', 'G4:2/5',
      // compases 7–8 (8 pulsos) → total 32
      'F4:1/4', 'E4:1/3', 'D4:1/2', 'D4:1/2',
      'C4:4/1',
    ],
  },
};

// ── La abeja viajera / Lightly Row (Popular) · Do mayor · 4/4 · 8 compases ──
// Nivel 1: mano derecha SOLA, posición fija de Do central (60–67).
// Clásico infantil alegre que combina saltos de tercera (5–3 y 4–2) con la escala de 5 dedos.
const ABEJA_VIAJERA = {
  id: 'abeja-viajera',
  title: 'La abeja viajera',
  composer: 'Popular',
  subtitle: 'Nivel 1 · Mano derecha · Do mayor',
  emoji: '🐝',
  bpm: 80,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,
  whiteTo: 72,
  level: 1,
  notes: {
    R: [
      // compases 1–2 (8 pulsos)
      'G4:1/5', 'E4:1/3', 'E4:2/3',
      'F4:1/4', 'D4:1/2', 'D4:2/2',
      // compases 3–4 (8 pulsos)
      'C4:1/1', 'D4:1/2', 'E4:1/3', 'F4:1/4',
      'G4:1/5', 'G4:1/5', 'G4:2/5',
      // compases 5–6 (8 pulsos)
      'G4:1/5', 'E4:1/3', 'E4:2/3',
      'F4:1/4', 'D4:1/2', 'D4:2/2',
      // compases 7–8 (8 pulsos) → total 32
      'C4:1/1', 'E4:1/3', 'G4:1/5', 'G4:1/5',
      'C4:4/1',
    ],
  },
};

// ── Gotitas de lluvia (Original) · Do mayor · 4/4 · 6 compases ──
// Nivel 1: mano derecha SOLA, posición fija de Do central (60–67).
// Juega con silencios de negra (&:1) y pequeños saltos para trabajar el pulso y el meñique.
const GOTITAS_DE_LLUVIA = {
  id: 'gotitas-de-lluvia',
  title: 'Gotitas de lluvia',
  composer: 'Original',
  subtitle: 'Nivel 1 · Mano derecha · Do mayor',
  emoji: '🌧️',
  bpm: 78,
  beatsPerMeasure: 4,
  totalBeats: 24,
  whiteFrom: 48,
  whiteTo: 72,
  level: 1,
  notes: {
    R: [
      // compases 1–2 (8 pulsos)
      'G4:1/5', 'E4:1/3', 'G4:1/5', '&:1',
      'F4:1/4', 'D4:1/2', 'F4:1/4', '&:1',
      // compases 3–4 (8 pulsos)
      'E4:1/3', 'C4:1/1', 'D4:1/2', 'E4:1/3',
      'G4:2/5', 'E4:2/3',
      // compases 5–6 (8 pulsos) → total 24
      'F4:1/4', 'E4:1/3', 'D4:1/2', 'G4:1/5',
      'C4:4/1',
    ],
  },
};

// ── Sube la escalera (Original) · Do mayor · 4/4 · 6 compases ──
// Nivel 1: mano derecha SOLA, posición fija de Do central (60–67).
// Canción-ejercicio por grados conjuntos (1–2–3–4–5 y 5–4–3–2–1) para independizar cada dedo.
const SUBE_LA_ESCALERA = {
  id: 'sube-la-escalera',
  title: 'Sube la escalera',
  composer: 'Original',
  subtitle: 'Nivel 1 · Mano derecha · Do mayor',
  emoji: '🪜',
  bpm: 74,
  beatsPerMeasure: 4,
  totalBeats: 24,
  whiteFrom: 48,
  whiteTo: 72,
  level: 1,
  notes: {
    R: [
      // compases 1–2: sube paso a paso (8 pulsos)
      'C4:1/1', 'D4:1/2', 'E4:1/3', 'F4:1/4',
      'G4:2/5', 'E4:2/3',
      // compases 3–4: baja paso a paso (8 pulsos)
      'G4:1/5', 'F4:1/4', 'E4:1/3', 'D4:1/2',
      'C4:2/1', 'G4:2/5',
      // compases 5–6: cierre en tónica (8 pulsos) → total 24
      'C4:1/1', 'D4:1/2', 'E4:1/3', 'D4:1/2',
      'C4:4/1',
    ],
  },
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
  notes: {
    L: [
      'G3:1/1', 'G3:1/1', 'C3:1/5', 'C3:1/5',
      'D3:1/4', 'D3:1/4', 'E3:1/3', 'E3:1/3',
      'C3:1/5', 'C3:1/5', 'G3:1/1', 'G3:1/1',
      'E3:1/3', 'D3:1/4', 'C3:1/5', 'C3:1/5',
      'G3:1/1', 'G3:1/1', 'E3:1/3', 'D3:1/4',
      'C3:4/5',
    ],
  },
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
  notes: {
    L: [
      'C3:1/5', 'E3:1/3', 'G3:1/1', 'E3:1/3',
      'D3:1/4', 'G3:1/1', 'E3:1/3', 'D3:1/4',
      'C3:1/5', 'E3:1/3', 'G3:1/1', 'E3:1/3',
      'E3:1/3', 'D3:1/4', 'C3:1/5', 'C3:1/5',
      'G3:1/1', 'E3:1/3', 'D3:1/4', 'D3:1/4',
      'E3:1/3', 'D3:1/4', 'C3:1/5', 'D3:1/4',
      'E3:1/3', 'G3:1/1', 'E3:1/3', 'D3:1/4',
      'C3:4/5',
    ],
  },
};

// ── Preguntas y respuestas (original) · Do mayor · 4/4 · 8 compases ──
// Nivel 4: diálogo entre las dos manos. En los compases 1–6 la mano derecha
// lanza tres preguntas distintas y la izquierda le responde en el registro
// grave; en los compases 7–8 se unen las dos manos para cerrar la canción en
// equipo. Ninguna mano se mueve de su posición fija (DO central / DO grave).
const PREGUNTAS_RESPUESTAS = {
  id: 'preguntas-respuestas',
  title: 'Preguntas y respuestas',
  composer: 'Original',
  subtitle: 'Nivel 4 · Do mayor',
  emoji: '💬',
  level: 4,
  bpm: 76,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: {
    R: [
      // compás 1: primera pregunta (arpegio ascendente, queda abierta en SOL)
      'C4:1/1', 'E4:1/3', 'G4:2/5',
      // compás 2: escucha la respuesta de la izquierda
      '&:4',
      // compás 3: segunda pregunta (sube paso a paso)
      'D4:1/2', 'E4:1/3', 'F4:1/4', 'G4:1/5',
      // compás 4: escucha la respuesta
      '&:4',
      // compás 5: tercera pregunta (impulso desde DO hasta SOL)
      'C4:1/1', 'D4:1/2', 'E4:1/3', 'G4:1/5',
      // compás 6: escucha la respuesta
      '&:4',
      // compases 7–8: las dos manos se unen para el final
      'G4:1/5', 'E4:1/3', 'F4:1/4', 'D4:1/2',
      'C4:4/1',
    ],
    L: [
      // compás 1: espera la primera pregunta
      '&:4',
      // compás 2: primera respuesta (arpegio en espejo hacia DO)
      'G3:1/1', 'E3:1/3', 'C3:2/5',
      // compás 3: escucha la segunda pregunta
      '&:4',
      // compás 4: segunda respuesta (reposa en RE, semicadencia)
      'F3:1/2', 'E3:1/3', 'D3:2/4',
      // compás 5: escucha la tercera pregunta
      '&:4',
      // compás 6: tercera respuesta (baja suavemente a MI y prepara el final)
      'G3:1/1', 'F3:1/2', 'E3:2/3',
      // compases 7–8: acompaña a la derecha en el cierre conjunto
      'C3:2/5', 'G3:2/1',
      'C3:4/5',
    ],
  },
};

// ── Vals de las nubes (original) · Do mayor · 3/4 · 8 compases ──
// Nivel 4: primer vals. Mano derecha: melodía suave en 3/4. Mano izquierda:
// acompañamiento de acordes de dos notas sostenidos un compás entero (I–V–I y
// I–IV–V–I), alineados con la armonía de cada compás.
const VALS_DE_LAS_NUBES = {
  id: 'vals-de-las-nubes',
  title: 'Vals de las nubes',
  composer: 'Original',
  subtitle: 'Nivel 4 · Vals · Do mayor',
  emoji: '☁️',
  level: 4,
  bpm: 70,
  beatsPerMeasure: 3,
  totalBeats: 24,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: {
    R: [
      // compases 1–4: primera frase (I – I – V – I)
      'C4:1/1', 'D4:1/2', 'E4:1/3',
      'G4:1/5', 'F4:1/4', 'E4:1/3',
      'D4:1/2', 'E4:1/3', 'D4:1/2',
      'C4:2/1', 'D4:1/2',
      // compases 5–8: segunda frase (I – IV – V – I)
      'E4:1/3', 'F4:1/4', 'G4:1/5',
      'F4:1/4', 'E4:1/3', 'C4:1/1',
      'D4:2/2', 'E4:1/3',
      'C4:3/1',
    ],
    L: [
      ['C3:3/5', 'G3:3/1'],
      ['C3:3/5', 'G3:3/1'],
      ['G3:3/1', 'D3:3/4'],
      ['C3:3/5', 'G3:3/1'],
      ['C3:3/5', 'G3:3/1'],
      ['F3:3/2', 'C3:3/5'],
      ['G3:3/1', 'D3:3/4'],
      ['C3:3/5', 'G3:3/1'],
    ],
  },
};

// ── Cuando los santos marchan (Tradicional) · Do mayor · 4/4 · 8 compases ──
// Nivel 4: clásico de jazz/gospel que cabe entero en las 5 notas fijas (DO–SOL).
// Combina los dos retos del nivel: en los compases 1–2 la derecha lanza la
// llamada ("Oh, when the saints...") y la izquierda le responde en eco grave;
// a partir del compás 3 se unen como una banda, con acordes sencillos en la
// mano izquierda (DO+SOL, RE+SOL, FA+DO) sosteniendo la melodía hasta el final.
const CUANDO_LOS_SANTOS = {
  id: 'cuando-los-santos',
  title: 'Cuando los santos marchan',
  composer: 'Tradicional',
  subtitle: 'Nivel 4 · Do mayor',
  emoji: '🎺',
  level: 4,
  bpm: 84,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: {
    R: [
      // compás 1: llamada de la trompeta (mano derecha)
      'C4:1/1', 'E4:1/3', 'F4:1/4', 'G4:1/5',
      // compás 2: escucha el eco de la mano izquierda
      '&:4',
      // compases 3–4: tercera llamada y semicadencia en RE
      'C4:1/1', 'E4:1/3', 'F4:1/4', 'G4:1/5',
      'E4:1/3', 'C4:1/1', 'E4:1/3', 'D4:1/2',
      // compases 5–6: giro hacia el subdominante (FA)
      'E4:1/3', 'E4:1/3', 'D4:1/2', 'C4:1/1',
      'C4:1/1', 'E4:1/3', 'G4:1/5', 'F4:1/4',
      // compases 7–8: cierre triunfal en equipo
      'E4:1/3', 'F4:1/4', 'G4:1/5', 'E4:1/3',
      'C4:1/1', 'D4:1/2', 'C4:2/1',
    ],
    L: [
      // compás 1: espera la llamada de la derecha
      '&:4',
      // compás 2: responde en eco en el registro grave
      'C3:1/5', 'E3:1/3', 'F3:1/2', 'G3:1/1',
      // compases 3–4: acordes de apoyo (I – V)
      ['C3:4/5', 'G3:4/1'],
      ['G3:4/1', 'D3:4/4'],
      // compases 5–6: acordes de apoyo (I – IV)
      ['C3:4/5', 'G3:4/1'],
      ['F3:4/2', 'C3:4/5'],
      // compases 7–8: cadencia final (I – V – I)
      ['C3:2/5', 'G3:2/1'], 'G3:2/1',
      'G3:2/1', ['C3:2/5', 'G3:2/1'],
    ],
  },
};

// ── El puente de amigos (original) · Do mayor · 4/4 · 8 compases ──
// Nivel 4: diálogo pregunta-respuesta. La mano derecha lanza una frase y la
// izquierda responde; al final se unen para cerrar en equipo. Acordes sencillos
// (fundamental+quinta) en la mano izquierda. Ninguna mano se mueve de su sitio.
const PUENTE_DE_AMIGOS = {
  id: 'puente-de-amigos',
  title: 'El puente de amigos',
  composer: 'Original',
  subtitle: 'Nivel 4 · Do mayor',
  emoji: '🤝',
  level: 4,
  bpm: 72,
  beatsPerMeasure: 4,
  totalBeats: 32,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: {
    R: [
      // compás 1 (4 pulsos)
      'C4:1/1', 'D4:1/2', 'E4:2/3',
      // compás 2 (4 pulsos)
      'G4:2/5', 'F4:1/4', 'E4:1/3',
      // compás 3 (4 pulsos)
      'D4:1/2', 'E4:1/3', 'F4:1/4', 'G4:1/5',
      // compás 4 (4 pulsos)
      'G4:1/5', 'E4:1/3', 'D4:2/2',
      // compás 5 - pregunta R (4 pulsos)
      'C4:1/1', 'E4:1/3', 'G4:2/5',
      // compás 6 - respuesta L, R espera (4 pulsos)
      '&:4',
      // compás 7 - unión (4 pulsos)
      'F4:1/4', 'E4:1/3', 'D4:1/2', 'C4:1/1',
      // compás 8 - final en tónica (4 pulsos) → total 32
      'C4:4/1',
    ],
    L: [
      // compás 1 - acorde tónica (4 pulsos)
      ['C3:4/5', 'G3:4/1'],
      // compás 2 - acorde dominante (4 pulsos)
      ['G3:4/1', 'D3:4/4'],
      // compás 3 - acorde subdominante (4 pulsos)
      ['F3:4/2', 'C3:4/5'],
      // compás 4 - acorde tónica (4 pulsos)
      ['C3:4/5', 'G3:4/1'],
      // compás 5 - R pregunta sola (4 pulsos)
      '&:4',
      // compás 6 - respuesta L (4 pulsos)
      'G3:1/1', 'F3:1/2', 'E3:2/3',
      // compás 7 - dominante preparando final (4 pulsos)
      ['G3:4/1', 'D3:4/4'],
      // compás 8 - tónica final (4 pulsos) → total 32
      ['C3:4/5', 'G3:4/1'],
    ],
  },
};

// ── Farol de la luna (original) · Do mayor · 3/4 · 8 compases ──
// Nivel 4: vals. Mano derecha: melodía suave en 3/4 que sube, baja en espejo y cierra
// en tónica. Mano izquierda: acordes de dos notas sostenidos un compás entero (I–V–I,
// I–IV–V–I), alineados con la armonía de cada compás.
const FAROL_DE_LA_LUNA = {
  id: 'farol-de-la-luna',
  title: 'Farol de la luna',
  composer: 'Original',
  subtitle: 'Nivel 4 · Vals · Do mayor',
  emoji: '🏮',
  level: 4,
  bpm: 74,
  beatsPerMeasure: 3,
  totalBeats: 24,
  whiteFrom: 48,           // DO grave
  whiteTo: 72,             // DO agudo → 15 teclas blancas
  notes: {
    R: [
      'C4:1/1', 'D4:1/2', 'E4:1/3',           // compás 1 - sube (3 pulsos)
      'F4:1/4', 'G4:2/5',                     // compás 2 - llega arriba (3 pulsos)
      'G4:1/5', 'F4:1/4', 'E4:1/3',           // compás 3 - baja espejo (3 pulsos)
      'D4:2/2', 'C4:1/1',                     // compás 4 - reposo tónica (3 pulsos)
      'E4:1/3', 'G4:1/5', 'E4:1/3',           // compás 5 - salto de 5ª, trabaja meñique (3 pulsos)
      'D4:1/2', 'F4:1/4', 'E4:1/3',           // compás 6 - bordadura (3 pulsos)
      'D4:1/2', 'C4:1/1', 'D4:1/2',           // compás 7 - impulso dominante (3 pulsos)
      'C4:3/1',                               // compás 8 - blanca con puntillo final (3 pulsos) → total 24
    ],
    L: [
      ['C3:3/5', 'G3:3/1'],                  // compás 1 - tónica I (3 pulsos)
      ['G3:3/1', 'D3:3/4'],                  // compás 2 - dominante V (3 pulsos)
      ['F3:3/2', 'C3:3/5'],                  // compás 3 - subdominante IV (3 pulsos)
      ['C3:3/5', 'G3:3/1'],                  // compás 4 - tónica I (3 pulsos)
      ['C3:3/5', 'G3:3/1'],                  // compás 5 - tónica I repetida (3 pulsos)
      ['F3:3/2', 'C3:3/5'],                  // compás 6 - subdominante IV (3 pulsos)
      ['G3:3/1', 'D3:3/4'],                  // compás 7 - dominante V tensa (3 pulsos)
      ['C3:3/5', 'G3:3/1'],                  // compás 8 - tónica final (3 pulsos) → total 24
    ],
  },
};

const SONGS = [ODE_TO_JOY, UN_PEQUENO_SUENO, PRIMER_RAYO_DE_SOL, DULCE_NAVIDAD, MARY_CORDERITO, PAN_CALIENTE, CLARO_DE_LUNA, ABEJA_VIAJERA, GOTITAS_DE_LLUVIA, SUBE_LA_ESCALERA, TREN_MADERA, RONDA_SOL, PREGUNTAS_RESPUESTAS, VALS_DE_LAS_NUBES, CUANDO_LOS_SANTOS, PUENTE_DE_AMIGOS, FAROL_DE_LA_LUNA]
  .map((s) => ({ ...s, notes: compileNotes(s.notes) }));

// ── Validación del catálogo (modo dev) ──
// Comprueba las reglas de integridad de todas las canciones: ids únicos, nivel existente,
// pulsos dentro de totalBeats, dedos 1–5, notas dentro de whiteFrom..whiteTo y coherencia
// de manos con el nivel. Devuelve un array de problemas (vacío = todo correcto).
function validateSongs(songs = SONGS) {
  const problems = [];
  const seen = new Set();
  for (const s of songs) {
    const tag = s.id || s.title || '(sin id)';
    if (!s.id || seen.has(s.id)) problems.push(`${tag}: id vacío o repetido`);
    seen.add(s.id);
    if (!LEVELS.some((l) => l.id === s.level)) problems.push(`${tag}: level ${s.level} no existe en LEVELS`);
    if (!(s.bpm > 0)) problems.push(`${tag}: bpm debe ser > 0`);
    if (!(s.beatsPerMeasure > 0)) problems.push(`${tag}: beatsPerMeasure debe ser > 0`);
    if (!(s.totalBeats > 0)) problems.push(`${tag}: totalBeats debe ser > 0`);
    if (!(s.whiteFrom < s.whiteTo)) problems.push(`${tag}: whiteFrom debe ser < whiteTo`);
    if (!Array.isArray(s.notes) || s.notes.length === 0) { problems.push(`${tag}: sin notas`); continue; }
    const hands = new Set();
    let end = 0;
    for (const n of s.notes) {
      if (!Number.isInteger(n.m) || n.m < s.whiteFrom || n.m > s.whiteTo) {
        problems.push(`${tag}: nota MIDI ${n.m} fuera de [${s.whiteFrom}, ${s.whiteTo}]`);
      }
      if (!Number.isFinite(n.b) || n.b < 0) problems.push(`${tag}: pulso b inválido (${n.b})`);
      if (!Number.isFinite(n.d) || n.d <= 0) problems.push(`${tag}: duración d inválida (${n.d})`);
      if (Number.isFinite(n.b) && Number.isFinite(n.d) && n.b + n.d > s.totalBeats + 1e-9) {
        problems.push(`${tag}: nota en pulso ${n.b} con duración ${n.d} se pasa del final (${s.totalBeats})`);
      }
      if (!Number.isInteger(n.f) || n.f < 1 || n.f > 5) problems.push(`${tag}: dedo f=${n.f} (debe ser 1–5)`);
      if (n.h !== R && n.h !== L) problems.push(`${tag}: mano h=${n.h} (debe ser R o L)`);
      hands.add(n.h);
      end = Math.max(end, n.b + n.d);
    }
    if (Math.abs(end - s.totalBeats) > 1e-6) {
      problems.push(`AVISO: ${tag}: la última nota termina en el pulso ${end}, pero totalBeats=${s.totalBeats}`);
    }
    const hasR = hands.has(R), hasL = hands.has(L);
    if (s.level === 1 && !(hasR && !hasL)) problems.push(`${tag}: el nivel 1 debe ser sólo mano derecha (R)`);
    if (s.level === 2 && !(hasL && !hasR)) problems.push(`${tag}: el nivel 2 debe ser sólo mano izquierda (L)`);
    if (s.level === 3 && !(hasR && hasL)) problems.push(`${tag}: el nivel 3 debe tener las dos manos (R y L)`);
    if (s.level === 4 && !(hasR && hasL)) problems.push(`${tag}: el nivel 4 debe tener las dos manos (R y L)`);
  }
  return problems;
}

export { SONGS, LEVELS, R, L, midiToName, midiFromName, compileNotes, validateSongs };
