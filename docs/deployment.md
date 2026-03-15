# GeoTrack — Deployment Guide

> Last updated: 2026-03-15

---

## Overview

GeoTrack has two deployable components:

| Component   | Target                 | Stack                             |
| ----------- | ---------------------- | --------------------------------- |
| Backend API | Linux VPS (Ubuntu)     | PHP 8.5, Laravel 12, Nginx, MySQL |
| Mobile App  | App Store / Play Store | Expo EAS Build                    |

---

## Backend Deployment (Linux / Ubuntu)

### 1. Server Requirements

- Ubuntu 22.04 LTS
- PHP 8.1+ with extensions: `mbstring`, `openssl`, `pdo`, `pdo_mysql`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`
- Nginx or Apache
- MySQL 8+
- Composer 2.x
- Git

---

### 2. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PHP and extensions
sudo apt install -y php8.3 php8.3-fpm php8.3-mysql php8.3-mbstring \
  php8.3-xml php8.3-bcmath php8.3-curl php8.3-zip

# Install Nginx and MySQL
sudo apt install -y nginx mysql-server

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

---

### 3. Deploy Backend

```bash
# Clone the repo
git clone https://github.com/yourusername/geotrack.git /var/www/geotrack
cd /var/www/geotrack/backend

# Install dependencies (no dev in production)
composer install --no-dev --optimize-autoloader

# Set up environment
cp .env.example .env
nano .env  # Fill in production values

# Generate key
php artisan key:generate

# Set permissions
sudo chown -R www-data:www-data /var/www/geotrack/backend
sudo chmod -R 755 /var/www/geotrack/backend/storage

# Run migrations
php artisan migrate --force

# Optimise for production
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

### 4. Nginx Configuration

Create `/etc/nginx/sites-available/geotrack`:

```nginx
server {
    listen 80;
    server_name api.geotrack.app;
    root /var/www/geotrack/backend/public;
    index index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/geotrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 5. SSL / HTTPS with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.geotrack.app
```

---

### 6. Production `.env` Key Settings

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.geotrack.app

DB_CONNECTION=mysql
DB_DATABASE=geotrack_prod
DB_USERNAME=geotrack_user
DB_PASSWORD=strong_password_here

SANCTUM_STATEFUL_DOMAINS=
SESSION_DRIVER=database
CACHE_STORE=database
```

---

## Mobile App Deployment (Expo EAS)

### 1. Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 2. Configure EAS Build

```bash
cd mobile
eas build:configure
```

This creates `eas.json`.

### 3. Update API URL for Production

In `mobile/constants/index.ts` (or `.env`):

```ts
export const API_URL = "https://api.geotrack.app/api";
```

### 4. Build for Android

```bash
eas build --platform android --profile production
```

### 5. Build for iOS

```bash
eas build --platform ios --profile production
```

### 6. Submit to Stores

```bash
eas submit --platform android
eas submit --platform ios
```

---

## Deployment Checklist

### Backend

- [ ] `APP_DEBUG=false` in `.env`
- [ ] `APP_ENV=production`
- [ ] HTTPS configured with valid SSL certificate
- [ ] `php artisan config:cache` run
- [ ] `php artisan route:cache` run
- [ ] Database migrated with `--force`
- [ ] Storage folder has correct permissions
- [ ] CORS `allowed_origins` restricted to known app domains

### Mobile

- [ ] `API_URL` points to production backend
- [ ] EAS build profile set to `production`
- [ ] App version bumped in `app.json`
- [ ] Tested on both Android and iOS before submitting
