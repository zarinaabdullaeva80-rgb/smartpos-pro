# ===================================================
# SmartPOS - Запуск сервера и постоянного туннеля
# Постоянный URL: https://smartpos.serveousercontent.com
# ===================================================

$SERVER_DIR = "$PSScriptRoot\server"
$SERVER_PORT = 5000
$SSH_KEY = "$env:USERPROFILE\.ssh\serveo_key"

# ── 1. Освободить порт ────────────────────────────
Write-Host "[1/3] Освобождение порта $SERVER_PORT..." -ForegroundColor Cyan
$pid5000 = (Get-NetTCPConnection -LocalPort $SERVER_PORT -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
if ($pid5000) { Stop-Process -Id $pid5000 -Force -ErrorAction SilentlyContinue; Start-Sleep 1 }

# ── 2. Запустить сервер ───────────────────────────
Write-Host "[2/3] Запуск сервера Node.js..." -ForegroundColor Cyan
$serverProc = Start-Process -NoNewWindow -FilePath "node" -ArgumentList "src/index.js" `
    -WorkingDirectory $SERVER_DIR -PassThru
Start-Sleep 3

$check = Get-NetTCPConnection -LocalPort $SERVER_PORT -ErrorAction SilentlyContinue
if ($check) {
    Write-Host "  ✅ Сервер запущен (PID: $($serverProc.Id))" -ForegroundColor Green
}
else {
    Write-Host "  ❌ Сервер не запустился!" -ForegroundColor Red
}

# ── 3. Запустить туннель ──────────────────────────
Write-Host "[3/3] Запуск постоянного туннеля..." -ForegroundColor Cyan
$tunnelProc = Start-Process -NoNewWindow -FilePath "ssh" `
    -ArgumentList "-i `"$SSH_KEY`" -R smartpos:80:localhost:$SERVER_PORT serveo.net" -PassThru
Start-Sleep 4

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ СЕРВЕР И ТУННЕЛЬ ЗАПУЩЕНЫ" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 URL сервера (постоянный):" -ForegroundColor Yellow
Write-Host "     https://smartpos.serveousercontent.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🖥  Локальный: http://localhost:$SERVER_PORT/api" -ForegroundColor White
Write-Host "  PID сервера:  $($serverProc.Id)" -ForegroundColor Gray
Write-Host "  PID туннеля:  $($tunnelProc.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "Нажмите Ctrl+C для остановки." -ForegroundColor Gray

# Держать скрипт живым
Wait-Process -Id $serverProc.Id
