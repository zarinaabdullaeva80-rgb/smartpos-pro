# PostgreSQL Replication Setup

## Архитектура

```
┌─────────────┐           ┌─────────────┐
│   Primary   │──────────▶│   Replica   │
│  (Master)   │ WAL logs  │  (Standby)  │
│  Read/Write │           │  Read-only  │
└─────────────┘           └─────────────┘
```

## Настройка Primary (Master)

### 1. Редактировать postgresql.conf

```conf
# Replication
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
```

### 2. Редактировать pg_hba.conf

```conf
# Разрешить репликацию
host  replication  replicator  192.168.1.0/24  md5
```

### 3. Создать пользователя для репликации

```sql
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'repl_password';
```

### 4. Перезапустить PostgreSQL

```bash
sudo systemctl restart postgresql
```

## Настройка Replica (Standby)

### 1. Остановить PostgreSQL на replica

```bash
sudo systemctl stop postgresql
```

### 2. Очистить data directory

```bash
sudo rm -rf /var/lib/postgresql/14/main/*
```

### 3. Создать базовый backup с primary

```bash
sudo -u postgres pg_basebackup \
  -h 192.168.1.100 \
  -D /var/lib/postgresql/14/main \
  -U replicator \
  -P \
  -v \
  -R \
  -X stream \
  -C -S replica_slot
```

### 4. Настроить postgresql.auto.conf

Файл создается автоматически с опцией `-R`, но можно проверить:

```conf
primary_conninfo = 'host=192.168.1.100 port=5432 user=replicator password=repl_password'
primary_slot_name = 'replica_slot'
```

### 5. Запустить PostgreSQL на replica

```bash
sudo systemctl start postgresql
```

## Проверка репликации

### На Primary

```sql
-- Просмотр активных репликаций
SELECT 
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    sync_state
FROM pg_stat_replication;

-- Просмотр слотов репликации
SELECT * FROM pg_replication_slots;
```

### На Replica

```sql
-- Проверка статуса
SELECT pg_is_in_recovery();  -- Должно быть true

-- Просмотр задержки репликации
SELECT 
    now() - pg_last_xact_replay_timestamp() AS replication_delay;
```

## Мониторинг репликации

```sql
-- Задержка в байтах
SELECT 
    client_addr,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes
FROM pg_stat_replication;

-- Задержка во времени
SELECT 
    EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::INT AS lag_seconds;
```

## Failover (переключение на replica)

### Автоматический failover

```bash
# На replica
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/14/main
```

### Или создать trigger файл

```bash
touch /var/lib/postgresql/14/main/promote.trigger
```

## Load Balancer для чтения

### pgpool-II конфигурация

```conf
backend_hostname0 = '192.168.1.100'  # Primary
backend_port0 = 5432
backend_weight0 = 1
backend_flag0 = 'ALLOW_TO_FAILOVER'

backend_hostname1 = '192.168.1.101'  # Replica
backend_port1 = 5432
backend_weight1 = 1
backend_flag1 = 'ALLOW_TO_FAILOVER'

load_balance_mode = on
master_slave_mode = on
```

## Docker Compose с репликацией

```yaml
services:
  postgres-primary:
    image: postgres:14
    environment:
      POSTGRES_DB: accounting_1c
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: repl_password
    command: |
      postgres
      -c wal_level=replica
      -c max_wal_senders=10
      -c max_replication_slots=10
    volumes:
      - primary_data:/var/lib/postgresql/data

  postgres-replica:
    image: postgres:14
    environment:
      POSTGRES_DB: accounting_1c
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      PGUSER: replicator
      PGPASSWORD: repl_password
    command: |
      bash -c "
      until pg_basebackup -h postgres-primary -D /var/lib/postgresql/data -U replicator -v -P -W; do
        sleep 1
      done
      echo 'primary_conninfo = ''host=postgres-primary port=5432 user=replicator password=repl_password''' >> /var/lib/postgresql/data/postgresql.auto.conf
      postgres
      "
    volumes:
      - replica_data:/var/lib/postgresql/data
    depends_on:
      - postgres-primary
```

## Backup стратегия

```bash
# Ежедневный backup с primary
0 2 * * * pg_dump -U postgres accounting_1c | gzip > /backup/accounting_1c_$(date +\%Y\%m\%d).sql.gz

# WAL архивация
archive_command = 'rsync -a %p backup-server:/wal_archive/%f'
```

## Troubleshooting

### Replica отстает
```sql
-- Проверить задержку
SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) FROM pg_stat_replication;

-- Увеличить wal_sender_timeout
ALTER SYSTEM SET wal_sender_timeout = '60s';
```

### Replica не подключается
```bash
# Проверить pg_hba.conf на primary
# Проверить firewall
sudo ufw allow from 192.168.1.101 to any port 5432
```
