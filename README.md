# 🎹 Simple Piano

App web para que una niña de 8 años aprenda a tocar el piano **con su teclado real**,
estilo SimplyPiano: notas que caen en la pantalla del tablet, la app escucha el
teclado por USB (Web MIDI) y espera a que acierte cada nota. Cero castigos.

Prototipo v0.1 · una canción: **Himno de la Alegría** (Beethoven, Do mayor).

## Cómo funciona

1. Conecta el teclado de casa al tablet/móvil con el cable USB (en el teclado,
   si hay menú USB, elige **MIDI**).
2. Abre la app con **Chrome** (es el navegador que lee teclados MIDI en Android).
3. Progresión: **Escuchar → Mano derecha → Mano izquierda → ¡Las dos manos! → 🎵 ¡Toca libre!**
   - Las teclas objetivo se iluminan con el número de dedo (👉 verde derecha, 👈 morado izquierda).
   - **Modo espera**: las notas frenan en la línea dorada y no avanzan hasta acertar. Sin reloj.
   - **¡Toca libre!** (fase 5): la canción avanza sin parar. Si tocas la nota mientras su
     rectángulo cruza la línea dorada → destello dorado y partículas; si la tocas fuera →
     parpadeo rojo suave (una "ayudita").
   - **Velocidad** 🐢 lenta (×0,7) · 😊 normal · 🐇 rápida (×1,4): se elige en la pantalla
     de inicio o con el botón redondo del juego, y afecta a todas las fases.
   - Error = la tecla parpadea en rojo suave. Nada se pierde nunca.
   - Al terminar: estrellas (0 errores = 3⭐) y confeti.

## Probar en el ordenador (sin teclado)

```powershell
cd C:\jose_alberto\proyectos\simple-piano
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
```

Abre <http://127.0.0.1:8080>. En la pantalla de conexión, pulsa
*"No tengo el cable ahora → probar con las teclas del ordenador"*:
`z x c v b` = DO RE MI FA SOL (mano izquierda) · `q w e r t` = DO RE MI FA SOL (mano derecha).

> Se necesita un servidor (no abrir el `index.html` directamente) porque Web MIDI
> y el service worker sólo funcionan en `http(s)`.
> (Si tienes Python, también vale `python -m http.server 8080`.)

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (p. ej. `simple-piano`) — **público** (Pages gratis no funciona en privados en cuentas gratuitas).
2. Sube el proyecto:
   ```powershell
   cd C:\jose_alberto\proyectos\simple-piano
   git init
   git add -A
   git commit -m "Simple Piano v0.1"
   git remote add origin https://github.com/TU_USUARIO/simple-piano.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Branch: main → Save**.
4. En un minuto la app está en `https://TU_USUARIO.github.io/simple-piano/`

### Instalarla como app en Android

1. Abre la URL con Chrome.
2. Menú ⋮ → **"Instalar aplicación"** (o "Añadir a pantalla de inicio").
3. Ya aparece con su icono y funciona **sin internet** (service worker).

### Cable del teclado

- Teclados con **USB tipo B** (el conector cuadrado): cable USB-B → USB-A, y en
  tablet hace falta un adaptador **USB-OTG** (o hub USB-C).
- Teclados antiguos con sólo los conectores redondos **MIDI DIN**: adaptador
  USB-MIDI barato (~10 €).
- Teclados con **Bluetooth MIDI**: puede funcionar sin cable según el modelo.

## Crear una Pull Request (sin GitHub CLI)

Si no tienes `gh` instalado, la PR se puede crear con la API de GitHub. Hace falta
un token: se toma de la variable `GH_TOKEN` o de las credenciales que Git ya tiene
guardadas para github.com (las que se usan al hacer `git push`). No copies el token
en ningún archivo.

```powershell
cd C:\jose_alberto\proyectos\simple-piano
$rama = git branch --show-current
$cred = "protocol=https`nhost=github.com`n`n" | git credential fill
$token = if ($env:GH_TOKEN) { $env:GH_TOKEN } else { ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=','' }
$headers = @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json"; "X-GitHub-Api-Version" = "2022-11-28" }
$payload = [ordered]@{
  title = "TÍTULO DE LA PR"
  head  = $rama
  base  = "main"
  body  = "DESCRIPCIÓN DE LA PR"
}
# Enviar el cuerpo en UTF-8 para que los acentos y símbolos lleguen bien
$bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))
$pr = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/TU_USUARIO/simple-piano/pulls" -Headers $headers -Body $bytes -ContentType "application/json; charset=utf-8"
$pr.html_url
```

Antes, la rama debe estar subida (`git push -u origin <rama>`). Sustituye `TU_USUARIO`,
el título y la descripción. Si GitHub devuelve `400 Problems parsing JSON`, casi
siempre es por la codificación: usa el envío en bytes UTF-8 como arriba.

## Estructura

```
index.html          Pantallas (inicio, juego, overlays)
css/style.css       Estilos
js/songs.js         Datos de las canciones (añadir una canción = añadir un objeto a SONGS)
js/audio.js         Sonido (síntesis Web Audio: modo Escuchar + eco del teclado)
js/midi.js          Lectura del teclado real (Web MIDI)
js/keyboard-dev.js  Modo prueba con las teclas del ordenador
js/game.js          Motor: notas que caen, modo espera, fase libre, velocidad, feedback
js/app.js           Navegación, progreso (localStorage), conexión, celebración
manifest.json       PWA instalable
sw.js               Cache offline
scripts/gen-icons.ps1  Regenera los iconos PNG
```

## Cómo añadir una canción nueva

Para añadir una canción sólo hay que editar **`js/songs.js`** (no hace falta tocar HTML, CSS ni el resto del código: el selector de canciones y el guardado de estrellas aparecen automáticamente cuando hay 2 o más canciones en `SONGS`).

### 1. Crear el objeto de la canción en `js/songs.js`

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

### 2. Formato de cada nota (`notes`)

Cada elemento de `notes` es un objeto `{ m, b, d, h, f }`:

| Campo | Significado | Valores / Ejemplos |
|---|---|---|
| **`m`** | Nota MIDI | `60` = DO central (C4). `48` = DO grave (C3). Ver tabla abajo. |
| **`b`** | Pulso de inicio (*beat*) | Empieza en `0` (primer pulso del compás 1). Admite decimales para corcheas (`0.5`, `1.5`…). |
| **`d`** | Duración en pulsos | `1` = negra, `2` = blanca, `4` = redonda, `0.5` = corchea. |
| **`h`** | Mano | `R` (mano derecha, verde) o `L` (mano izquierda, morada). |
| **`f`** | Dedo | `1` = pulgar, `2` = índice, `3` = corazón, `4` = anular, `5` = meñique. |

> **Acordes / dos manos a la vez:** Si dos notas tienen el mismo pulso `b` (por ejemplo, una de mano derecha y otra de mano izquierda en `b: 0`), el motor las agrupa automáticamente: en los modos de una sola mano filtra las que correspondan, y en *¡Las dos manos!* espera a que la niña pulse ambas teclas.

### 3. Referencia rápida de notas MIDI y digitación

**Posición fija en Do mayor (sin mover las manos):**

* **Mano izquierda (`h: L`)** — Octava 3 (grave):
  * `48` = DO (dedo `5`) · `50` = RE (`4`) · `52` = MI (`3`) · `53` = FA (`2`) · `55` = SOL (`1`)
  * Resto de la octava: `57` = LA · `59` = SI (`49`, `51`, `54`, `56`, `58` son teclas negras).
* **Mano derecha (`h: R`)** — Octava 4 (central):
  * `60` = DO (dedo `1`) · `62` = RE (`2`) · `64` = MI (`3`) · `65` = FA (`4`) · `67` = SOL (`5`)
  * Resto de la octava: `69` = LA · `71` = SI · `72` = DO agudo (`61`, `63`, `66`, `68`, `70` son teclas negras).

### 4. Actualizar la caché offline (si está instalada como PWA)

Si ya tienes la app instalada en el tablet, sube el número de versión de `CACHE` en `sw.js` (por ejemplo, de `'simple-piano-v0.2.1'` a `'simple-piano-v0.2.2'`) para forzar que el navegador descargue el nuevo `js/songs.js`.

## Hoja de ruta

- **v0.1 (esto)**: 1 canción, 5 fases (la última: ¡Toca libre!), velocidad 🐢😊🐇, MIDI por USB, instalable, offline.
- **v0.2**: 2-3 canciones más (Estrellita, Cumpleaños feliz).
- **v0.3**: tocar con acompañamiento (la app toca la otra mano), estadísticas para padres.
- **v1.0**: mini-método de 10-12 canciones por niveles.

## Notas técnicas

- **Web MIDI** funciona en Chrome/Edge de escritorio y **Android**. Firefox no lo soporta.
- El sonido del modo Escuchar es **síntesis** (armónicos + envolvente). Si el
  teclado de casa no tiene altavoces, activa el **eco en la app** para oír lo que toca.
- La pantalla se mantiene encendida durante el juego (Wake Lock API).
