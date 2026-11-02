# Crear una Pull Request

La PR se crea con `scripts/create-pr.mjs` (API de GitHub, Node puro, sin dependencias):

```bash
npm run pr -- "Título de la PR" --body-file descripcion.md
```

Opciones:

- `--body-file ruta.md`: descripción de la PR leída desde un fichero (UTF-8).
- `--base main`: rama destino (por defecto `main`).
- `--dry-run`: valida y muestra lo que se enviaría, sin crear la PR.

El script detecta `owner/repo` y la rama actual desde `git`. Antes, la rama debe estar
subida (`git push -u origin <rama>`).

El token se toma, por este orden, de `GH_TOKEN` o `GITHUB_TOKEN`, de la sesión de
GitHub CLI (`gh auth token`) o de las credenciales que Git tiene guardadas para
github.com. No copies el token en ningún archivo.
