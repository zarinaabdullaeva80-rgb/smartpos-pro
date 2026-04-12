# ngrok Remote Access Setup Script
# This script automates the ngrok tunnel setup for 1C Accounting System

param(
    [Parameter(Mandatory=$false)]
    [string]$AuthToken,
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 5000
)

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  ngrok Setup для 1С Бухгалтерия" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed
try {
    $ngrokVersion = ngrok version 2>&1
    Write-Host "✓ ngrok установлен: $ngrokVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ ngrok не найден!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Установите ngrok:" -ForegroundColor Yellow
    Write-Host "  1. Скачайте с https://ngrok.com/download" -ForegroundColor Yellow
    Write-Host "  2. Распакуйте и добавьте в PATH" -ForegroundColor Yellow
    Write-Host "  3. Или используйте: choco install ngrok" -ForegroundColor Yellow
    exit 1
}

# Set authtoken if provided
if ($AuthToken) {
    Write-Host "Настройка authtoken..." -ForegroundColor Yellow
    $result = ngrok config add-authtoken $AuthToken 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Authtoken настроен успешно" -ForegroundColor Green
    } else {
        Write-Host "✗ Ошибка при настройке authtoken: $result" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠ Authtoken не указан. Убедитесь, что он уже настроен." -ForegroundColor Yellow
    Write-Host "  Для настройки: ngrok config add-authtoken ВАШ_ТОКЕН" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Запуск ngrok туннеля на порту $Port..." -ForegroundColor Yellow
Write-Host ""
Write-Host "ВАЖНО: Скопируйте URL из строки 'Forwarding' и настройте клиент!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Для настройки клиента:" -ForegroundColor White
Write-Host "  1. Создайте файл client-accounting\.env.local" -ForegroundColor Gray
Write-Host "  2. Добавьте: VITE_API_URL=https://ваш-ngrok-url/api" -ForegroundColor Gray
Write-Host "  3. Перезапустите клиент: npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Не забудьте добавить ngrok URL в server\.env CORS_ORIGIN!" -ForegroundColor Yellow
Write-Host ""

# Start ngrok tunnel
ngrok http $Port
