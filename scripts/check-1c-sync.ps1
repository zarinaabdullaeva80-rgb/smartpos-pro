# ═══════════════════════════════════════
# Диагностика синхронизации с 1С
# ═══════════════════════════════════════

$API_URL = "http://localhost:5000/api"
$token = $null

# Авторизация
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Диагностика синхронизации с 1С" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
    $token = $loginResponse.token
    Write-Host "✅ Авторизация успешна`n" -ForegroundColor Green
}
catch {
    Write-Host "❌ Ошибка авторизации: $_" -ForegroundColor Red
    exit 1
}

$headers = @{"Authorization" = "Bearer $token" }

# 1. Проверка категорий
Write-Host "📁 Проверка категорий..." -ForegroundColor Yellow
try {
    $categories = Invoke-RestMethod -Uri "$API_URL/categories" -Headers $headers
    $topLevel = $categories | Where-Object { -not $_.parent_id }
    $subs = $categories | Where-Object { $_.parent_id }
    
    Write-Host "   Всего категорий: $($categories.Count)"
    Write-Host "   Верхнего уровня: $($topLevel.Count)"
    Write-Host "   Подкатегорий: $($subs.Count)`n"
    
    if ($categories.Count -eq 0) {
        Write-Host "   ⚠️  ПРОБЛЕМА: Категории отсутствуют!`n" -ForegroundColor Red
    }
}
catch {
    Write-Host "   ❌ Ошибка: $_`n" -ForegroundColor Red
}

# 2. Проверка товаров
Write-Host "📦 Проверка товаров..." -ForegroundColor Yellow
try {
    $productsResponse = Invoke-RestMethod -Uri "$API_URL/products" -Headers $headers
    $products = $productsResponse.products
    $total = $productsResponse.total
    
    $withCategory = ($products | Where-Object { $_.category_id }).Count
    $active = ($products | Where-Object { $_.is_active }).Count
    
    Write-Host "   Всего товаров: $total"
    Write-Host "   С категориями: $withCategory"
    Write-Host "   Активных: $active`n"
    
    if ($total -eq 0) {
        Write-Host "   ⚠️  ПРОБЛЕМА: Товары отсутствуют!`n" -ForegroundColor Red
    }
}
catch {
    Write-Host "   ❌ Ошибка: $_`n" -ForegroundColor Red
}

# 3. Проверка продаж
Write-Host "💰 Проверка продаж..." -ForegroundColor Yellow
try {
    $salesResponse = Invoke-RestMethod -Uri "$API_URL/sales" -Headers $headers
    $sales = $salesResponse.sales
    $total = $salesResponse.total
    
    $confirmed = ($sales | Where-Object { $_.status -eq 'confirmed' }).Count
    $pending = ($sales | Where-Object { $_.status -eq 'pending' }).Count
    
    Write-Host "   Всего продаж: $total"
    Write-Host "   Подтверждённых: $confirmed"
    Write-Host "   Ожидающих: $pending`n"
    
    if ($confirmed -eq 0) {
        Write-Host "   ⚠️  ПРОБЛЕМА: Нет подтверждённых продаж для экспорта в 1С!`n" -ForegroundColor Red
    }
}
catch {
    Write-Host "   ❌ Ошибка: $_`n" -ForegroundColor Red
}

# 4. Проверка маппинга external_id
Write-Host "🔗 Проверка external_id_mapping..." -ForegroundColor Yellow
try {
    $exportResponse = Invoke-RestMethod -Uri "$API_URL/sync1c/export/products?limit=100" -Headers $headers
    $exportProducts = $exportResponse.data
    
    $mapped = ($exportProducts | Where-Object { $_.external_id_1c }).Count
    $unmapped = ($exportProducts | Where-Object { -not $_.external_id_1c }).Count
    
    Write-Host "   Товаров проверено: $($exportProducts.Count)"
    Write-Host "   С external_id_1c: $mapped"
    Write-Host "   Без external_id_1c: $unmapped`n"
    
    if ($unmapped -gt 0) {
        Write-Host "   ⚠️  ПРОБЛЕМА: $unmapped товаров без маппинга для 1С!`n" -ForegroundColor Red
    }
}
catch {
    Write-Host "   ❌ Ошибка: $_`n" -ForegroundColor Red
}

# 5. Проверка логов синхронизации
Write-Host "📜 Проверка логов синхронизации..." -ForegroundColor Yellow
try {
    $logs = Invoke-RestMethod -Uri "$API_URL/sync1c/log?limit=10" -Headers $headers
    
    Write-Host "   Всего записей в логе: $($logs.Count)`n"
    
    if ($logs.Count -eq 0) {
        Write-Host "   ⚠️  ПРОБЛЕМА: Логи синхронизации пусты! Синхронизация не выполнялась.`n" -ForegroundColor Red
    }
    else {
        Write-Host "   Последние синхронизации:"
        $logs | Select-Object -First 5 | ForEach-Object {
            Write-Host "     - $($_.sync_type) ($($_.direction)): $($_.status)"
        }
        Write-Host ""
    }
}
catch {
    Write-Host "   ❌ Ошибка: $_`n" -ForegroundColor Red
}

# 6. Проверка настроек 1С
Write-Host "⚙️  Проверка настроек 1С..." -ForegroundColor Yellow
try {
    $settings = Invoke-RestMethod -Uri "$API_URL/settings/1c/config" -Headers $headers
    
    if ($settings) {
        Write-Host "   Настройки 1С: Найдены"
        if ($settings.setting_value) {
            $config = $settings.setting_value | ConvertFrom-Json
            Write-Host "   URL: $($config.url)"
            Write-Host "   Логин: $($config.username)"
            Write-Host "   Включено: $($config.enabled)`n"
        }
    }
}
catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "   ⚠️  ПРОБЛЕМА: Настройки 1С не найдены!`n" -ForegroundColor Red
    }
    else {
        Write-Host "   ❌ Ошибка: $_`n" -ForegroundColor Red
    }
}

# Итоговый отчёт
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   Итоговый отчёт" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Для полноценной синхронизации с 1С необходимо:" -ForegroundColor White
Write-Host "1. Создать таблицу external_id_mapping в БД" -ForegroundColor Yellow
Write-Host "2. Настроить параметры подключения к 1С" -ForegroundColor Yellow
Write-Host "3. Выполнить первичную синхронизацию товаров" -ForegroundColor Yellow
Write-Host "4. Настроить автоматическую синхронизацию продаж`n" -ForegroundColor Yellow
