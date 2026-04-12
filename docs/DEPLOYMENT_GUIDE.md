# 🚀 PRODUCTION DEPLOYMENT GUIDE

## Quick Start (5 minutes)

### Minimal Deployment

```bash
# 1. Start services
docker-compose up -d

# 2. Run migrations
docker-compose exec backend npm run migrate

# 3. Verify
curl http://localhost:5000/api/health

# 4. Access
open http://localhost:3000
```

**Done!** System is running.

---

## Full Production Deployment

### Pre-Flight Checklist ✅

**Environment:**
- [ ] .env configured with production values
- [ ] JWT_SECRET is strong (128+ chars)
- [ ] Database password changed from default
- [ ] SMTP credentials added
- [ ] Telegram bot token added (optional)
- [ ] CORS_ORIGIN updated with your domain
- [ ] SSL certificates obtained (Let's Encrypt)

**Infrastructure:**
- [ ] Docker installed
- [ ] docker-compose installed
- [ ] PostgreSQL accessible
- [ ] Redis accessible (optional)
- [ ] Ports 80, 443, 5000 open
- [ ] Domain DNS configured

**Code:**
- [ ] Latest code pulled
- [ ] Dependencies installed (npm install completed)
- [ ] Tests passing (npm test)
- [ ] No critical errors in logs

---

## Step-by-Step Deployment

### 1. Prepare Environment

```bash
# Clone repository
git clone <your-repo>
cd 1c-accounting

# Configure environment
cp server/.env.example server/.env
nano server/.env
# Update all production values
```

**Critical .env Variables:**
```env
JWT_SECRET=<generate-strong-64-char-secret>
DB_PASSWORD=<secure-database-password>
SMTP_USER=<your-email@gmail.com>
SMTP_PASSWORD=<app-specific-password>
CORS_ORIGIN=https://yourdomain.com
```

### 2. Setup SSL (Production Only)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certificates saved to:
# /etc/letsencrypt/live/yourdomain.com/
```

See `SSL_SETUP.md` for details.

### 3. Start Services

```bash
# Build and start all services
docker-compose up -d --build

# Check status
docker-compose ps

# Expected output:
# 1c-postgres    Up    5432/tcp
# 1c-redis       Up    6379/tcp  
# 1c-backend     Up    5000/tcp
# 1c-frontend    Up    3000/tcp
# 1c-nginx       Up    80/tcp, 443/tcp
```

### 4. Initialize Database

```bash
# Run all 25 migrations
docker-compose exec backend npm run migrate

# Expected output:
# ✓ Migration 001 applied
# ✓ Migration 002 applied
# ...
# ✓ Migration 025 applied
# All migrations completed successfully!
```

### 5. Create Admin User

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d accounting_db

# Create admin (if not exists)
INSERT INTO users (username, password, email, full_name, role_id, is_active)
VALUES (
  'admin',
  '$2b$10$...', -- Use bcrypt hashed password
  'admin@yourdomain.com',
  'System Administrator',
  1, -- admin role
  true
);
```

Or use the API after startup.

### 6. Verify Deployment

```bash
# Health check
curl http://localhost:5000/api/health

# Expected:
# {"status":"ok","uptime":123,"database":"connected"}

# Status endpoint
curl http://localhost:5000/api/status

# API documentation
open http://localhost:5000/api-docs
```

### 7. Run Tests

```bash
# Backend tests
docker-compose exec backend npm test

# Expected: 70%+ coverage, all tests pass
```

### 8. Monitor Logs

```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Check for errors
docker-compose logs backend | grep -i error
```

---

## Post-Deployment Tasks

### 1. Setup Monitoring

```bash
# Enable health checks
# Already configured in docker-compose.yml

# Monitor endpoint
watch -n 5 curl http://localhost:5000/api/health
```

### 2. Configure Backup

```bash
# Setup automated backups
chmod +x scripts/backup-database.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /path/to/scripts/backup-database.sh

# Test backup
./scripts/backup-database.sh test-backup
```

### 3. Setup Nginx (Production)

```nginx
# /etc/nginx/sites-available/1c-accounting
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### 4. Enable Auto-start

```bash
# Enable Docker services on boot
sudo systemctl enable docker

# Auto-restart containers
# Already configured in docker-compose.yml:
# restart: unless-stopped
```

---

## Rollback Procedure

If something goes wrong:

```bash
# 1. Stop services
docker-compose down

# 2. Restore from backup
docker-compose exec postgres psql -U postgres -d accounting_db < backup.sql

# 3. Rollback to previous Docker image
docker-compose down
git checkout <previous-commit>
docker-compose up -d

# 4. Verify
curl http://localhost:5000/api/health
```

---

## Maintenance Tasks

### npm Audit Fix (Scheduled Maintenance)

```bash
# When ready (low-traffic period):

# 1. Stop backend
docker-compose stop backend

# 2. Fix vulnerabilities
docker-compose exec backend npm audit fix

# 3. Test
docker-compose exec backend npm test

# 4. Restart
docker-compose start backend

# 5. Verify
curl http://localhost:5000/api/health
```

**Schedule:** Next maintenance window  
**Impact:** 2-3 minutes downtime  
**Risk:** Low

### Database Maintenance

```bash
# Vacuum database (monthly)
docker-compose exec postgres psql -U postgres -d accounting_db -c "VACUUM ANALYZE"

# Reindex (quarterly)
docker-compose exec postgres psql -U postgres -d accounting_db -c "REINDEX DATABASE accounting_db"
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check ports
ss -tlnp | grep -E '5000|5432|6379|3000'

# Restart
docker-compose down
docker-compose up -d
```

### Database Connection Errors

```bash
# Check database
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# Check credentials in .env
cat server/.env | grep DB_

# Recreate containers
docker-compose down -v
docker-compose up -d
```

### Migration Errors

```bash
# Check current version
docker-compose exec postgres psql -U postgres -d accounting_db -c "SELECT * FROM schema_migrations"

# Manually run failed migration
docker-compose exec postgres psql -U postgres -d accounting_db < database/migrations/XXX-name.sql
```

---

## Performance Tuning

### After Initial Deployment:

1. **Monitor response times**
   ```bash
   # Log slow queries
   docker-compose exec postgres psql -U postgres -c "ALTER SYSTEM SET log_min_duration_statement = 1000"
   ```

2. **Enable Redis caching**
   ```bash
   # Uncomment in docker-compose.yml
   # Set REDIS_HOST in .env
   docker-compose restart backend
   ```

3. **Database optimization**
   ```bash
   # Run performance migration
   docker-compose exec backend npm run migrate
   # Migration 024 includes performance indexes
   ```

---

## Security Checklist

- [x] JWT secret is strong and unique
- [x] Database password changed from default
- [x] CORS restricted to your domain
- [x] Rate limiting enabled
- [x] Security headers (helmet) active
- [x] Input validation on all endpoints
- [x] Audit logging enabled
- [x] 2FA available for users
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Regular backups scheduled

---

## Success Criteria

✅ **Deployment Successful If:**
- Health endpoint returns 200 OK
- Frontend loads at domain
- Can login with admin user
- API docs accessible
- Database connected
- All tests pass (70%+)
- No critical errors in logs

---

## Support

**Documentation:**
- `/api-docs` - API documentation
- `README.md` - Project overview
- `QUICKSTART.md` - Quick start guide
- `SSL_SETUP.md` - SSL configuration
- `PROJECT_AUDIT.md` - System audit

**Health Monitoring:**
- `/api/health` - System status
- `/api/status` - Detailed info
- `/api/version` - Build version

---

## Deployment Complete! 🎉

**Next Steps:**
1. ✅ Login to frontend
2. ✅ Create first product
3. ✅ Process first sale
4. ✅ Generate first report
5. ✅ Monitor system health

**System is LIVE and ready for production use!** 🚀
