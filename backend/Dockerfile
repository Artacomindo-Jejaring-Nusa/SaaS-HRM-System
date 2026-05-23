# ============================================
# HRMS Narwasthu Group - Backend (Laravel 13)
# Multi-stage, Production-Ready Dockerfile
# ============================================

# ── Stage 1: Composer Dependencies ──────────────────────────
FROM composer:2.8 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist \
    --optimize-autoloader \
    --ignore-platform-reqs

# ── Stage 2: Production Image ──────────────────────────────
FROM php:8.3-fpm-alpine AS production

LABEL maintainer="Ahmad Rizki <ahmadrizki@narwastuarthatama.com>"
LABEL description="HRMS Narwasthu Group - Laravel Backend API"

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    ca-certificates \
    wget \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    zip \
    unzip \
    icu-dev \
    oniguruma-dev \
    libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo_mysql \
    mysqli \
    gd \
    zip \
    intl \
    mbstring \
    xml \
    bcmath \
    opcache \
    pcntl \
    && rm -rf /var/cache/apk/*

# Add CloudFlare Origin CA to trust store (required for mail.jelantik.com)
RUN wget -qO /usr/local/share/ca-certificates/cloudflare-origin.crt \
    https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem \
    && update-ca-certificates

# Install Redis extension
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

# Configure PHP for production
COPY docker/php.ini /usr/local/etc/php/conf.d/99-hrms.ini
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-hrms.conf
COPY docker/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Configure Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/http.d/default.conf

# Configure Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set working directory
WORKDIR /var/www/html

# Copy vendor from builder
COPY --from=vendor /app/vendor ./vendor

# Copy application code
COPY . .

# Remove dev/unnecessary files
RUN rm -rf \
    tests \
    .env.example \
    .editorconfig \
    .gitattributes \
    .gitignore \
    phpunit.xml \
    docker \
    storage/logs/*.log \
    bootstrap/cache/*.php

# Create required directories and set permissions
RUN mkdir -p \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views \
    storage/logs \
    bootstrap/cache \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 775 storage bootstrap/cache

# Create storage symlink
RUN php artisan storage:link 2>/dev/null || true

# Expose port 80 (Nginx) and 9000 (PHP-FPM)
EXPOSE 80 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://127.0.0.1/api/health || exit 1

# Entrypoint
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
