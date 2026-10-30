# Crear una Pull Request (sin GitHub CLI)

Si no tienes `gh` instalado, la PR se puede crear con la API de GitHub. Hace falta
un token: se toma de la variable `GH_TOKEN` o de las credenciales que Git ya tiene
guardadas para github.com (las que se usan al hacer `git push`). No copies el token
en ningún archivo.

```powershell
cd C:\jose_alberto\proyectos\simple-piano
$rama = git branch --show-current
$cred = "protocol=https`nhost=github.com`n`n" | git credential fill
$token = if ($env:GH_TOKEN) { $env:GH_TOKEN } else { ($cred | Where-Object { $_ -like 'password=*' }) -replace '^password=','' }
$headers = @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json"; "X-GitHub-Api-Version" = "2022-11-28" }
$payload = [ordered]@{
  title = "TÍTULO DE LA PR"
  head  = $rama
  base  = "main"
  body  = "DESCRIPCIÓN DE LA PR"
}
# Enviar el cuerpo en UTF-8 para que los acentos y símbolos lleguen bien
$bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))
$pr = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/TU_USUARIO/simple-piano/pulls" -Headers $headers -Body $bytes -ContentType "application/json; charset=utf-8"
$pr.html_url
```

Antes, la rama debe estar subida (`git push -u origin <rama>`). Sustituye `TU_USUARIO`,
el título y la descripción. Si GitHub devuelve `400 Problems parsing JSON`, casi
siempre es por la codificación: usa el envío en bytes UTF-8 como arriba.
