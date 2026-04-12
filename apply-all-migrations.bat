@echo off
chcp 65001 > nul
echo ================================================
echo Применение всех миграций БД ...
echo ================================================
echo.

set PGPASSWORD=Smash2206
set PSQL="C:\Program Files\PostgreSQL\18\bin\psql.exe"

echo Применение миграции 001...
%PSQL% -U postgres -d accounting_db -f "database\migrations\001-configurations.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 001 && pause && exit /b 1 )

echo Применение миграции 002...
%PSQL% -U postgres -d accounting_db -f "database\migrations\002-universal-configuration.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 002 && pause && exit /b 1 )

echo Применение миграции 003...
%PSQL% -U postgres -d accounting_db -f "database\migrations\003-all-1c-configurations.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 003 && pause && exit /b 1 )

echo Применение миграции 004...
%PSQL% -U postgres -d accounting_db -f "database\migrations\004-add-product-categories.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 004 && pause && exit /b 1 )

echo Применение миграции 005...
%PSQL% -U postgres -d accounting_db -f "database\migrations\005-add-category-to-products.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 005 && pause && exit /b 1 )

echo Применение миграции 006...
%PSQL% -U postgres -d accounting_db -f "database\migrations\006-payment-methods-and-returns.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 006 && pause && exit /b 1 )

echo Применение миграции 007...
%PSQL% -U postgres -d accounting_db -f "database\migrations\007-rbac-system.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 007 && pause && exit /b 1 )

echo Применение миграции 008...
%PSQL% -U postgres -d accounting_db -f "database\migrations\008-audit-log.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 008 && pause && exit /b 1 )

echo Применение миграции 009...
%PSQL% -U postgres -d accounting_db -f "database\migrations\009-wms-inventory.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 009 && pause && exit /b 1 )

echo Применение миграции 010...
%PSQL% -U postgres -d accounting_db -f "database\migrations\010-wms-batches.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 010 && pause && exit /b 1 )

echo Применение миграции 011...
%PSQL% -U postgres -d accounting_db -f "database\migrations\011-wms-locations.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 011 && pause && exit /b 1 )

echo Применение миграции 012...
%PSQL% -U postgres -d accounting_db -f "database\migrations\012-wms-permissions.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 012 && pause && exit /b 1 )

echo Применение миграции 013...
%PSQL% -U postgres -d accounting_db -f "database\migrations\013-optimization-indexes.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 013 && pause && exit /b 1 )

echo Применение миграции 014...
%PSQL% -U postgres -d accounting_db -f "database\migrations\014-crm-deals.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 014 && pause && exit /b 1 )

echo Применение миграции 015...
%PSQL% -U postgres -d accounting_db -f "database\migrations\015-crm-loyalty.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 015 && pause && exit /b 1 )

echo Применение миграции 016...
%PSQL% -U postgres -d accounting_db -f "database\migrations\016-crm-rfm.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 016 && pause && exit /b 1 )

echo Применение миграции 017...
%PSQL% -U postgres -d accounting_db -f "database\migrations\017-crm-email.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 017 && pause && exit /b 1 )

echo Применение миграции 018...
%PSQL% -U postgres -d accounting_db -f "database\migrations\018-automation-tasks.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 018 && pause && exit /b 1 )

echo Применение миграции 019...
%PSQL% -U postgres -d accounting_db -f "database\migrations\019-notifications.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 019 && pause && exit /b 1 )

echo Применение миграции 020...
%PSQL% -U postgres -d accounting_db -f "database\migrations\020-performance-optimization.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 020 && pause && exit /b 1 )

echo Применение миграции 021...
%PSQL% -U postgres -d accounting_db -f "database\migrations\021-documents.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 021 && pause && exit /b 1 )

echo Применение миграции 022...
%PSQL% -U postgres -d accounting_db -f "database\migrations\022-1c-integration.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 022 && pause && exit /b 1 )

echo Применение миграции 023...
%PSQL% -U postgres -d accounting_db -f "database\migrations\023-two-factor-auth.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 023 && pause && exit /b 1 )

echo Применение миграции 024...
%PSQL% -U postgres -d accounting_db -f "database\migrations\024-performance-optimizations.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 024 && pause && exit /b 1 )

echo Применение миграции 025...
%PSQL% -U postgres -d accounting_db -f "database\migrations\025-additional-templates.sql" -w
if %ERRORLEVEL% NEQ 0 ( echo ❌ Ошибка в 025 && pause && exit /b 1 )

echo.
echo ================================================
echo ✅ Все 25 миграций успешно применены!
echo ================================================
echo.
pause
