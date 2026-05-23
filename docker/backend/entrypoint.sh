#!/bin/sh
set -e

echo "========================================="
echo "  HRMS Narwasthu Group - Starting..."  
echo "========================================="

# Wait for MySQL to be ready
echo "[*] Waiting for MySQL..."
max_retries=30
counter=0
until mysql -h"${DB_HOST:-mysql}" -P"${DB_PORT:-3306}" -u"${DB_USERNAME:-root}" -p"${DB_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; do
    counter=$((counter + 1))
    if [ $counter -ge $max_retries ]; then
        echo "[!] MySQL connection failed after ${max_retries} attempts. Starting anyway..."
        break
    fi
    echo "[*] MySQL is unavailable - retrying in 2s... ($counter/$max_retries)"
    sleep 2
done
echo "[✓] MySQL is ready!"

# Cache configuration for performance
echo "[*] Optimizing Laravel..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

# Run migrations
echo "[*] Running database migrations..."
php artisan migrate --force --no-interaction


# Storage link
echo "[*] Creating storage link..."
php artisan storage:link 2>/dev/null || true

# Fix permissions
echo "[*] Setting permissions..."
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

echo "========================================="
echo "  HRMS Narwasthu Group - Ready! 🚀"
echo "========================================="

# Execute CMD
exec "$@"
