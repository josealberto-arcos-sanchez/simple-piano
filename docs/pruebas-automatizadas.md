# Pruebas automatizadas (para el agente)

> Estas notas van dirigidas al **agente de IA** que trabaje en este repo en el
> futuro. Recogen el flujo de pruebas que ya se ha usado con éxito y las trampas
> encontradas, para no volver a tropezar con lo mismo.

## 1. Entorno: sin Node ni Python

Este equipo **no tiene** `node`, `python` ni `py` reales (sólo existen los
alias de la Microsoft Store, que fallan con *"no se encontró Python"*). Por eso:

- **No** intentes `node --check`, `python -m http.server`, `npx serve`, etc.
- **Sí** existe un servidor estático en PowerShell puro: **`scripts/serve.ps1`**
  (sin dependencias). Es el servidor local recomendado para este equipo.
- En CI (GitHub Actions) se usa un servidor estático equivalente en Node:
  **`scripts/serve.mjs`** (mismo comportamiento, multiplataforma).
- **`scripts/check-sw.ps1`** (PowerShell puro) verifica la coherencia del Service
  Worker: que `sw.js` lista todos los ficheros referenciados en `index.html`,
  los `import` de `js/` y los iconos de `manifest.json`, que `CORE` existe en
  disco y que el cache usa la misma versión que `js/version.js`. Útil tras
  añadir ficheros o subir la versión.

## 2. Levantar el servidor

Desde la shell de OpenCode (que es PowerShell), ejecuta en **background**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\serve.ps1 -Port 8234
```

El puerto de pruebas por defecto es el `8234` (funciona sin permisos especiales;
evita el `8123`, que Windows suele tener reservado por el sistema). Usa otro
puerto si el `8234` ya está ocupado. Después abre la app con la herramienta de
navegador:

```
tools.browser.tabs.open({ url: 'http://127.0.0.1:8234/', focus: true })
```

> El navegador de pruebas **no admite `file://`** (rutas locales) ni URLs con
> credenciales: siempre hay que usar HTTP contra el servidor local.

### 2.1. Cómo parar el servidor

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8234 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue
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
- [ ] Estrellas por nivel correctas: Nivel 1 = 0/12, Nivel 2 = 0/12,
      Nivel 3 = 0/48 (4 canciones × 12), Nivel 4 = 0/36 (3 canciones × 12).
- [ ] Nivel 1 sólo muestra Escuchar · Mano derecha · ¡Toca libre! (sin
      "Mano izquierda" ni "¡Las dos manos!").
- [ ] Nivel 3 y Nivel 4 muestran los 5 modos.
- [ ] Al completar un modo, las estrellas del nivel suben (p. ej. 2/12) y el
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

La lógica de verificación está en `tests/smoke.spec.js` y usa
`@playwright/test` como única dependencia de desarrollo.

