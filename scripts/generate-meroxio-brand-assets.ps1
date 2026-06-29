Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$res = Join-Path $root "android\app\src\main\res"

function New-Bitmap($width, $height, [bool]$transparent = $false) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 11, 15, 14))
  }
  return @($bitmap, $graphics)
}

function New-RoundRectPath($x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Convert-Points($coords, $scale, $offsetX, $offsetY) {
  $points = New-Object System.Drawing.PointF[] ($coords.Count / 2)
  for ($i = 0; $i -lt $coords.Count; $i += 2) {
    $points[$i / 2] = New-Object System.Drawing.PointF([single]($offsetX + $coords[$i] * $scale), [single]($offsetY + $coords[$i + 1] * $scale))
  }
  return $points
}

function New-MarkPath($scale, $offsetX, $offsetY) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $m = Convert-Points @(192,724, 192,350, 250,326, 512,596, 774,326, 832,350, 832,724, 692,724, 692,534, 512,718, 332,534, 332,724) $scale $offsetX $offsetY
  $arrow = Convert-Points @(574,438, 836,178, 682,206, 702,318, 478,540, 574,636, 798,414, 910,434, 938,280, 674,540) $scale $offsetX $offsetY
  $path.AddPolygon($m)
  $path.AddPolygon($arrow)
  return $path
}

function Draw-Mark($graphics, $size, $x, $y, $markSize, [bool]$withGlow = $true) {
  $scale = $markSize / 1024.0
  $mPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $mPoints = Convert-Points @(256,712, 256,352, 512,608) $scale $x $y
  $mPath.AddLines($mPoints)
  $rightStemPoints = Convert-Points @(768,712, 768,436) $scale $x $y
  $mPath.StartFigure()
  $mPath.AddLines($rightStemPoints)
  $arrowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $arrowPoints = Convert-Points @(512,608, 808,312) $scale $x $y
  $arrowPath.AddLines($arrowPoints)
  $headPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $headPoints = Convert-Points @(788,236, 908,204, 876,324) $scale $x $y
  $headPath.AddPolygon($headPoints)
  $strokeWidth = [single]($markSize * 0.094)
  if ($withGlow) {
    for ($i = 4; $i -ge 1; $i--) {
      $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(14 * $i, 46, 204, 113), [single]($strokeWidth + $markSize * (0.018 * $i)))
      $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $graphics.DrawPath($pen, $mPath)
      $graphics.DrawPath($pen, $arrowPath)
      $pen.Dispose()
      $headGlow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12 * $i, 46, 204, 113))
      $graphics.FillPath($headGlow, $headPath)
      $headGlow.Dispose()
    }
  }
  $rect = New-Object System.Drawing.RectangleF($x, $y, $markSize, $markSize)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255, 125, 255, 92), [System.Drawing.Color]::FromArgb(255, 46, 204, 113), 45)
  $pen = New-Object System.Drawing.Pen($brush, $strokeWidth)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawPath($pen, $mPath)
  $graphics.DrawPath($pen, $arrowPath)
  $graphics.FillPath($brush, $headPath)
  $pen.Dispose()
  $brush.Dispose()
  $mPath.Dispose()
  $arrowPath.Dispose()
  $headPath.Dispose()
}

function Draw-FullIcon($path, $size, [bool]$round = $true) {
  $pair = New-Bitmap $size $size $false
  $bitmap = $pair[0]
  $graphics = $pair[1]
  $radius = [single]($size * 0.215)
  $clip = New-RoundRectPath 0 0 $size $size $radius
  $graphics.SetClip($clip)
  $bgRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, [System.Drawing.Color]::FromArgb(255, 16, 25, 22), [System.Drawing.Color]::FromArgb(255, 6, 16, 11), 80)
  $graphics.FillRectangle($bg, 0, 0, $size, $size)
  $bg.Dispose()
  for ($i = 5; $i -ge 1; $i--) {
    $alpha = 9 * $i
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, 46, 204, 113))
    $diameter = $size * (0.22 + $i * 0.09)
    $graphics.FillEllipse($brush, ($size - $diameter) / 2, ($size - $diameter) * 0.47, $diameter, $diameter)
    $brush.Dispose()
  }
  $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(7, 125, 255, 92), [single]([Math]::Max(1, $size * 0.0014)))
  for ($i = 1; $i -lt 8; $i++) {
    $line = $size * $i / 8
    $graphics.DrawLine($gridPen, 0, $line, $size, $line)
    $graphics.DrawLine($gridPen, $line, 0, $line, $size)
  }
  $gridPen.Dispose()
  Draw-Mark $graphics $size ($size * 0.13) ($size * 0.105) ($size * 0.78) $true
  $graphics.ResetClip()
  $clip.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Draw-Foreground($path, $size) {
  $pair = New-Bitmap $size $size $true
  $bitmap = $pair[0]
  $graphics = $pair[1]
  Draw-Mark $graphics $size ($size * 0.12) ($size * 0.08) ($size * 0.80) $true
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Draw-Splash($path) {
  $existing = [System.Drawing.Image]::FromFile($path)
  $width = $existing.Width
  $height = $existing.Height
  $existing.Dispose()
  $pair = New-Bitmap $width $height $false
  $bitmap = $pair[0]
  $graphics = $pair[1]
  $bgRect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect, [System.Drawing.Color]::FromArgb(255, 11, 15, 14), [System.Drawing.Color]::FromArgb(255, 7, 16, 12), 90)
  $graphics.FillRectangle($bg, 0, 0, $width, $height)
  $bg.Dispose()
  $logoSize = [Math]::Min($width, $height) * 0.38
  $logoX = ($width - $logoSize) / 2
  $logoY = $height * 0.26
  Draw-Mark $graphics $width $logoX $logoY $logoSize $true
  $titleFont = New-Object System.Drawing.Font("Segoe UI", [single]($height * 0.035), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subFont = New-Object System.Drawing.Font("Segoe UI", [single]($height * 0.018), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $tagFont = New-Object System.Drawing.Font("Segoe UI", [single]($height * 0.022), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 248, 250, 247))
  $muted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(176, 248, 250, 247))
  $green = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 125, 255, 92))
  $graphics.DrawString("MEROXIO", $titleFont, $white, [single]($width / 2), [single]($logoY + $logoSize + $height * 0.025), $center)
  $graphics.DrawString("Expense Manager", $subFont, $muted, [single]($width / 2), [single]($logoY + $logoSize + $height * 0.075), $center)
  $graphics.DrawString("Manage Smarter.", $tagFont, $green, [single]($width / 2), [single]($logoY + $logoSize + $height * 0.15), $center)
  $graphics.DrawString("Live Better.", $tagFont, $white, [single]($width / 2), [single]($logoY + $logoSize + $height * 0.185), $center)
  $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 125, 255, 92), [single]([Math]::Max(3, $width * 0.006)))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = @()
  for ($i = 0; $i -le 7; $i++) {
    $px = $width * ($i / 7)
    $py = $height * (0.84 - ($i * 0.024)) + [Math]::Sin($i * 1.55) * $height * 0.022
    $points += New-Object System.Drawing.PointF([single]$px, [single]$py)
  }
  $graphics.DrawCurve($linePen, $points, 0.55)
  $linePen.Dispose()
  $center.Dispose()
  $titleFont.Dispose()
  $subFont.Dispose()
  $tagFont.Dispose()
  $white.Dispose()
  $muted.Dispose()
  $green.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$densitySizes = @{
  "mipmap-mdpi" = 48
  "mipmap-hdpi" = 72
  "mipmap-xhdpi" = 96
  "mipmap-xxhdpi" = 144
  "mipmap-xxxhdpi" = 192
}

foreach ($entry in $densitySizes.GetEnumerator()) {
  $folder = Join-Path $res $entry.Key
  Draw-FullIcon (Join-Path $folder "ic_launcher.png") $entry.Value $false
  Draw-FullIcon (Join-Path $folder "ic_launcher_round.png") $entry.Value $true
  Draw-Foreground (Join-Path $folder "ic_launcher_foreground.png") $entry.Value
}

Draw-FullIcon (Join-Path $root "public\meroxio-icon-1024.png") 1024 $true

Get-ChildItem -Path $res -Filter "splash.png" -Recurse | ForEach-Object {
  Draw-Splash $_.FullName
}

Write-Host "Generated MeroxIO splash and launcher assets."
