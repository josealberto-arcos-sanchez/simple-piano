# Notas técnicas

- **Web MIDI** funciona en Chrome/Edge de escritorio y **Android**. Firefox no lo soporta.
- La app usa **módulos ES** (`import`/`export`): requiere servirse por `http(s)`
  (no funciona abriendo `index.html` como archivo local). Navegadores modernos
  (Chrome/Edge/Firefox/Safari recientes) y `scripts/serve.ps1`.** soportan.
- El sonido del modo Escuchar es **síntesis** (armónicos + envolvente). Si el
  teclado de casa no tiene altavoces, activa el **eco en la app** para oír lo que toca.
- La pantalla se mantiene encendida durante el juego (Wake Lock API).
