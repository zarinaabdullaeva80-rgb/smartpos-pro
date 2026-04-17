@echo off
set PGPASSWORD=Smash2206
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d accounting_db -f "database\migrations\060-isolate-child-tables-and-logs.sql" -w
