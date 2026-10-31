# Estructura del proyecto

```
index.html          Pantallas (inicio, juego, overlays)
css/style.css       Estilos
js/songs.js         Datos de las canciones (notación compacta por pistas R/L + compilador y validación validateSongs)
js/audio.js         Sonido (síntesis Web Audio: modo Escuchar + eco del teclado)
js/midi.js          Lectura del teclado real (Web MIDI)
js/keyboard-dev.js  Modo prueba con las teclas del ordenador
js/users.js         Perfiles de usuario (localStorage, color, exportar/importar, escrituras encapsuladas con validación)
js/game.js          Motor: notas que caen, modo espera, fase libre, velocidad, feedback
js/progression.js   Reglas de dominio: modos disponibles, estrellas y puntuación
js/ui-home.js       Vistas de inicio: niveles, canciones, detalle y chips
js/ui-users.js      Overlay de jugadores: lista, formulario y exportar/importar
js/ui-connect.js    Overlay de conexión del teclado y modo prueba
js/app.js           Navegación, progreso por jugador, conexión, celebración
js/version.js       Versión única de la app (APP_VERSION): fuente de verdad para la UI y para check-sw.ps1
manifest.json       PWA instalable
sw.js               Cache offline
scripts/serve.ps1      Mini servidor local en PowerShell (sin Python ni Node)
scripts/gen-icons.ps1  Regenera los iconos PNG
scripts/check-sw.ps1  Verifica que sw.js cachea todo lo referenciado (index.html, imports, iconos) y usa la versión actual
```
