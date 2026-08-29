Add-Type -AssemblyName System.Drawing
$logoPath = "C:\Users\HUAWEI\.gemini\antigravity\brain\15e3a543-79a2-4fcf-a269-e68622c39ead\app_logo.jpg"
$resDir = "d:\Snoopy\WEB APP\Habit-Tracker\android\app\src\main\res"

if (Test-Path $logoPath) {
    $img = [System.Drawing.Image]::FromFile($logoPath)

    $densities = @{
        "mipmap-mdpi" = 48
        "mipmap-hdpi" = 72
        "mipmap-xhdpi" = 96
        "mipmap-xxhdpi" = 144
        "mipmap-xxxhdpi" = 192
    }

    foreach ($folder in $densities.Keys) {
        $size = $densities[$folder]
        $targetDir = Join-Path $resDir $folder
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir | Out-Null
        }
        
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $size, $size)
        $g.Dispose()
        
        $bmp.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Save((Join-Path $targetDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Save((Join-Path $targetDir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
    }
    $img.Dispose()
    Write-Host "App Icons generated successfully!"
}
