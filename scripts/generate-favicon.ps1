Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$leafPath = Join-Path $root 'public\icons\maple-leaf.png'
$public = Join-Path $root 'public'

function Get-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-LogoPng([int]$size, [string]$outPath) {
  $leaf = [System.Drawing.Bitmap]::FromFile($leafPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.Clear([System.Drawing.Color]::Transparent)

      $radius = [Math]::Max(1, [int][Math]::Round($size * 6 / 32.0))
      $path = Get-RoundedRectPath 0 0 $size $size $radius
      $red = [System.Drawing.Color]::FromArgb(255, 216, 6, 33)
      $brush = New-Object System.Drawing.SolidBrush $red
      $g.FillPath($brush, $path)
      $brush.Dispose()
      $path.Dispose()

      $lx = [int][Math]::Round($size * 6 / 32.0)
      $ly = [int][Math]::Round($size * 5 / 32.0)
      $lw = [int][Math]::Round($size * 20 / 32.0)
      $lh = [int][Math]::Round($size * 22 / 32.0)
      $dest = New-Object System.Drawing.Rectangle $lx, $ly, $lw, $lh

      $cm = New-Object System.Drawing.Imaging.ColorMatrix
      $cm.Matrix00 = 0; $cm.Matrix01 = 0; $cm.Matrix02 = 0; $cm.Matrix03 = 0; $cm.Matrix04 = 0
      $cm.Matrix10 = 0; $cm.Matrix11 = 0; $cm.Matrix12 = 0; $cm.Matrix13 = 0; $cm.Matrix14 = 0
      $cm.Matrix20 = 0; $cm.Matrix21 = 0; $cm.Matrix22 = 0; $cm.Matrix23 = 0; $cm.Matrix24 = 0
      $cm.Matrix30 = 0; $cm.Matrix31 = 0; $cm.Matrix32 = 0; $cm.Matrix33 = 1; $cm.Matrix34 = 0
      $cm.Matrix40 = 1; $cm.Matrix41 = 1; $cm.Matrix42 = 1; $cm.Matrix43 = 0; $cm.Matrix44 = 1
      $ia = New-Object System.Drawing.Imaging.ImageAttributes
      $ia.SetColorMatrix($cm)
      $g.DrawImage($leaf, $dest, 0, 0, $leaf.Width, $leaf.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)
      $ia.Dispose()
    } finally {
      $g.Dispose()
    }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally {
    $leaf.Dispose()
  }
}

New-LogoPng 32 (Join-Path $public 'favicon-32.png')
New-LogoPng 180 (Join-Path $public 'apple-touch-icon.png')
Write-Output 'pngs ok'
