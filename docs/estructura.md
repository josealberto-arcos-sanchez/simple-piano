# Estructura del proyecto

```
index.html          Pantallas (inicio, juego, overlays)
css/style.css       Estilos
js/songs.js         Datos de las canciones (añadir una canción = añadir un objeto a SONGS)
js/audio.js         Sonido (síntesis Web Audio: modo Escuchar + eco del teclado)
js/midi.js          Lectura del teclado real (Web MIDI)
js/keyboard-dev.js  Modo prueba con las teclas del ordenador
js/users.js         Perfiles de usuario (localStorage, color, exportar/importar)
js/game.js          Motor: notas que caen, modo espera, fase libre, velocidad, feedback
js/progression.js   Reglas de dominio: modos disponibles, estrellas y puntuación
js/ui-home.js       Vistas de inicio: niveles, canciones, detalle y chips
js/ui-users.js      Overlay de jugadores: lista, formulario y exportar/importar
js/ui-connect.js    Overlay de conexión del teclado y modo prueba
js/app.js           Navegación, progreso por jugador, conexión, celebración
manifest.json       PWA instalable
sw.js               Cache offline
scripts/serve.ps1      Mini servidor local en PowerShell (sin Python ni Node)
scripts/gen-icons.ps1  Regenera los iconos PNG
```
