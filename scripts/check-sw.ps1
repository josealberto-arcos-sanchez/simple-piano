# Comprobación de coherencia del Service Worker con la app (sin Node ni Python).
# Verifica que:
#   1. Todos los ficheros referenciados en index.html (src/href) están en CORE de sw.js.
#   2. Todos los módulos que importan los ficheros de js/ están en CORE.
#   3. Los iconos listados en manifest.json están en CORE.
#   4. Cada entrada de CORE existe en disco (y CORE incluye ./ e index.html).
#   5. La versión del cache de sw.js coincide con APP_VERSION de js/version.js.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\check-sw.ps1
# Salida: 0 si todo correcto, 1 con la lista de problemas.

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$failures = New-Object System.Collections.Generic.List[string]

function Test-InCore([string]$rel, [System.Collections.Generic.HashSet[string]]$core) {
    # normaliza './x' -> 'x' y '.' -> ''
    if ($rel -eq '.' -or $rel -eq '') { $rel = '' }
    elseif ($rel.StartsWith('./')) { $rel = $rel.Substring(2) }
    $rel = $rel.TrimStart('/')
    return $core.Contains($rel)
}

# ── lee sw.js y su lista CORE ──
$swPath = Join-Path $root 'sw.js'
$sw = Get-Content -Raw -Encoding UTF8 $swPath

$m = [regex]::Match($sw, '(?s)CORE\s*=\s*\[(.*?)\]')
if (-not $m.Success) {
    Write-Host "ERROR: no se encontró la lista CORE en sw.js" -ForegroundColor Red
    exit 1
}
$core = New-Object System.Collections.Generic.HashSet[string]
[regex]::Matches($m.Groups[1].Value, '''([^'']+)''') | ForEach-Object {
    $entry = $_.Groups[1].Value
    if ($entry.StartsWith('./')) { $entry = $entry.Substring(2) }
    $null = $core.Add($entry)
}

# ── 1. ficheros referenciados en index.html ──
$html = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'index.html')
foreach ($r in [regex]::Matches($html, '(?:src|href)=["'']([^"'']+)["'']')) {
    $ref = $r.Groups[1].Value
    if (-not $ref) { continue }
    if ($ref.StartsWith('http://') -or $ref.StartsWith('https://') -or $ref.StartsWith('#')) { continue }
    if ($ref.Contains(':')) { continue }   # data:/mailto: etc.
    $norm = $ref -replace '\?.*$', '' -replace '#.*$', ''
    if (-not (Test-InCore $norm $core)) {
        $failures.Add("Falta en CORE de sw.js (referenciado en index.html): $norm")
    }
}

# ── 2. imports de módulos de js/ ──
Get-ChildItem (Join-Path $root 'js') -Filter *.js -File | ForEach-Object {
    $text = Get-Content -Raw -Encoding UTF8 $_.FullName
    foreach ($im in [regex]::Matches($text, 'from\s+["'']([^"'']+)["'']')) {
        $spec = $im.Groups[1].Value
        if ($spec.StartsWith('./') -or $spec.StartsWith('../')) {
            $resolved = [IO.Path]::GetFullPath((Join-Path (Split-Path $_.FullName) $spec))
            $rel = $resolved.Substring($root.Length + 1) -replace '\\', '/'
            if (-not (Test-InCore $rel $core)) {
                $failures.Add("Falta en CORE de sw.js (importado por js/$($_.Name)): $rel")
            }
        }
    }
}

# ── 3. iconos de manifest.json ──
$manifestPath = Join-Path $root 'manifest.json'
if (Test-Path $manifestPath) {
    $manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
    if ($manifest.icons) {
        foreach ($ic in $manifest.icons) {
            if (-not (Test-InCore $ic.src $core)) {
                $failures.Add("Falta en CORE de sw.js (icono de manifest.json): $($ic.src)")
            }
        }
    }
}

# ── 4. entradas de CORE: existencia en disco y entradas imprescindibles ──
if (-not (Test-InCore '' $core)) { $failures.Add('CORE debe incluir ./ (raíz, para navegación offline)') }
if (-not (Test-InCore 'index.html' $core)) { $failures.Add('CORE debe incluir index.html (fallback offline)') }
foreach ($entry in $core) {
    $p = if ($entry) { Join-Path $root ($entry -replace '/', '\') } else { $root }
    if (-not (Test-Path $p)) { $failures.Add("Entrada de CORE no existe en disco: $entry") }
}

# ── 5. versión del cache de sw.js vs APP_VERSION ──
$vJs = [regex]::Match(
    (Get-Content -Raw -Encoding UTF8 (Join-Path $root 'js/version.js')),
    "APP_VERSION\s*=\s*'([^']+)'")
$vCache = [regex]::Match($sw, "CACHE\s*=\s*'([^']+)'")
if (-not $vJs.Success) { $failures.Add('No se encontró APP_VERSION en js/version.js') }
elseif (-not $vCache.Success) { $failures.Add('No se encontró CACHE en sw.js') }
elseif ($vCache.Groups[1].Value -notlike "*$($vJs.Groups[1].Value)*") {
    $failures.Add("Versión desincronizada: cache de sw.js '$($vCache.Groups[1].Value)' vs APP_VERSION '$($vJs.Groups[1].Value)'")
}

# ── resultado ──
if ($failures.Count -gt 0) {
    Write-Host "ERROR: $($failures.Count) problema(s) de coherencia con sw.js:" -ForegroundColor Red
    foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Yellow }
    exit 1
}
Write-Host "OK: Service Worker coherente: CORE cubre index.html, imports e iconos; versión $($vJs.Groups[1].Value)." -ForegroundColor Green
exit 0
