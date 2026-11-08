# Pruebas automatizadas (para el agente)

> Estas notas van dirigidas al **agente de IA** que trabaje en este repo en el
> futuro. Recogen el flujo de pruebas que ya se ha usado con éxito y las trampas
> encontradas, para no volver a tropezar con lo mismo.

## 1. Entorno: Linux + Node.js

Este equipo tiene Ubuntu 22.04, Bash y Node.js (la versión está fijada en `.nvmrc`,
20, la misma que el CI). Las dependencias se instalan con `npm ci`.

- Servidor estático: **`scripts/serve.mjs`** (Node puro, sin dependencias). Es el
  mismo que usa el CI, así que el comportamiento es idéntico en local y en GitHub.
- **`scripts/check-sw.mjs`** (`npm run check`) verifica la coherencia del Service
  Worker: que `sw.js` lista todos los ficheros referenciados en `index.html`,
  los `import` de `js/` y los iconos de `manifest.json`, que `CORE` existe en
  disco y que el cache usa la misma versión que `js/version.js`. Útil tras
  añadir ficheros o subir la versión.

## 2. Levantar el servidor

Desde la shell de OpenCode, ejecuta en **background**:

```bash
PORT=8234 npm run serve
```

El puerto de pruebas es el `8234`. Si está ocupado, usa otro puerto cambiando
`PORT`. Después abre la app con la herramienta de navegador:

```
tools.browser.tabs.open({ url: 'http://127.0.0.1:8234/', focus: true })
```

> El navegador de pruebas **no admite `file://`** (rutas locales) ni URLs con
> credenciales: siempre hay que usar HTTP contra el servidor local.

### 2.1. Cómo parar el servidor

```bash
fuser -k 8234/tcp
```

## 3. Herramientas del navegador disponibles

Dentro de Code Mode (la función `execute`), el namespace `tools.browser.*` ofrece
(entre otras):

| Herramienta | Uso |
|---|---|
| `tabs.open` / `tabs.list` / `tabs.close` | Abrir / listar / cerrar pestañas. Los ids son `tab_...`. |
| `snapshot` | **Accesibilidad** de la página con refs de elementos (`@eNNNN`). Es la fuente principal de inspección. |
| `click` / `check` / `fill` / `select` / `press` | Interactuar con botones, casillas, textos, selects y teclas. |
| `wait` | Esperar condiciones: `condition: 'load' \| 'text' \| 'textGone'` + `text` + `timeoutMs` (hasta 30000). |
| `reload` | Recargar la página (útil para probar la memoria de pantalla). |
| `console` | Leer mensajes y errores no capturados de la consola del navegador. |
| `evaluate` | Ejecutar JavaScript en la página (p. ej. inspeccionar `localStorage`, `__debug__.App`, `__debug__.Game`). |
| `screenshot` | Captura PNG (se guarda en el servidor). Ojo: algunos modelos **no pueden leer imágenes**; prefiere `snapshot`. |

## 4. Flujo de prueba recomendado

1. `wait` a que cargue el primer texto persistente (p. ej. `Elige un nivel`).
2. `snapshot` para ver el estado (si es el primer arranque aparecerá el overlay
   forzado de crear jugador).
3. Crear jugadores de prueba con `fill` (nombre) + `click` (`¡Listo!`).
4. Navegar por niveles, comprobar estrellas y modos con `snapshot`.
5. Probar partidas con `press` (ver §6).
6. Recargar con `reload` para comprobar la memoria de pantalla.
7. Revisar `console` al final: debe estar vacía (0 mensajes de error).

## 5. Cómo sacar los `ref` de los elementos

El snapshot devuelve líneas como:

```
@e20091 [button] "👉 Mano derecha ☆☆☆"
```

Para usar el ref en `click`/`fill`/etc., **quita el texto y los corchetes**,
deja sólo el identificador:

```javascript
const m = snap.content.match(/@e\d+ \[button\] "👉 Mano derecha ☆☆☆"/);
const ref = m[0].replace(/ \[button\].*$/, '');   // → "@e20091"
await tools.browser.click({ tabID: tab, ref });
```

## 6. Trampas conocidas (importante)

- **Textos transitorios**: `¡Preparada!` sólo aparece un instante al empezar una
  partida. `wait` con `text` sobre textos efímeros falla (timeout). Usa textos
  persistentes del HUD (p. ej. `Compás 1/5 · Nota 0/17`) o `textGone` para
  detectar que una pantalla desapareció (p. ej. `textGone` de `✕` cuando
  termina la partida).
- **El título del juego incluye el nombre de la canción**: si esperas
  `text: 'Pan caliente'` durante una partida, se cumple al instante (está en el
  título). Espera mejor al marcador o a la desaparición de la pantalla de juego.
- **`press` encadenados rápido se pierden**: al tocar en modo prueba
  (`q w e r t`) envía una tecla, verifica el marcador (`Nota N/17`) con
  `wait`, y **reintenta la misma tecla** (máx. 3 intentos) si no avanzó. Los
  presses perdidos cuentan como "ayuditas" (estrellas menos brillantes).
- **No hay `setTimeout` dentro de `execute`**: para esperar entre pasos usa
  `tools.browser.wait` (con `timeoutMs` adecuado), no temporizadores.
- **Modo Escuchar dura en tiempo real**: `~ totalBeats / (bpm/60) + 2.5 s`
  (p. ej. *Pan caliente*, 20 pulsos a 84 bpm ≈ 17 s). Usa
  `wait({ timeoutMs: 30000 })`.
- **Partidas con estrellas** (Mano derecha/izquierda/Dos manos/Libre) requieren
  dispositivo MIDI o **modo prueba**: en el overlay de conexión pulsa
  *"No tengo el cable ahora → probar con las teclas del ordenador"* y luego
  *"¡A jugar! (modo prueba)"*.
- La consola debe quedar **vacía**: `tools.browser.console({ tabID })` con
  `messages.length === 0` y sin errores.

## 7. Checklist rápido de la feature "niveles"

Al tocar el código de niveles, comprueba con el navegador:

- [ ] Menú principal: una tarjeta por nivel, todas abiertas (sin candados).
- [ ] Estrellas por nivel correctas (máximo = suma de sus canciones, 3 estrellas por
      modo jugable): Nivel 1 = 0/36 (6 canciones), Nivel 2 = 0/36 (6 canciones),
      Nivel 3 = 0/48 (4 canciones), Nivel 4 = 0/60 (5 canciones), Nivel 5 = 0/60 (5 canciones).
- [ ] Nivel 1 sólo muestra Escuchar · Mano derecha · ¡Toca libre! (sin
      "Mano izquierda" ni "¡Las dos manos!").
- [ ] Nivel 3, Nivel 4 y Nivel 5 muestran los 5 modos.
- [ ] Al completar un modo, las estrellas del nivel suben (p. ej. 3/36) y el
      botón "Siguiente" salta al modo correcto (`rh → free` en canciones de
      una mano).
- [ ] Tras `reload`, cada jugador vuelve a la misma vista (menú o detalle),
      mismo nivel y misma canción.
- [ ] Cambiar de jugador restaura la vista de cada uno independientemente.
- [ ] Consola sin errores.

## 8. CI automatizada (GitHub Actions)

El repo incluye el workflow **`.github/workflows/test.yml`** que en cada `push`
a `main` y en cada Pull Request:

- instala la app y Playwright con Chromium;
- levanta `scripts/serve.mjs` (servidor estático en Node);
- abre `test.html` con un navegador headless y comprueba que la suite pasa al
  100% (ningún `li.fail`, resumen `X/X correctos`, sin errores de consola).

Para ejecutarla en local (equipo con Node):

```bash
npm install
npx playwright install chromium
npm test
```

La lógica de verificación está en `tests/` y usa `@playwright/test` como única
dependencia de desarrollo:

- `tests/smoke.spec.js`: abre `test.html` y exige que la suite pase al 100%.
- `tests/niveles.spec.js`: recorre la app real (menú, modos por nivel, memoria tras
  recargar, cambio de jugador y una partida completa con "Siguiente"). Bloquea el
  service worker (`serviceWorkers: 'block'`) porque su recarga interrumpe los formularios.

Los casos de la checklist de niveles (§7) que son lógica pura están en `test.html`
(modos y "Siguiente" de todas las canciones, estrellas por nivel, progreso por jugador).

