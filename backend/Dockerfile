# ---- Stage 1: install PHP dependencies with Composer ----
FROM composer:2 AS vendor
WORKDIR /app

# Install deps first (better layer caching), then copy the app and finalize autoload.
COPY composer.json composer.lock ./
RUN composer install \
      --no-dev \
      --no-scripts \
      --no-autoloader \
      --prefer-dist \
      --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev

# ---- Stage 2: runtime (nginx + php-fpm, serves /public on port 8080) ----
FROM serversideup/php:8.3-fpm-nginx

# pdo_sqlite is required for the SQLite database.
USER root
RUN install-php-extensions pdo_sqlite

WORKDIR /var/www/html

# Copy the application together with the vendor/ built in stage 1.
COPY --chown=www-data:www-data --from=vendor /app /var/www/html

# Boot-time init script (creates the SQLite file on the volume, runs migrations).
COPY --chown=www-data:www-data docker/entrypoint.d/50-laravel-init.sh /etc/entrypoint.d/50-laravel-init.sh
RUN chmod +x /etc/entrypoint.d/50-laravel-init.sh

# Drop back to the unprivileged user the base image runs as.
USER www-data
