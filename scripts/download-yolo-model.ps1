# Download YOLO Model for Edge Agent (PowerShell)
# This script downloads the YOLOv8n model for use with the edge agent

$MODEL_DIR = ".\apps\edge-agent\models"
$MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx"
$MODEL_FILE = "$MODEL_DIR\yolov8n.onnx"

Write-Host "📥 Downloading YOLOv8n model for edge agent..." -ForegroundColor Cyan

# Create models directory if it doesn't exist
if (-not (Test-Path $MODEL_DIR)) {
    New-Item -ItemType Directory -Path $MODEL_DIR -Force | Out-Null
}

# Check if model already exists
if (Test-Path $MODEL_FILE) {
    Write-Host "✅ Model already exists at $MODEL_FILE" -ForegroundColor Green
    $response = Read-Host "Do you want to download again? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Skipping download." -ForegroundColor Yellow
        exit 0
    }
}

# Download model
Write-Host "Downloading from $MODEL_URL..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $MODEL_URL -OutFile $MODEL_FILE -UseBasicParsing
    Write-Host "✅ Model downloaded successfully to $MODEL_FILE" -ForegroundColor Green
    
    $fileSize = (Get-Item $MODEL_FILE).Length / 1MB
    Write-Host "   Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to download model: $_" -ForegroundColor Red
    Write-Host "Please download manually from:" -ForegroundColor Yellow
    Write-Host "   URL: $MODEL_URL" -ForegroundColor Cyan
    Write-Host "   Save to: $MODEL_FILE" -ForegroundColor Cyan
    exit 1
}
