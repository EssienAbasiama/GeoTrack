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

# One-time import of the local seed snapshot onto the live volume.
# Backs up the current DB, swaps in the snapshot, then clears the seed markers
# so the seeders below RE-RUN — this restores the EEE classes (absent from the
# local snapshot) on top of the imported data. Guarded so it happens once.
if [ ! -f /data/.snapshot-v1 ] && [ -f /var/www/html/database/snapshot.sqlite ]; then
  echo "Importing local seed snapshot (first run)..."
  cp /data/database.sqlite /data/database.pre-snapshot.sqlite 2>/dev/null || true
  cp /var/www/html/database/snapshot.sqlite /data/database.sqlite
  chown www-data:www-data /data/database.sqlite
  rm -f /data/.seeded /data/.seeded-eee
  touch /data/.snapshot-v1
fi

# Apply migrations against the SQLite file on the volume.
su-exec www-data php artisan migrate --force

# One-time seed of the demo/reference data (university, courses, sample users).
# Guarded by a marker on the volume so it only ever runs on a fresh database.
if [ ! -f /data/.seeded ]; then
  echo "Seeding database (first run)..."
  su-exec www-data php artisan db:seed --force && su-exec www-data touch /data/.seeded
fi

# One-time addition of the Electrical & Electronics Engineering (EEE) classes.
# Separate marker so it applies once to the already-seeded database.
if [ ! -f /data/.seeded-eee ]; then
  echo "Seeding EEE classes (first run)..."
  su-exec www-data php artisan db:seed --class=ElectricalEngineeringSeeder --force && su-exec www-data touch /data/.seeded-eee
fi

# Symlink public/storage -> storage/app/public (ignore if it already exists).
su-exec www-data php artisan storage:link 2>/dev/null || true

# Hand off to supervisor as PID 1 (runs php-fpm + nginx in the foreground).
exec supervisord -c /etc/supervisord.conf
