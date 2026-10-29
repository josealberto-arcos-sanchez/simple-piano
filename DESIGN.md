# Simple Piano — Documento de diseño

> **v0.1** · Octubre 2026 · documento vivo, igual que *plan-de-juego.md* de Wordlings.
> Hereda su filosofía: fase mínima que valide una sola cosa — **¿quiere volver a tocar mañana?**

## Concepto

SimplyPiano en casa, pero hecho a la medida de la niña y sin suscripciones:

- **El instrumento es el teclado real** de casa. La tablet es *la profe*: notas
  que caen + teclado guía que ilumina tecla y dedo. Nunca se "toca el piano" en la pantalla.
- Detección exacta por **Web MIDI** (cable USB), como los method-books digitales.
- **PWA** instalable en Android, offline, gratis en GitHub Pages.

## Decisiones pedagógicas

| Decisión | Por qué |
|---|---|
| Modo espera (la nota no avanza hasta acertar) | Sin presión de ritmo en el arranque; el error no rompe el flujo |
| Fase 5 "¡Toca libre!" (la canción no se para) | El objetivo final: leer las notas y tocar sin ayuda; acierto dentro del rectángulo = destello dorado, fuera = rojo suave |
| Velocidad ajustable (🐢 ×0,7 · 😊 ×1 · 🐇 ×1,4) | El adulto adapta el reto en cualquier fase; nunca hay un muro de tempo |
| Manos separadas antes que juntas | Camino clásico (Bastien, Faber, SimplyPiano): RH → LH → ambas |
| Posición fija (5 dedos por mano, sin saltos) | La primera pieza debe ser *tocable*, no *descifrable* |
| Himno de la Alegría como canción 1 | Suena "a música de verdad" siendo 5 notas por mano = orgillo |
| Números de dedo en nota y tecla | Codifica la digitación correcta desde el primer día |
| Do-Re-Mi (no C-D-E) | Estándar en las escuelas de música españolas |
| "Ayuditas" en vez de "errores" | El lenguaje importa: nunca culpabilizar (rachas sin drama, como Wordlings) |
| Siempre se gana una estrella | Cero castigos; 0 errores = 3⭐ |

## Arquitectura

- HTML/CSS/JS **vanilla**, sin build ni dependencias → manutenible y publicable en GitHub Pages.
- Canción = array de `{nota MIDI, pulso, duración, mano, dedo}` → añadir canciones es trivial.
- Canvas para las notas que caen (60 fps suaves incluso en tablets modestas).
- Web Audio sintetizado (sin samples): suficiente para el modo Escuchar y el eco.

## Preguntas abiertas (para la v0.2)

1. ¿Cómo se llama la app de verdad? (Simple Piano es provisional; ideas: Teclitas, DoReMi, Pianín)
2. ¿La niña prefiere las notas cayendo o empezar con las notas fijas y grandes?
3. ¿El teclado de casa tiene altavoces? (afecta al eco por defecto)
4. ¿Segunda canción: Estrellita o Cumpleaños feliz?
5. ¿Nombre grabado de ánimos (voz de papá/mamá) en los mensajes? (bonus emocional barato)
