# SSL Certificate Setup Guide

## Quick Setup with Let's Encrypt (Free)

### 1. Install Certbot

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

**CentOS/RHEL:**
```bash
sudo yum install certbot python3-certbot-nginx
```

**Windows:**
Download from: https://dl.eff.org/certbot-beta-installer-win32.exe

### 2. Generate Certificates

**Automatic (Recommended):**
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Manual:**
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

### 3. Certificate Locations

Certificates will be saved to:
```
/etc/letsencrypt/live/yourdomain.com/
├── cert.pem        # Certificate
├── chain.pem       # Chain
├── fullchain.pem   # Full chain (use this)
└── privkey.pem     # Private key (use this)
```

### 4. Update .env

```env
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/1c-accounting`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin Panel
    location /admin {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /static {
        alias /var/www/1c-accounting/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/1c-accounting /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Auto-Renewal

Certbot auto-renewal is enabled by default. Test it:

```bash
sudo certbot renew --dry-run
```

### 8. Docker SSL Setup

If using Docker, mount certificates:

```yaml
# docker-compose.yml
services:
  nginx:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

## Self-Signed Certificates (Development Only)

**Generate:**
```bash
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout key.pem -out cert.pem -days 365 \
  -subj "/CN=localhost"
```

**Use:**
```env
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem
```

⚠️ **Warning:** Self-signed certificates are for development only!

## Troubleshooting

### Certificate Verification Failed
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
```

### Firewall Issues
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Permission Errors
```bash
sudo chmod 644 /etc/letsencrypt/live/yourdomain.com/fullchain.pem
sudo chmod 600 /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

## Production Checklist

- [ ] Domain DNS configured (A record)
- [ ] Ports 80 and 443 open
- [ ] Certbot installed
- [ ] Certificates generated
- [ ] Nginx configured
- [ ] Auto-renewal tested
- [ ] HTTPS redirect working
- [ ] Security headers added
- [ ] SSL Labs test passed (https://www.ssllabs.com/ssltest/)

## Test Your SSL

After setup, test at:
- https://www.ssllabs.com/ssltest/
- https://securityheaders.com/

**Target:** A+ rating on both!
