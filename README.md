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

## Estructura

```
index.html          Pantallas (inicio, juego, overlays)
css/style.css       Estilos
js/songs.js         Datos de las canciones (añadir una canción = añadir un array)
js/audio.js         Sonido (síntesis Web Audio: modo Escuchar + eco del teclado)
js/midi.js          Lectura del teclado real (Web MIDI)
js/keyboard-dev.js  Modo prueba con las teclas del ordenador
js/game.js          Motor: notas que caen, modo espera, fase libre, velocidad, feedback
js/app.js           Navegación, progreso (localStorage), conexión, celebración
manifest.json       PWA instalable
sw.js               Cache offline
scripts/gen-icons.ps1  Regenera los iconos PNG
```

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
