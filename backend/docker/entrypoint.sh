#!/bin/sh
# Container startup: prepare the SQLite DB on the Fly volume, migrate, then
# hand off to supervisor (php-fpm + nginx). Runs as root, so it can fix volume
# ownership; artisan commands are dropped to www-data via su-exec.
set -e

# /data is the mounted Fly volume. Ensure the SQLite file exists and the whole
# volume is owned by www-data (running as root here, so lost+found is no issue).
mkdir -p /data
if [ ! -f /data/database.sqlite ]; then
  touch /data/database.sqlite
fi
chown -R www-data:www-data /data 2>/dev/null || true

cd /var/www/html

# Apply migrations against the SQLite file on the volume.
su-exec www-data php artisan migrate --force

# One-time seed of the demo/reference data (university, courses, sample users).
# Guarded by a marker on the volume so it only ever runs on a fresh database.
if [ ! -f /data/.seeded ]; then
  echo "Seeding database (first run)..."
  su-exec www-data php artisan db:seed --force && su-exec www-data touch /data/.seeded
fi

# Symlink public/storage -> storage/app/public (ignore if it already exists).
su-exec www-data php artisan storage:link 2>/dev/null || true

# Hand off to supervisor as PID 1 (runs php-fpm + nginx in the foreground).
exec supervisord -c /etc/supervisord.conf
