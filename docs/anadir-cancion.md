# Cómo añadir una canción nueva

Para añadir una canción sólo hay que editar **`js/songs.js`** (no hace falta tocar HTML, CSS ni el resto del código: el selector de canciones y el guardado de estrellas aparecen automáticamente cuando hay 2 o más canciones en `SONGS`).

## 1. Crear el objeto de la canción en `js/songs.js`

Define una constante con esta estructura y añádela al array `SONGS` al final del archivo:

```javascript
const TWINKLE = {
  id: 'estrellita',                     // identificador único (sin espacios, se usa en localStorage)
  title: 'Estrellita dónde estás',      // nombre visible
  composer: 'Popular',                  // autor o 'Popular' / 'Tradicional'
  subtitle: 'Nivel ⭐ · Do mayor',       // texto secundario bajo el título (opcional)
  emoji: '⭐',                           // icono de la canción
  bpm: 80,                              // velocidad base (pulsos por minuto a velocidad normal)
  beatsPerMeasure: 4,                   // pulsos por compás (4 para 4/4, 3 para 3/4)
  totalBeats: 32,                       // pulsos totales de la canción (compases × beatsPerMeasure)
  whiteFrom: 48,                        // primera tecla blanca visible del teclado guía (48 = DO3)
  whiteTo: 72,                          // última tecla blanca visible (72 = DO5)
  notes: [
    // Mano derecha (R) y mano izquierda (L)
    { m: 60, b: 0, d: 1, h: R, f: 1 },
    { m: 60, b: 1, d: 1, h: R, f: 1 },
    // ...
  ],
};

const SONGS = [ODE_TO_JOY, TWINKLE];
```

## 2. Formato de cada nota (`notes`)

Cada elemento de `notes` es un objeto `{ m, b, d, h, f }`:

| Campo | Significado | Valores / Ejemplos |
|---|---|---|
| **`m`** | Nota MIDI | `60` = DO central (C4). `48` = DO grave (C3). Ver tabla abajo. |
| **`b`** | Pulso de inicio (*beat*) | Empieza en `0` (primer pulso del compás 1). Admite decimales para corcheas (`0.5`, `1.5`…). |
| **`d`** | Duración en pulsos | `1` = negra, `2` = blanca, `4` = redonda, `0.5` = corchea. |
| **`h`** | Mano | `R` (mano derecha, verde) o `L` (mano izquierda, morada). |
| **`f`** | Dedo | `1` = pulgar, `2` = índice, `3` = corazón, `4` = anular, `5` = meñique. |

> **Acordes / dos manos a la vez:** Si dos notas tienen el mismo pulso `b` (por ejemplo, una de mano derecha y otra de mano izquierda en `b: 0`), el motor las agrupa automáticamente: en los modos de una sola mano filtra las que correspondan, y en *¡Las dos manos!* espera a que la niña pulse ambas teclas.

## 3. Referencia rápida de notas MIDI y digitación

**Posición fija en Do mayor (sin mover las manos):**

* **Mano izquierda (`h: L`)** — Octava 3 (grave):
  * `48` = DO (dedo `5`) · `50` = RE (`4`) · `52` = MI (`3`) · `53` = FA (`2`) · `55` = SOL (`1`)
  * Resto de la octava: `57` = LA · `59` = SI (`49`, `51`, `54`, `56`, `58` son teclas negras).
* **Mano derecha (`h: R`)** — Octava 4 (central):
  * `60` = DO (dedo `1`) · `62` = RE (`2`) · `64` = MI (`3`) · `65` = FA (`4`) · `67` = SOL (`5`)
  * Resto de la octava: `69` = LA · `71` = SI · `72` = DO agudo (`61`, `63`, `66`, `68`, `70` son teclas negras).

## 4. Actualizar la caché offline (si está instalada como PWA)

Si ya tienes la app instalada en el tablet, sube el número de versión de `CACHE` en `sw.js` (por ejemplo, de `'simple-piano-v0.2.2'` a `'simple-piano-v0.2.3'`) para forzar que el navegador descargue el nuevo `js/songs.js`. Si aun así no se actualiza, en ⚙️ Ajustes → 🔄 Buscar actualización borra la caché y recarga la app.
