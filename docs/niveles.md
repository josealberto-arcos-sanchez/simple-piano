# Niveles del método (criterios)

Este documento define **qué significa cada nivel** y **qué reglas deben cumplir sus
canciones**. Es la referencia para saber qué tipo de canción añadir a cada nivel
y para entender la progresión pedagógica de la app.

Todos los niveles están **siempre abiertos** para todos los jugadores: el nivel de
una canción no bloquea a las demás. La dificultad (no ** el contenido de cada
canción, no por candados. La validación automática (`validateSongs` en
`js/songs.js`) comprueba las reglas de cada nivel y avisa en consola si una
canción no las cumple.

---

## Resumen de la progresión

| Nivel | Emoji | Nombre | Posición de las manos | Qué introduce |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 👉 | Mano derecha | Sólo derecha, fija | Tocar con la mano derecha (dedos 1–5) |
| 2 | 👈 | Mano izquierda | Sólo izquierda, fija | Tocar con la mano izquierda (dedos 5–1) |
| 3 | ✨ | Las dos manos | Ambas manos, fijas | Coordinar las dos manos a la vez |
| 4 | 🤝 | Manos en equipo | Ambas manos, fijas | Manos como equipo: diálogo, acordes sencillos y ritmos nuevos |

> **Regla común a todos los niveles:** las manos **no se mueven de su sitio**
> (posición fija de 5 dedos). El movimiento del teclado es un paso posterior y
> se introduce más adelante.

---

## Nivel 1 · 👉 Mano derecha

- **Descripción en la app:** «Sólo con la mano derecha, sin moverla de su sitio.»
- **Mano que participa:** sólo la derecha (`h: R`).
- **Regla de posición (validación):** la canción **no puede** tener notas de la
  mano izquierda (`h: L`).
- **Dónde toca:** posición fija de DO central, octava 4: DO4–SOL4
  (MIDI 60–67), dedos 1–5 (pulgar = DO, meñique = SOL).
- **Objetivo pedagógico:** primera toma de contacto con el teclado real: pulsar
  la tecla correcta con el dedo correcto, sin miedo a equivocarse.
- **Modos que ofrece la app:** Escuchar · Mano derecha · ¡Toca libre! (la mano
  izquierda se oculta porque no participa).
- **Ejemplos de canciones:** *Mary tenía un corderito*, *Pan caliente*.

---

## Nivel 2 · 👈 Mano izquierda

- **Descripción en la app:** «Sólo con la mano izquierda, sin moverla de su sitio.»
- **Mano que participa:** sólo la izquierda (`h: L`).
- **Regla de posición (validación):** la canción **no puede** tener notas de la
  mano derecha (`h: R`).
- **Dónde toca:** posición fija de DO grave, octava 3: DO3–SOL3
  (MIDI 48–55), dedos 5–1 (meñique = DO, pulgar = SOL).
- **Objetivo pedagógico:** repetir con la otra mano el mismo logro del nivel 1,
  reforzando la simetría y la lectura de la clave de Fa (mano izquierda).
- **Modos que ofrece la app:** Escuchar · Mano izquierda · ¡Toca libre! (la mano
  derecha se oculta).
- **Ejemplos de canciones:** *El tren de madera*, *La ronda del sol*.

---

## Nivel 3 · ✨ Las dos manos

- **Descripción en la app:** «Canciones sencillas con las dos manos, sin moverlas
  de su sitio.»
- **Manos que participan:** las dos (`h: R` **y** `h: L`).
- **Regla de posición (validación):** la canción **debe** tener notas de ambas
  manos.
- **Dónde tocan:** las dos en posición fija: derecha en DO4–SOL4 (60–67),
  izquierda en DO3–SOL3 (48–55).
- **Estilo de las canciones:** melodía en la mano derecha + acompañamiento
  **sencillo** en la mano izquierda (normalmente una nota larga por compás:
  DO3, MI3, FA3, SOL3). Ambas manos tocan **a la vez** en los mismos pulsos.
- **Objetivo pedagógico:** coordinar las dos manos simultáneamente: cada mano
  tiene su papel y el jugador debe pulsar ambas cuando toca.
- **Modos que ofrece la app:** los cinco: Escuchar · Mano derecha · Mano
  izquierda · ¡Las dos manos! · ¡Toca libre!
- **Ejemplos de canciones:** *Himno de la Alegría*, *Un pequeño sueño*,
  *El primer rayo de sol*, *Dulce Navidad*.

---

## Nivel 4 · 🤝 Manos en equipo

- **Descripción en la app:** «Las dos manos se ayudan: una llama y la otra
  responde, o tocan acordes sencillos juntas, sin moverse de sitio.»
- **Manos que participan:** las dos (`h: R` **y** `h: L`).
- **Regla de posición (validación):** la canción **debe** tener notas de ambas
  manos (igual que el nivel 3).
- **Dónde tocan:** siguen en posición fija: derecha en DO4–SOL4 (60–67),
  izquierda en DO3–SOL3 (48–55). **Todavía no se mueven del sitio.**
- **Qué introduce (respecto al nivel 3):**
  - **Diálogo entre las manos** (pregunta-respuesta): una mano toca una frase y
    la otra le responde, en lugar de tocar siempre a la vez.
  - **Acordes sencillos en la mano izquierda:** dos notas a la vez (fundamental +
    quinta, p. ej. DO3+SOL3) sostenidas un compás entero.
  - **Ritmos nuevos:** primer contacto con el compás de 3/4 (vals) — la melodía
    sigue en negras, sin corcheas todavía.
- **Objetivo pedagógico:** que las manos trabajen **como un equipo**: se turnan,
  se complementan y tocan juntas de formas nuevas, sin la dificultad añadida de
  mover las manos por el teclado.
- **Modos que ofrece la app:** los cinco (igual que el nivel 3): Escuchar ·
  Mano derecha · Mano izquierda · ¡Las dos manos! · ¡Toca libre!
- **Ejemplos de canciones:** *Preguntas y respuestas* (diálogo), *Vals de las
  nubes* (3/4 con acordes en la izquierda).

---

## Cómo se validan los niveles en el código

`validateSongs()` en `js/songs.js` comprueba, además de las reglas generales
(pulsos dentro de `totalBeats`, dedos 1–5, notas dentro de `whiteFrom..whiteTo`,
ids únicos, nivel existente), la coherencia de manos con el nivel:

| Nivel | Regla de manos que comprueba |
| :--- | :--- |
| 1 | Sólo mano derecha (`R`) |
| 2 | Sólo mano izquierda (`L`) |
| 3 | Las dos manos (`R` y `L`) |
| 4 | Las dos manos (`R` y `L`) |

Para añadir un nivel nuevo en el futuro: añade un objeto a `LEVELS` y, si tiene
una regla de manos propia, una comprobación nueva en `validateSongs()`. Un nivel
sin canciones se muestra como «Próximamente» y sus estrellas (0) se calculan solas.
