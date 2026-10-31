# 🎹 Simple Piano

App web para que una niña de 8 años aprenda a tocar el piano **con su teclado real**,
estilo SimplyPiano: notas que caen en la pantalla del tablet, la app escucha el
teclado por USB (Web MIDI) y espera a que acierte cada nota. Cero castigos.

Prototipo v0.10.0 · cuatro niveles (mano derecha, mano izquierda, las dos manos y manos en equipo) con canciones populares y originales.

> **Este README es un índice.** Cada tema tiene su propio documento en [`docs/`](docs/).
> Al añadir, quitar o renombrar un documento, actualiza también esta lista.

## Índice de documentación

### Uso

- [Cómo funciona](docs/como-funciona.md): fases del juego, modo espera, velocidad y estrellas.
- [Niveles del método](docs/niveles.md): criterios de cada nivel (del 1 al 4) y qué canciones deben tener.
- [Cable del teclado](docs/cable-teclado.md): tipos de conector y adaptadores necesarios.
- [Notas técnicas](docs/notas-tecnicas.md): navegadores compatibles, sonido y pantalla encendida.
- [Perfiles de usuario](docs/usuarios.md): cuentas locales por jugador, color de la interfaz y exportar/importar.

### Desarrollo

- [Probar en el ordenador](docs/probar-en-ordenador.md): ejecutar el servidor local y probar sin teclado.
- [Pruebas automatizadas (agente)](docs/pruebas-automatizadas.md): cómo levantar el servidor local y probar la app con el navegador desde OpenCode.
- [Estructura del proyecto](docs/estructura.md): qué hace cada fichero y carpeta.
- [Cómo añadir una canción](docs/anadir-cancion.md): formato de `js/songs.js`, notas MIDI y digitación.
- [Crear una Pull Request](docs/crear-pull-request.md): crear la PR con la API de GitHub sin `gh`.
- [Documento de diseño](docs/diseno.md): decisiones pedagógicas, arquitectura y preguntas abiertas.
- [Refactor](docs/refactor.md): instrucciones para el refactor en el que estamos trabajando.

### Publicación

- [Publicar en GitHub Pages](docs/publicar-github-pages.md): subir el proyecto y activar Pages.
- [Instalar como app en Android](docs/instalar-android.md): instalación PWA y uso sin internet.
