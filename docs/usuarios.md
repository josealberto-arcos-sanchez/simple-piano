# Perfiles de usuario

Cada persona que toca tiene su propia cuenta local: un nombre, un color y su
progreso (estrellas, canción elegida y velocidad preferida). No hay
contraseñas: el cambio entre jugadores es inmediato.

## Cómo funciona

- **Datos locales**: todo vive en `localStorage` bajo la clave
  `simple-piano-users-v1`. Nada sale del dispositivo salvo cuando exportas.
- **Primer arranque**: si no existe ningún jugador, la app pide crear uno
  (nombre + color) antes de dejar jugar. Si venías de la versión anterior
  (v0.2), tu progreso global se migra solo al primer jugador.
- **Migración automática**: el progreso que se guardaba globalmente en
  `simple-piano-progress-v1` se convierte en el progreso del "Jugador 1".

## Cambiar de jugador (rápido)

1. Toca el **chip de jugador** en la cabecera de inicio (marca un círculo con
   el color de la cuenta activa).
2. En el panel de **Jugadores**, toca cualquier tarjeta para cambiar al
   instante. Su color tiñe la interfaz y sus estrellas aparecen.
3. **➕ Nuevo jugador** crea una cuenta (nombre libre + color).

## Color de la interfaz

El color de la cuenta activa se aplica a:

- El fondo de la pantalla de inicio.
- El borde de la tarjeta de canción, la canción activa y la velocidad activa.
- La cabecera de la partida (borde inferior + insignia con el nombre).
- La pantalla de victoria (mensaje y borde del panel en ese color).

Los colores del juego (verde = mano derecha, morado = izquierda, dorado =
acierto, rojo = ayudita) **no cambian**: identifican al jugador, no a la
música.

## Exportar / importar (multi-dispositivo)

Dentro del panel de Jugadores:

- **Guardar copia de todos (archivo)**: descarga un JSON con todos los
  jugadores. Útil para hacer copias de seguridad o pasar a otro dispositivo.
- **Copiar código de todos**: copia un código `SP1:...` (Base64) con todos los
  jugadores al portapapeles. Pégalo en otro dispositivo con **Pegar código**.
- **Guardar copia de este jugador (archivo)**: descarga un JSON con **sólo el
  jugador activo**. Ideal para compartir o mover una única cuenta.
- **Cargar copia (archivo)**: lee un JSON exportado.

Al importar, los usuarios se **fusionan**: no se pisan entre sí. Si un
jugador ya existe, se conserva el mayor número de estrellas en cada canción.
