# ---- Stage 1: install PHP dependencies with Composer ----
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
      --no-dev \
      --no-scripts \
      --no-autoloader \
      --prefer-dist \
      --no-interaction
COPY . .
RUN composer dump-autoload --optimize --no-dev

# ---- Stage 2: runtime (php-fpm + nginx via supervisor, no s6) ----
FROM php:8.3-fpm-alpine

# System packages: nginx (web server), supervisor (process manager),
# su-exec (drop privileges to www-data for artisan commands).
RUN apk add --no-cache nginx supervisor su-exec

# PHP extensions (pdo_sqlite for the DB, plus the usual Laravel set).
COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_sqlite mbstring bcmath zip exif pcntl gd

WORKDIR /var/www/html

# App + vendor from the build stage.
COPY --from=vendor /app /var/www/html

# Container configuration.
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
