# Cómo añadir una canción nueva

Para añadir una canción sólo hay que editar **`js/songs.js`** (no hace falta tocar HTML, CSS ni el resto del código: la canción aparece automáticamente en el listado de su nivel con sus estrellas, y el guardado de estrellas funciona solo).

## 0. Cada canción pertenece a un nivel

Las canciones se agrupan por niveles (ver `LEVELS` en `js/songs.js`). Cada canción lleva un campo **`level`** con el `id` del nivel al que pertenece. Todos los niveles están **siempre abiertos** para todos los jugadores: no hay que terminar un nivel para jugar otro.

Los niveles actuales son:

| id | Nivel | Regla de sus canciones |
|---|---|---|
| 1 | Nivel 1 👉 | Sólo mano derecha (`h: R`), sin mover la mano de su posición inicial (DO4–SOL4, dedos 1–5). |
| 2 | Nivel 2 👈 | Sólo mano izquierda (`h: L`), sin mover la mano de su posición inicial (DO3–SOL3, dedos 5–1). |
| 3 | Nivel 3 ✨ | Canciones sencillas con las dos manos, sin mover las manos de su posición inicial. |
| 4 | Nivel 4 🤝 | Las dos manos en equipo, sin moverlas de su posición: diálogo pregunta-respuesta, acordes sencillos (fundamental+quinta) en la izquierda y ritmos nuevos (vals 3/4). Ver [Niveles del método](niveles.md). |

> **Añadir un nivel nuevo en el futuro**: basta con añadir un objeto al array `LEVELS` (id, título, emoji, nombre y descripción). Los niveles sin canciones se muestran como "Próximamente". Las estrellas máximas de cada nivel se calculan solas a partir de sus canciones.

## 1. Crear el objeto de la canción en `js/songs.js` (notación compacta)

Define una constante con esta estructura y añádela al array `SONGS` al final del archivo:

```javascript
const TWINKLE = {
  id: 'estrellita',                     // identificador único (sin espacios, se usa en localStorage)
  title: 'Estrellita dónde estás',      // nombre visible
  composer: 'Popular',                  // autor o 'Popular' / 'Tradicional'
  subtitle: 'Nivel 3 · Do mayor',       // texto secundario bajo el título (opcional)
  emoji: '⭐',                           // icono de la canción
  bpm: 80,                              // velocidad base (pulsos por minuto a velocidad normal)
  beatsPerMeasure: 4,                   // pulsos por compás (4 para 4/4, 3 para 3/4)
  totalBeats: 32,                       // pulsos totales de la canción (compases × beatsPerMeasure)
  whiteFrom: 48,                        // primera tecla blanca visible del teclado guía (48 = DO3)
  whiteTo: 72,                          // última tecla blanca visible (72 = DO5)
  level: 3,                             // id del nivel en LEVELS (1, 2, 3…)
  notes: {
    R: [ /* mano derecha: tokens en orden, una línea por compás */ ],
    L: [ /* mano izquierda (sólo si el nivel 3 la usa) */ ],
  },
};

const SONGS = [ODE_TO_JOY, TWINKLE];
```

> **No hay que calcular el pulso `b` a mano**: el compilador lo calcula solo, sumando las duraciones de cada token dentro de cada pista. El motor descubre solo qué modos de juego ofrece cada canción según las manos que aparecen: sólo `R` → Escuchar · Mano derecha · ¡Toca libre!; sólo `L` → Escuchar · Mano izquierda · ¡Toca libre!; `R` y `L` → los cinco modos.

## 2. Formato de los tokens de `notes`

Cada pista (`R` o `L`) es un array de tokens. El cursor de pulso avanza sumando la duración de cada nota:

| Token | Significado | Ejemplos |
|---|---|---|
| **`NOTA:duración/dedo`** | Nota con duración y dedo | `'E4:1/3'` = MI4, negra (1 pulso), dedo 3. `'C4:2/1'` = DO4, blanca, dedo 1. `'G3:0.5/1'` = SOL3, corchea, dedo 1. |
| **`NOTA`** | Nota sin duración ni dedo | `'E4'` = `'E4:1'` (negra, sin dedo: la validación avisará). |
| **Acorde** | Array de notas que suenan **a la vez**; el cursor avanza con la duración más larga | `['C4:4/1', 'E4:4/3', 'G4:4/5']` = acorde de DO mayor sostenido 4 pulsos. |
| **`&:duración`** | Silencio (avanza sin nota) | `'&:1'` = silencio de una negra. `'&:0.5'` = silencio de corchea. |
| **`@pulso`** | Salto absoluto: coloca el cursor en un pulso concreto | `'@16'` = sigue escribiendo a partir del pulso 16 (útil tras un silencio largo o para empezar en otro compás). |

> **Dos manos a la vez:** Si quieres que las dos manos suenen en el mismo pulso, repite el mismo esquema en `R` y en `L` (p. ej. `R: ['C4:4/1']` y `L: ['C3:4/5']`). El motor las agrupa automáticamente por pulso: en los modos de una sola mano filtra la que corresponda, y en *¡Las dos manos!* espera a que la niña pulse ambas teclas.

## 3. El formato clásico (opcional)

Sigue siendo válido definir `notes` como array de objetos `{ m, b, d, h, f }`:

| Campo | Significado | Valores / Ejemplos |
|---|---|---|
| **`m`** | Nota MIDI | `60` = DO central (C4). `48` = DO grave (C3). Ver tabla abajo. |
| **`b`** | Pulso de inicio (*beat*) | Empieza en `0` (primer pulso del compás 1). Admite decimales para corcheas (`0.5`, `1.5`…). |
| **`d`** | Duración en pulsos | `1` = negra, `2` = blanca, `4` = redonda, `0.5` = corchea. |
| **`h`** | Mano | `R` (mano derecha, verde) o `L` (mano izquierda, morada). |
| **`f`** | Dedo | `1` = pulgar, `2` = índice, `3` = corazón, `4` = anular, `5` = meñique. |

## 4. Referencia rápida de notas MIDI y digitación

**Posición fija en Do mayor (sin mover las manos):**

* **Mano izquierda (`h: L`)** — Octava 3 (grave):
  * `48` = DO (dedo `5`) · `50` = RE (`4`) · `52` = MI (`3`) · `53` = FA (`2`) · `55` = SOL (`1`)
  * Resto de la octava: `57` = LA · `59` = SI (`49`, `51`, `54`, `56`, `58` son teclas negras).
* **Mano derecha (`h: R`)** — Octava 4 (central):
  * `60` = DO (dedo `1`) · `62` = RE (`2`) · `64` = MI (`3`) · `65` = FA (`4`) · `67` = SOL (`5`)
  * Resto de la octava: `69` = LA · `71` = SI · `72` = DO agudo (`61`, `63`, `66`, `68`, `70` son teclas negras).

En la notación compacta se escriben los nombres de nota (`C3`, `E4`, `G4`…) en vez de números MIDI; la tabla anterior te dice qué nombre corresponde a cada nota de cada posición.

## 5. Validación automática (modo desarrollo)

Al arrancar la app en localhost (o con `?dev=1`), `validateSongs()` comprueba todas las canciones y **muestra en la consola del navegador** cualquier problema: ids repetidos, nivel inexistente, notas fuera de `whiteFrom..whiteTo`, dedos fuera de 1–5, pulsos que se pasan de `totalBeats`, manos incoherentes con el nivel, o una canción que no termina exactamente en `totalBeats`. Ejecuta `scripts/serve.ps1`, abre `http://127.0.0.1:8080/?dev=1` y mira la consola (F12) para verificar tu canción nueva.

## 6. Actualizar la caché offline (si está instalada como PWA)

Si ya tienes la app instalada en el tablet, sube el número de versión: cambia `APP_VERSION` en `js/version.js` (fuente única) y `CACHE` en `sw.js` (p. ej. de `'simple-piano-v0.9.0'` a `'simple-piano-v0.9.1'`) para forzar que el navegador descargue el nuevo `js/songs.js`. Después ejecuta `scripts/check-sw.ps1` para verificar que el cache incluye todos los ficheros referenciados y la versión correcta. Si aun así no se actualiza, en ⚙️ Ajustes → 🔄 Buscar actualización borra la caché y recarga la app.
