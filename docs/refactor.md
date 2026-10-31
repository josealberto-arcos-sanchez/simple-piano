He revisado la arquitectura, el código fuente y la documentación del proyecto. El código actual es limpio, directo y muy adecuado para un prototipo sin dependencias, pero a medida que crezca en número de canciones, niveles y funcionalidades, varios patrones actuales empezarán a penalizar el mantenimiento y la escalabilidad.

Aquí tienes los puntos de mejora ordenados de **más grave/importante a menos importante**:

---

### 🔴 Críticos / Alta prioridad (Impactan directamente en escalabilidad y estabilidad)

#### 1. ✅ Realizado — `js/app.js` "God Object" (Monolito de UI, estado y dominio)
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * Creado **`js/progression.js`** con las reglas de dominio de canciones/niveles: `availableModes`, `nextMode`, `nextLabel`, `levelById`, `songsOfLevel`, `maxStarsOfSong`, `userStarsOfSong`, `maxStarsOfLevel`, `userStarsOfLevel`, `starTotal` y `scoreResult` (reglas de puntuación de 1 a 3 estrellas).
  * Separada la gestión de vistas en **controladores ligeros**: `js/ui-home.js` (menú de niveles, canciones, detalle y chips), `js/ui-users.js` (overlay de jugadores: lista, formulario, exportar/importar) y `js/ui-connect.js` (overlay de conexión y modo prueba).
  * `js/app.js` pasó de ~995 a ~475 líneas: conserva el ciclo de vida, `route`, la partida, WakeLock, Service Worker, ajustes y la navegación; comunica estado y acciones a los controladores vía un objeto `ctx` (sin dependencias circulares entre ficheros).

#### 2. ✅ Realizado — Ausencia de Módulos ES (`import` / `export`) y contaminación del ámbito global
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * `index.html` ahora carga un único `<script type="module" src="js/app.js">`; los otros 10 ficheros JS son módulos ES que declaran explícitamente sus `import`/`export`. No hace falta *bundler* ni Node: funciona en cualquier navegador moderno y en `scripts/serve.ps1`.
  * Se eliminó la dependencia circular implícita `App ↔ DevKeys`: `DevKeys` ya no llama a `App.route`; la app inyecta su ruta con `DevKeys.setRoute(route)`.
  * La contaminación del ámbito global desaparece: `SONGS`, `LEVELS`, `R`, `L`, `midiToName`, `Users`, `Game`, `AudioEngine`, `MIDI`, `DevKeys`, `App`, etc. ya no aterrizan en `window`.
  * Para depuración y tests automatizados se expone un único gancho intencional `window.__debug__` con todos los módulos (`App`, `Game`, `SONGS`, `Users`, `MIDI`, …).
* **Problema original:** El proyecto cargaba scripts secuenciales en `index.html` mediante etiquetas `<script>` clásicas, comunicándose a través de variables globales (`SONGS`, `LEVELS`, `R`, `L`, `midiToName`, `Users`, `Game`, `AudioEngine`, `MIDI`, `DevKeys`, `App`).
* **Impacto:**
  * Existe acoplamiento implícito al orden de carga en `index.html` (si `songs.js` no carga antes que `game.js` y `app.js`, todo rompe).
  * Constantes de un solo carácter como `R` y `L` están en el scope global (`window`).
  * Hay referencias circulares implícitas (`App` llama a `DevKeys.enable`, y `DevKeys` llama a `App.route`).
* **Mejora:** Usar **ES Modules nativos** (`<script type="module" src="js/app.js"></script>`). No requiere ningún *bundler* ni Node.js, funciona directamente en cualquier navegador moderno y en `scripts/serve.ps1`, y obliga a declarar explícitamente qué exporta e importa cada archivo.

#### 3. ✅ Realizado — Mutación directa del estado de `Users` desde fuera del módulo y falta de validación al importar
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * Todas las escrituras del estado del usuario quedaron encapsuladas en métodos de `Users` que validan y persisten automáticamente: `Users.setPrefs(id, patch)` (velocidad, vista, nivel y canción), `Users.recordProgress(id, songId, mode, stars)` (estrellas o escucha, conservando el mejor resultado), `Users.markListened(id, songId)` y `Users.resetProgress(id)`.
  * `js/app.js` ya no muta `activeUser.prefs.*` ni `u.progress[...]` directamente ni llama a `Users.persist()`: todas las escrituras pasan por esos métodos.
  * Validación estricta de esquema al importar (JSON, código `SP1:` y `localStorage`): `sanitizeUser` / `sanitizeProgress` normalizan nombres, colores, preferencias y progreso (sólo modos conocidos, estrellas enteras entre 1 y 3, fechas como texto y usuarios sin nombre válido descartados). Se aplican también en `load()` y en la migración desde v0.2 (`migrateLegacy`).
* **Problema:**
  * `Users.active()` devuelve la referencia directa al objeto interno del usuario. En `js/app.js` se muta directamente desde fuera (`activeUser.prefs.speed = v`, `u.progress[song.id] = ...`) y luego se llama manualmente a `Users.persist()`.
  * En `Users.importData(obj)`, el objeto `progress` importado desde un JSON o código externo se asigna o fusiona sin sanitizar tipos ni rangos (p. ej., alguien o un error de versión podría inyectar `stars: 999`, `stars: "3"` o estructuras corruptas que rompan la suma en `starTotal`).
* **Impacto:** Hace muy difícil rastrear dónde y cuándo cambia el estado del usuario, y expone la app a corrupciones de estado en `localStorage` difíciles de depurar en un tablet.
* **Mejora:** Encapsular todas las escrituras dentro de métodos de `Users` (p. ej. `Users.setPrefs(patch)`, `Users.recordProgress(songId, mode, stars)`) que validen y persistan automáticamente. Añadir validación estricta de esquema al importar JSON/código.

#### 4. ✅ Realizado — Escalabilidad del catálogo de canciones en un único fichero (`js/songs.js`) y formato manual propenso a errores
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * **Notación compacta** para definir canciones: `notes` pasa a ser un objeto de pistas por mano (`{ R: [...], L: [...] }`) con tokens tipo `'E4:1/3'` (nota MI4, negra, dedo 3); el compilador (`compileNotes` / `compileTrack` en `js/songs.js`) calcula el pulso `b` automáticamente. Soporta acordes (`['C4:4/1', 'E4:4/3']`), silencios (`'&:1'`) y saltos absolutos (`'@12'`). El formato clásico (array de objetos `{ m, b, d, h, f }`) sigue siendo válido.
  * Las 7 canciones existentes se convirtieron a la notación compacta y **se verificó en navegador** que sus notas compiladas coinciden exactamente (`m`, `b`, `d`, `h`, `f`) con las anteriores. `js/songs.js` pasó de ~340 a ~240 líneas.
  * **Validación en arranque (modo dev)**: `validateSongs()` comprueba las reglas del catálogo (ids únicos, nivel existente, `b + d <= totalBeats`, dedos 1–5, notas dentro de `whiteFrom..whiteTo`, coherencia de manos con el nivel y que la última nota acabe en `totalBeats`). Se ejecuta desde `js/app.js` cuando corre en localhost o con `?dev=1`, y expone los problemas en la consola (sin romper la app en producción).
  * **Se eliminó la mutación de `SONGS`**: `Game.compile()` (en `js/game.js`) ya no añade `n.id = i` a las notas originales; ahora clona las notas (`song.notes.filter(...).map((n, i) => ({ ...n, id: i }))`).
* **Problema:** Todas las canciones están definidas como arrays de objetos `{ m: 64, b: 0, d: 1, h: R, f: 3 }` dentro de un mismo archivo `js/songs.js` (ya va por 340 líneas con solo 7 canciones cortas). Además, el motor (`Game.compile()` en `js/game.js:65`) **muta los objetos originales de `SONGS`** añadiéndoles `n.id = i` en cada partida.
* **Impacto:**
  * Cuando haya 30 o 50 canciones, `js/songs.js` tendrá miles de líneas inmanejables.
  * Escribir números MIDI (`64`, `65`, `67`) y calcular los pulsos acumulados (`b: 14, d: 2` → siguiente `b: 16`) a mano es tedioso y propenso a errores humanos (como olvidarse de actualizar `totalBeats` o solapar notas sin querer).
  * Si añadís archivos nuevos de canciones, es muy fácil olvidar añadirlos a la lista `CORE` de `sw.js`, rompiendo el modo offline.
* **Mejora:**
  * Crear una función de validación en arranque (modo dev) que verifique que todas las canciones cumplen las reglas (`b + d <= totalBeats`, dedos entre 1 y 5, notas dentro de `whiteFrom..whiteTo`).
  * Permitir definir canciones con una notación compacta o helper (p. ej. `'E4:1/3'` → nota MI4, negra, dedo 3, calculando el pulso `b` secuencialmente por compás) que se compile al formato interno.
  * Evitar mutar `song.notes` en `Game.compile()` (clonar las notas al compilar: `notesVis = song.notes.filter(...).map((n, i) => ({ ...n, id: i }))`).

---

### 🟠 Prioridad Media (Mantenibilidad, sincronización y rendimiento a medio plazo)

#### 5. ✅ Realizado — Gestión manual de versiones y lista de archivos en el Service Worker (`sw.js`)
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * Creado **`js/version.js`** como fuente única de `APP_VERSION` (v0.9.0). La UI de Ajustes la pinta dinámicamente (`#app-version`) desde `js/app.js`; se eliminó la versión hardcoded `v0.4.0` de `index.html` y `README.md` pasó a v0.9.0.
  * **`scripts/check-sw.ps1`**: comprobación automática en PowerShell puro (sin Node/Python) que verifica que (1) todos los ficheros referenciados en `index.html` (`src`/`href`), (2) todos los `import` de módulos de `js/`, (3) los iconos de `manifest.json` y (4) cada entrada de `CORE` existen en disco y están listadas en `sw.js` (incluidos `./` e `index.html`); además comprueba que la versión del cache de `sw.js` coincide con `APP_VERSION`. Devuelve código de salida 0/1 y lista los problemas.
* **Problema:** La versión está duplicada y desincronizada: `index.html:193` muestra `v0.4.0`, `README.md:7` dice `v0.1`, y `sw.js:6` tiene `simple-piano-v0.5.0`. Además, `CORE` en `sw.js` requiere listar a mano cada fichero del proyecto.
* **Impacto:** Es el fallo clásico en PWAs sin build: se añade un módulo JS o un icono nuevo, se olvida incluirlo en `CORE` o subir `CACHE`, y la tablet de la niña sigue sirviendo código viejo o falla cuando no hay internet.
* **Mejora:** Centralizar la constante `APP_VERSION` (o leerla para pintarla en la UI de Ajustes) y añadir en un pequeño script de PowerShell (o test automático) una comprobación que verifique que todos los ficheros referenciados en `index.html` están en `sw.js`.

#### 6. ✅ Realizado — Fugas de recursos y solapamiento de audio entre pantallas (`js/app.js` / `js/audio.js`)
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * **`js/audio.js`**: `AudioEngine` registra internamente todas las voces activas (notas mantenidas del eco, por tecla, y notas del modo Escuchar). Nuevos métodos `AudioEngine.stopAll()` (corta todas las voces activas) y `AudioEngine.stopNote(midi)` (corta la nota mantenida de una tecla concreta, p. ej. al soltar).
  * **`js/game.js`**: nuevo `Game.resetInput()` que limpia las teclas mantenidas (`pressed`) y el anti-rebote (`lastHitAt`); `Game.stop()` ahora llama a `resetInput()` + `AudioEngine.stopAll()`, de modo que cualquier salida de la partida (terminar la canción o `#btn-back`) silencia notas colgadas y limpia las teclas visuales.
  * **`js/app.js`**: se eliminó el mapa manual `echoVoices` (lo gestiona `AudioEngine`); `route()` usa `AudioEngine.playNote` / `AudioEngine.stopNote`. Al recibir un evento `status` de MIDI con `device: false` (teclado desconectado), `onMidiEvent` llama a `AudioEngine.stopAll()` + `Game.resetInput()` para limpiar las teclas/notas colgadas.
  * `Game._dbg()` expone ahora `pressed` para depuración y tests.
* **Problema original:**
  * En `js/app.js`, cuando el jugador sale de la pantalla de juego (`#btn-back`), se llama a `Game.stop()`, pero si había notas sonando en el modo `listen` o voces activas en `echoVoices`, no se silencian.
  * Si un teclado MIDI o `DevKeys` pierde un evento `noteoff` (o se desconecta el cable USB en mitad de una nota mantenida), la entrada en `echoVoices` y en `pressed` (dentro de `Game`) se queda atascada.
* **Impacto:** Notas "colgadas" visualmente en el teclado guía o sonando al salir al menú.
* **Mejora:** Añadir un método `AudioEngine.stopAll()` que corte las voces activas al llamar a `Game.stop()` o al desconectarse el dispositivo MIDI (`MIDI` emite `status` con `device: false` → limpiar `pressed` y `echoVoices`).

#### 7. ✅ Realizado — Acoplamiento entre lógica de juego y renderizado Canvas en `js/game.js`
* **Estado:** ✅ Hecho (31 oct 2026).
* **Qué se hizo:**
  * Creado **`js/game-engine.js`** (`GameEngine`): simulación pura, sin DOM ni `<canvas>`. Contiene la máquina de estados de los modos (`listen`, espera, `free`), el cálculo de aciertos/errores, las ventanas de tiempo (`FREE_GRACE`, `FREE_TAIL`, `REHIT_MERCY`, `HIT_FADE`, `FREE_COUNTDOWN`), la velocidad, el progreso (`progress`), el audio (`AudioEngine`) y los efectos sonoros. Emite efectos visuales de un solo disparo en `fx` (acierto / error / partículas).
  * Creado **`js/game-render.js`** (`GameRenderer`): dibujo 2D que recibe el estado vivo del motor (`engine.state`) y consume sus efectos (`takeFx`). Aquí vive toda la geometría del teclado guía (`keyX`, `keyWidth`, `kb`, `resize`), las partículas, los destellos (`hitFx`, `wrongFlash`, `shake`) y los textos (`drawReady`, `drawCountdown`).
  * **`js/game.js`** quedó como orquestador (~60 líneas): crea motor y renderizador, gestiona el bucle `requestAnimationFrame`, redirige la entrada (`noteon`/`noteoff`/`tap`), `stop()` (con `AudioEngine.stopAll()`) y expone la misma API pública (`start`, `stop`, `noteon`, `noteoff`, `tap`, `resize`, `setSpeed`, `resetInput`, `_dbg`, `_step`). `js/app.js` y los tests no cambian.
  * Verificado en navegador: partida completa de "Mano derecha" (17/17 notas, 3 estrellas, overlay de victoria) y "¡Toca libre!" completa (cuenta atrás + aciertos, `finish({free:true, hits, total, wrong})`), con consola sin errores.
* **Problema original:** `js/game.js` (534 líneas) mezclaba la máquina de estados del juego (modos `listen`, `free`, espera, cálculo de aciertos/errores, ventanas de tiempo `FREE_GRACE`/`REHIT_MERCY`) con todo el código de dibujo 2D (`drawGrid`, `drawNotes`, `drawKeyboard`, `drawParticles`) y llamadas directas al DOM (`document.getElementById('stage')`).
* **Impacto:** Si en el futuro quieres responder a la pregunta abierta de `docs/diseno.md` (*"¿La niña prefiere las notas cayendo o empezar con las notas fijas y grandes?"* o añadir pentagrama), tendrás que reescribir o llenar de `if/else` el mismo archivo que controla las reglas de acierto.
* **Mejora:** Separar la **simulación/estado de la partida** (`GameState` / `GameEngine`) del **renderizador** (`CanvasRenderer`). El motor actualiza el estado en `update(dt)` y el renderizador simplemente recibe ese estado y lo dibuja. Además, esto permite testear toda la lógica del juego sin necesidad de un `<canvas>`.

#### 8. Rendimiento de dibujado en Canvas en tablets modestas (`js/game.js`)
* **Problema:** En cada frame (60 veces por segundo), `draw()` crea desde cero el gradiente de fondo (`ctx.createLinearGradient(0, 0, 0, H)`), el gradiente de la línea de acierto, y un gradiente lineal por cada nota visible en pantalla (`js/game.js:350`). También busca linealmente con `.some()` y `.find()` dentro de `hitFx` por cada tecla iluminada (`js/game.js:453-455`).
* **Impacto:** Aunque hoy con pocas notas va fluido, en canciones más largas o con más polifonía en tablets Android de gama de entrada, crear decenas de objetos `CanvasGradient` por frame genera presión en el recolector de basura (GC) y tirones (*frame drops*).
* **Mejora:** Cachear los gradientes de fondo y de línea de acierto al hacer `resize()`, y usar colores sólidos (o un único gradiente precalculado/relativo) para el cuerpo de las notas.

---

### 🟢 Prioridad Baja (Calidad de código, accesibilidad y tests)

#### 9. Creación imperativa y repetitiva de DOM en `js/app.js`
* **Problema:** Funciones como `renderLevels()`, `renderLevelView()` y `renderUserList()` construyen tarjetas HTML mediante largas secuencias de `document.createElement`, `.className = ...`, `.appendChild(...)` (líneas 299–336, 361–393, 696–742). Además, las tarjetas de usuario meten `<button class="mini-btn">` **dentro** de otro `<button class="user-card">` (`js/app.js:696-741`), lo cual es HTML inválido según el estándar y causa problemas en lectores de pantalla y algunos navegadores táctiles.
* **Impacto:** Código verboso, difícil de leer y modificar visualmente, y con HTML inválido en las tarjetas de usuario.
* **Mejora:**
  * Usar elementos `<template>` en `index.html` o un pequeño helper declarativo `el(tag, attrs, children)` para reducir a la mitad el código de renderizado manteniéndolo seguro frente a XSS.
  * Cambiar `.user-card` a un `<div>` contenedor con un botón principal de selección y botones hermanos para editar/borrar, evitando anidar `<button>` dentro de `<button>`.

#### 10. Pruebas automatizadas dependientes exclusivamente de la UI del navegador
* **Problema:** Como documenta `docs/pruebas-automatizadas.md`, verificar cualquier cambio requiere levantar el servidor, abrir el navegador y simular pulsaciones de teclas esperando en tiempo real (con trampas como la pérdida de pulsaciones rápidas o esperas de 17 segundos en el modo escuchar).
* **Impacto:** Las pruebas son lentas y frágiles ante cualquier cambio de texto en la interfaz.
* **Mejora:** Aprovechando que ya existe `Game._step(dt)` y `Game._dbg()`, se puede incluir una página o script de **tests unitarios/integración en el propio navegador** (p. ej. `test.html` o una función ejecutable vía `tools.browser.evaluate`) que valide instantáneamente en milisegundos: migración/fusión de `Users`, integridad de todas las canciones de `SONGS`, cálculo de estrellas por nivel y simulación acelerada de una partida completa en cada modo (`rh`, `lh`, `both`, `free`, `listen`) usando `Game._step(0.05)`.

#### 11. CSS monolítico sin variables de diseño globales (`css/style.css`)
* **Problema:** Salvo las 4 variables del color del usuario (`--user-color`, etc.), todos los colores del tema oscuro (`#151226`, `#f8fafc`, `#a5b4fc`, `#94a3b8`), colores de manos (`#22c55e`, `#6366f1` — que además están duplicados en `css/style.css` y en `js/game.js`), radios de borde y sombras están escritos a fuego (*hardcoded*) a lo largo de las 546 líneas de CSS.
* **Impacto:** Dificulta mantener la consistencia visual o ajustar la paleta de colores en el futuro.
* **Mejora:** Definir variables CSS en `:root` para la paleta semántica (`--color-rh`, `--color-lh`, `--color-gold`, `--bg-surface`, `--text-muted`, etc.) y leerlas incluso desde el Canvas con `getComputedStyle` al iniciar para tener una única fuente de verdad entre CSS y Canvas.