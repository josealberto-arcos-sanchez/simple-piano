# Probar en el ordenador (sin teclado)

```bash
npm run serve
```

Abre <http://127.0.0.1:8080>. En la pantalla de conexión, pulsa
*"No tengo el cable ahora → probar con las teclas del ordenador"*:
`z x c v b` = DO RE MI FA SOL (mano izquierda) · `q w e r t` = DO RE MI FA SOL (mano derecha).

> Se necesita un servidor (no abrir el `index.html` directamente) porque:
> - La app usa **módulos ES** (`import`/`export`) y el navegador los bloquea en
>   `file://`. Si abres `index.html` como archivo local, verás un aviso en
>   pantalla (la app no arranca).
> - Web MIDI y el service worker sólo funcionan en `http(s)`.
> (Alternativa sin Node: `python3 -m http.server 8080`.)

> **Actualizar desde una versión anterior:** si ya tenías la app abierta (service
> worker cacheado) y al recargar se queda en blanco, haz una **recarga forzada**
> (Ctrl+F5 / borrar datos del sitio) o pulsa *"🔄 Buscar actualización"* en
> Ajustes. La versión de caché sube con cada cambio de estructura.

> Para **probar la app con el navegador desde OpenCode** (agente de IA), ver
> [Pruebas automatizadas](pruebas-automatizadas.md): levantar `npm run serve`
> en background y usar las herramientas `browser.*` (snapshot, click, press…).
