# Genera los iconos de Simple Piano (PNG 192 / 512 / 512 maskable).
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\gen-icons.ps1

Add-Type -AssemblyName System.Drawing

function New-RoundPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    if ($d -gt $w) { $d = $w }
    if ($d -gt $h) { $d = $h }
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

function New-Icon([int]$size, [string]$out, [bool]$maskable) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # fondo degradado violeta -> indigo
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 76, 29, 149),
        [System.Drawing.Color]::FromArgb(255, 37, 18, 78),
        [float]90)
    $g.FillRectangle($bg, $rect)

    $u = $size / 100.0
    $m = if ($maskable) { $size * 0.13 } else { $size * 0.06 }

    # notas que caen (verde, rosa, dorado)
    $notes = @(
        @{ x = 20; y = 16; c = [System.Drawing.Color]::FromArgb(255, 74, 222, 128) },
        @{ x = 52; y = 28; c = [System.Drawing.Color]::FromArgb(255, 244, 114, 182) },
        @{ x = 78; y = 10; c = [System.Drawing.Color]::FromArgb(255, 255, 209, 102) }
    )
    $white = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 255, 255, 255), [float](1.8 * $u))
    foreach ($n in $notes) {
        $b = New-Object System.Drawing.SolidBrush($n.c)
        $path = New-RoundPath ([float]($n.x * $u)) ([float]($n.y * $u)) ([float](14 * $u)) ([float](19 * $u)) ([float](3.5 * $u))
        $g.FillPath($b, $path)
        $g.DrawPath($white, $path)
    }

    # piano blanco con 5 teclas
    $py = [float]($size * 0.54)
    $ph = [float]($size * 0.33)
    $pw = [float]($size - 2 * $m)
    $kbPath = New-RoundPath ([float]$m) $py $pw $ph ([float](6 * $u))
    $kbBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
    $g.FillPath($kbBrush, $kbPath)

    $divPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 203, 213, 225), [float](1.2 * $u))
    for ($i = 1; $i -lt 5; $i++) {
        $x = $m + $pw * $i / 5
        $g.DrawLine($divPen, [float]$x, [float]($py + 2 * $u), [float]$x, [float]($py + $ph - 2 * $u))
    }

    # teclas negras
    $black = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 17, 24, 39))
    $bkw = [float]($pw * 0.11)
    $bkh = [float]($ph * 0.58)
    foreach ($f in @(1, 2, 4)) {
        $x = $m + $pw * $f / 5 - $bkw / 2
        $bp = New-RoundPath ([float]$x) ([float]($py - 1.5 * $u)) $bkw $bkh ([float](1.5 * $u))
        $g.FillPath($black, $bp)
    }

    $g.Dispose()
    $dir = Split-Path $out -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "OK  $out ($size px)"
}

$root = $PSScriptRoot + "\.."
New-Icon 192 ($root + "\icons\icon-192.png") $false
New-Icon 512 ($root + "\icons\icon-512.png") $false
New-Icon 512 ($root + "\icons\icon-maskable-512.png") $true
