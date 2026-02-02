# Ngrok Startup Script
# This script starts ngrok tunnels for the Canopy Sight app

Write-Host "Starting ngrok tunnels..."

# Stop any existing ngrok processes
Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Start web tunnel (port 3000)
Write-Host "Starting web tunnel on port 3000..."
Start-Process ngrok -ArgumentList "http","3000" -WindowStyle Minimized

Start-Sleep -Seconds 6

# Get web URL
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing
    $tunnels = $response.Content | ConvertFrom-Json | Select-Object -ExpandProperty tunnels
    $webUrl = ($tunnels | Where-Object { $_.config.addr -eq 'http://localhost:3000' } | Select-Object -First 1).public_url
    
    Write-Host ""
    Write-Host "========================================"
    Write-Host "NGROK TUNNEL ACTIVE"
    Write-Host "========================================"
    Write-Host "Web URL: $webUrl"
    Write-Host "API Proxy: $webUrl/api-proxy/trpc"
    Write-Host "WebSocket: wss://$($webUrl -replace 'https://','')/socket.io"
    Write-Host ""
    Write-Host "View dashboard: http://localhost:4040"
    Write-Host "========================================"
    Write-Host ""
    
    $webUrl | Out-File -FilePath "ngrok-web-url.txt" -Encoding utf8
} catch {
    Write-Host "Error: Could not get tunnel URL. Check http://localhost:4040"
}
