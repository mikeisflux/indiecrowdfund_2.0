#!/bin/bash

# IndieCrowdfund - Nginx Setup Script
# Run this script as root or with sudo

set -e

echo "=== IndieCrowdfund Nginx Setup ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script with sudo"
    exit 1
fi

# Remove default nginx site
echo "Removing default nginx site..."
rm -f /etc/nginx/sites-enabled/default

# Copy nginx config
echo "Copying nginx configuration..."
cp nginx.conf /etc/nginx/sites-available/indiecrowdfund

# Create symlink
echo "Creating symlink..."
ln -sf /etc/nginx/sites-available/indiecrowdfund /etc/nginx/sites-enabled/indiecrowdfund

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx

echo ""
echo "=== Nginx configured successfully! ==="
echo ""
echo "Next steps:"
echo "1. Make sure your app is running: pm2 list"
echo "2. Install SSL certificate: sudo certbot --nginx -d indiecrowdfund.com -d www.indiecrowdfund.com"
echo ""
