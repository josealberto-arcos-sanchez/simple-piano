# Publicar en GitHub Pages

1. Crea un repositorio en GitHub (p. ej. `simple-piano`) — **público** (Pages gratis no funciona en privados en cuentas gratuitas).
2. Sube el proyecto:
   ```powershell
   cd C:\jose_alberto\proyectos\simple-piano
   git init
   git add -A
   git commit -m "Simple Piano v0.1"
   git remote add origin https://github.com/TU_USUARIO/simple-piano.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Branch: main → Save**.
4. En un minuto la app está en `https://TU_USUARIO.github.io/simple-piano/`

Para instalarla después en el móvil o tablet, ver [Instalarla como app en Android](instalar-android.md).
