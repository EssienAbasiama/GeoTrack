# GeoTrack — Local Setup Guide

> Last updated: 2026-03-15

---

## Prerequisites

Ensure the following are installed on your machine:

| Tool     | Version | Install                   |
| -------- | ------- | ------------------------- |
| Node.js  | v18+    | https://nodejs.org        |
| npm      | v9+     | Included with Node.js     |
| Expo CLI | latest  | `npm install -g expo-cli` |
| PHP      | 8.1+    | https://php.net           |
| Composer | 2.x     | https://getcomposer.org   |
| MySQL    | 8+      | https://mysql.com         |
| Git      | latest  | https://git-scm.com       |

---

## 1. Clone the Repository

```bash
git clone https://github.com/yourusername/geotrack.git
cd geotrack
```

---

## 2. Mobile App Setup

### Navigate to the mobile folder

```bash
cd mobile
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npx expo start
```

### Run on a specific platform

```bash
npx expo start --android   # Android emulator or device
npx expo start --ios       # iOS simulator (macOS only)
npx expo start --web       # Web browser
```

> **Note:** After modifying `babel.config.js`, `metro.config.js`, or `tailwind.config.js`, restart the bundler with `--clear`:
>
> ```bash
> npx expo start --clear
> ```

---

## 3. Backend Setup

### Navigate to the backend folder

```bash
cd backend
```

### Install PHP dependencies

```bash
composer install
```

### Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your local values:

```env
APP_NAME=GeoTrack
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=geotrack
DB_USERNAME=root
DB_PASSWORD=your_password
```

### Generate application key

```bash
php artisan key:generate
```

### Create the MySQL database

```sql
CREATE DATABASE geotrack;
```

### Run migrations

```bash
php artisan migrate
```

### (Optional) Seed the database

```bash
php artisan db:seed
```

### Start the backend server

```bash
php artisan serve
```

API is available at: `http://localhost:8000/api`

---

## 4. Project Structure Reference

```
geotrack/
│
├── mobile/        # React Native mobile application (Expo)
├── backend/       # Laravel REST API
├── docs/          # Project documentation
└── README.md
```

---

## 5. Environment Variables Reference

### Mobile (`mobile/.env` or `constants/index.ts`)

| Variable  | Description                  |
| --------- | ---------------------------- |
| `API_URL` | Base URL for the Laravel API |

### Backend (`backend/.env`)

| Variable              | Description                                    |
| --------------------- | ---------------------------------------------- |
| `APP_NAME`            | Application name                               |
| `APP_URL`             | Backend server URL                             |
| `DB_DATABASE`         | MySQL database name                            |
| `DB_USERNAME`         | MySQL username                                 |
| `DB_PASSWORD`         | MySQL password                                 |
| `GOOGLE_MAPS_API_KEY` | Google Maps / Geofencing API key (when needed) |

---

## 6. Useful Commands

### Mobile

```bash
npx expo start --clear     # Start with cleared cache
npx expo doctor            # Check for setup issues
```

### Backend

```bash
php artisan route:list              # List all registered routes
php artisan make:controller Name    # Create a new controller
php artisan make:model Name -m      # Create model + migration
php artisan migrate:fresh --seed    # Reset and re-seed database
php artisan tinker                  # Interactive REPL
```
