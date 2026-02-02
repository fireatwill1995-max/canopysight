# Download a train station demo video for simulation mode.
# The video should show: train station with people walking past and trains going past on a busy day outdoors.
#
# Option 1: Download from a direct MP4 URL (e.g. from Pexels after clicking Free download)
#   .\scripts\download-demo-train-video.ps1 -Url "https://..."
#
# Option 2: Manual – download from Pexels (search "train station people" or "train platform"),
#   save as apps/web/public/demo-train-station.mp4

param(
    [string]$Url = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$publicDir = Join-Path $root "apps\web\public"
$outFile = Join-Path $publicDir "demo-train-station.mp4"

if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir -Force
}

if ($Url) {
    Write-Host "Downloading demo train station video to $outFile ..."
    try {
        Invoke-WebRequest -Uri $Url -OutFile $outFile -UseBasicParsing
        Write-Host "Done. Simulation will use: $outFile"
    } catch {
        Write-Host "Download failed: $_"
        Write-Host "Download manually from Pexels (train station people) and save as: $outFile"
        exit 1
    }
} else {
    Write-Host "No URL provided. To get a train station video (people & trains):"
    Write-Host "  1. Go to https://www.pexels.com/search/videos/train%20station%20people/"
    Write-Host "  2. Pick a clip, click Free download, choose HD MP4"
    Write-Host "  3. Save the file as: $outFile"
    Write-Host ""
    Write-Host "Or run with a direct MP4 URL: .\scripts\download-demo-train-video.ps1 -Url `"https://...`""
}
