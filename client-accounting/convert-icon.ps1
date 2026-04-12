# Convert PNG to ICO using .NET
Add-Type -AssemblyName System.Drawing

$pngPath = ".\build\icon.png"
$icoPath = ".\build\icon.ico"

# Load the PNG image
$image = [System.Drawing.Image]::FromFile((Resolve-Path $pngPath))

# Create icon sizes: 16, 32, 48, 64, 128, 256
$sizes = @(16, 32, 48, 64, 128, 256)

# Create a memory stream for the ICO file
$memoryStream = New-Object System.IO.MemoryStream

# ICO file header
$iconDir = [byte[]]@(0, 0, 1, 0) # Reserved, Type
$iconDir += [BitConverter]::GetBytes([uint16]$sizes.Count) # Number of images

$imageOffset = 6 + ($sizes.Count * 16) # Header + directory entries

$imageData = @()

foreach ($size in $sizes) {
    # Resize image
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($image, 0, 0, $size, $size)
    $graphics.Dispose()
    
    # Save to memory stream
    $ms = New-Object System.IO.MemoryStream
    $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $imageBytes = $ms.ToArray()
    $ms.Dispose()
    $bitmap.Dispose()
    
    # Create directory entry
    $entry = [byte[]]@($size, $size, 0, 0) # Width, Height, Colors, Reserved
    $entry += [byte[]]@(1, 0) # Color planes
    $entry += [byte[]]@(32, 0) # Bits per pixel
    $entry += [BitConverter]::GetBytes([uint32]$imageBytes.Length) # Size
    $entry += [BitConverter]::GetBytes([uint32]$imageOffset) # Offset
    
    $iconDir += $entry
    $imageData += , $imageBytes
    $imageOffset += $imageBytes.Length
}

# Write ICO file
[System.IO.File]::WriteAllBytes($icoPath, $iconDir)
$fs = [System.IO.File]::OpenWrite($icoPath)
$fs.Seek(0, [System.IO.SeekOrigin]::End) | Out-Null
foreach ($data in $imageData) {
    $fs.Write($data, 0, $data.Length)
}
$fs.Close()

$image.Dispose()

Write-Host "Icon created successfully at: $icoPath"
