# Probar en el ordenador (sin teclado)

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

> Para **probar la app con el navegador desde OpenCode** (agente de IA), ver
> [Pruebas automatizadas](pruebas-automatizadas.md): levantar `scripts/serve.ps1`
> en background y usar las herramientas `browser.*` (snapshot, click, press…).
