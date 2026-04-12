#!/bin/bash
# SSL Certificate Auto-Setup with Let's Encrypt
# Requires: certbot, nginx

DOMAIN="${1:-yourdomain.com}"
EMAIL="${2:-admin@yourdomain.com}"

echo "Setting up SSL certificate for $DOMAIN"

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
systemctl stop nginx

# Obtain certificate
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

if [ $? -eq 0 ]; then
    echo "Certificate obtained successfully!"
    
    # Update .env with certificate paths
    echo ""
    echo "Add these to your .env file:"
    echo "SSL_CERT_PATH=/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    echo "SSL_KEY_PATH=/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    
    # Setup auto-renewal cron job
    echo "0 0 1 * * certbot renew --quiet" | crontab -
    echo "Auto-renewal cron job added"
    
    # Restart nginx
    systemctl start nginx
else
    echo "ERROR: Certificate generation failed!"
    exit 1
fi

echo "SSL setup completed!"
