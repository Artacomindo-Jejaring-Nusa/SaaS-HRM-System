#!/bin/sh
set -e

echo "========================================="
echo "  HRMS Narwasthu Group - Starting..."  
echo "========================================="

# Wait for MySQL to be ready
echo "[*] Waiting for MySQL Master..."
MYSQL_HOST="${DB_HOST:-mysql-master}"
MYSQL_PORT="${DB_PORT:-3306}"
MYSQL_USER="${DB_USERNAME:-hrms_user}"
MYSQL_PASS="${DB_PASSWORD}"
MYSQL_DB="${DB_DATABASE:-hrm_saas}"

max_retries=90
counter=0

# Use PHP PDO instead of mysql CLI because:
# - Alpine's mysql-client is actually MariaDB
# - MariaDB client doesn't support MySQL 8.4's caching_sha2_password plugin
# - PHP's pdo_mysql extension handles caching_sha2_password natively
until php -r "try { new PDO('mysql:host=${MYSQL_HOST};port=${MYSQL_PORT};dbname=${MYSQL_DB}', '${MYSQL_USER}', '${MYSQL_PASS}'); echo 'ok'; } catch(Exception \$e) { exit(1); }" > /dev/null 2>&1; do
    counter=$((counter + 1))
    if [ $counter -ge $max_retries ]; then
        echo "[!] MySQL connection failed after ${max_retries} attempts."
        echo "[DEBUG] Last error:"
        php -r "try { new PDO('mysql:host=${MYSQL_HOST};port=${MYSQL_PORT};dbname=${MYSQL_DB}', '${MYSQL_USER}', '${MYSQL_PASS}'); } catch(Exception \$e) { echo \$e->getMessage(); }" 2>&1 || true
        break
    fi
    echo "[*] MySQL Master is unavailable - retrying in 2s... ($counter/$max_retries)"
    sleep 2
done

if [ $counter -ge $max_retries ]; then
    echo "[!] CRITICAL: MySQL Master could not be reached. Exiting."
    exit 1
fi

# Clear any existing caches that might interfere with initialization
echo "[*] Preparing Laravel..."
# Clean stale host volume cache files before Laravel boots
rm -f /var/www/html/bootstrap/cache/*.php 2>/dev/null || true
php artisan config:clear
# cache:clear after config:clear needs explicit DB_CONNECTION since
# Laravel 11 defaults to sqlite without cached config
php artisan cache:clear 2>/dev/null || echo "[*] Cache clear skipped (first deploy or no cache table yet)"

# Run migrations
if [ "${SKIP_MIGRATIONS}" != "true" ]; then
    echo "[*] Running database migrations on Master..."
    php artisan migrate --force --no-interaction
    
    # Seeding is disabled by default to prevent data duplication on restart.
    # Run manually if needed: docker exec hrms-backend php artisan db:seed
    # echo "[*] Syncing Roles and Permissions..."
    # php artisan db:seed --force --no-interaction
else
    echo "[*] Skipping migrations (SKIP_MIGRATIONS=true)..."
fi

# Now that database is ready, we can cache configuration for production performance
echo "[*] Optimizing Laravel for production..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache

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
