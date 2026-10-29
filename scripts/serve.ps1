# Mini servidor estático para probar Simple Piano en local (sin Python ni Node).
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
# Luego abre:  http://127.0.0.1:8080

param(
    [int]$Port = 8080
)

$root = Split-Path $PSScriptRoot -Parent
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Simple Piano sirviendo en http://127.0.0.1:$Port  (Ctrl+C para parar)"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".md"   = "text/plain; charset=utf-8"
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
        $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
        if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
        $rel = $path.TrimStart("/") -replace "/", "\"
        $file = Join-Path $root $rel
        if ((Test-Path $file -PathType Leaf) -and $file.StartsWith($root)) {
            $bytes = [IO.File]::ReadAllBytes($file)
            $ext = [IO.Path]::GetExtension($file).ToLower()
            if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $txt = [Text.Encoding]::UTF8.GetBytes("404")
            $ctx.Response.OutputStream.Write($txt, 0, $txt.Length)
        }
    } catch { }
    $ctx.Response.Close()
}
