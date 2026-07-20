#!/usr/bin/env sh
# Runs on every container start, BEFORE php-fpm/nginx accept traffic.
# Ensures the SQLite database lives on the mounted Fly volume (/data), then
# migrates and caches config/routes for production.
set -e

# The volume is mounted at /data, already owned by www-data (uid 33) by Fly.
# Just make sure the SQLite file exists. (No recursive chown: it would fail on
# the root-owned lost+found dir and crash the container.)
if [ ! -f /data/database.sqlite ]; then
  touch /data/database.sqlite
fi

cd /var/www/html

# Package manifest (skipped during composer install --no-scripts).
php artisan package:discover --ansi

# Apply migrations against the SQLite file on the volume.
php artisan migrate --force

# Symlink public/storage -> storage/app/public (ignore if it already exists).
php artisan storage:link || true

# Production caches.
php artisan config:cache
php artisan route:cache
