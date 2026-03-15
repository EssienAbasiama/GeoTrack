# GeoTrack — Troubleshooting Guide

> Last updated: 2026-03-15

---

## Mobile App

---

### Metro bundler fails to start

**Symptom:** `Error: Cannot find module '...'` or bundler crashes on start.

**Fix:**

```bash
cd mobile
rm -rf node_modules
npm install
npx expo start --clear
```

---

### NativeWind `className` has no effect

**Symptom:** Components render but Tailwind styles are not applied.

**Possible causes & fixes:**

1. `global.css` is not imported in `index.ts`:

   ```ts
   import "./global.css"; // must be at the top of index.ts
   ```

2. Metro config is not using `withNativeWind`:
   Check `metro.config.js`:

   ```js
   const { withNativeWind } = require("nativewind/metro");
   module.exports = withNativeWind(config, { input: "./global.css" });
   ```

3. Babel plugin not set:
   Check `babel.config.js`:

   ```js
   plugins: ["nativewind/babel", "react-native-reanimated/plugin"];
   ```

4. Clear the cache and restart:
   ```bash
   npx expo start --clear
   ```

---

### TypeScript error: `className` not a valid prop

**Symptom:** `Property 'className' does not exist on type 'ViewProps'`

**Fix:** Ensure `nativewind-env.d.ts` exists in `mobile/` with:

```ts
/// <reference types="nativewind/types" />
```

---

### GPS location not working in Expo Go

**Symptom:** `Location.getCurrentPositionAsync()` fails or returns null.

**Fix:**

- Ensure `expo-location` is installed: `npx expo install expo-location`
- Add permissions to `app.json`:
  ```json
  "ios": { "infoPlist": { "NSLocationWhenInUseUsageDescription": "Needed for attendance" } },
  "android": { "permissions": ["ACCESS_FINE_LOCATION"] }
  ```
- Test on a real device for GPS accuracy.

---

### API calls returning `Network request failed`

**Symptom:** Fetch/axios calls fail when running on a physical device.

**Fix:**

- Do not use `localhost` — use your machine's local IP address:
  ```ts
  export const API_URL = "http://192.168.x.x:8000/api";
  ```
- Ensure the Laravel backend is running and accessible on your local network.
- Ensure the backend server is not blocked by a firewall.

---

## Backend (Laravel)

---

### `php artisan serve` port already in use

**Fix:**

```bash
php artisan serve --port=8001
```

Or kill the process using port 8000:

```bash
lsof -ti:8000 | xargs kill
```

---

### `SQLSTATE[HY000] [2002] Connection refused` (MySQL)

**Symptom:** Database connection fails when running migrations or the server.

**Fix:**

1. Ensure MySQL is running:

   ```bash
   sudo systemctl start mysql   # Linux
   brew services start mysql    # macOS
   ```

2. Verify `.env` credentials match your MySQL setup:

   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=geotrack
   DB_USERNAME=root
   DB_PASSWORD=
   ```

3. Ensure the database exists:
   ```sql
   CREATE DATABASE geotrack;
   ```

---

### `php artisan migrate` fails with `Access denied`

**Fix:** Check that your MySQL user has permission on the `geotrack` database:

```sql
GRANT ALL PRIVILEGES ON geotrack.* TO 'root'@'127.0.0.1';
FLUSH PRIVILEGES;
```

---

### Sanctum token authentication returns `401 Unauthenticated`

**Possible causes & fixes:**

1. Missing `Authorization` header — ensure the request includes:

   ```
   Authorization: Bearer <token>
   Accept: application/json
   ```

2. `HasApiTokens` trait not added to `User` model:

   ```php
   use Laravel\Sanctum\HasApiTokens;

   class User extends Authenticatable
   {
       use HasApiTokens, HasFactory, Notifiable;
   ```

3. Token was revoked — user must log in again to get a new token.

---

### CORS error in mobile app

**Symptom:** API calls fail with `Access-Control-Allow-Origin` errors.

**Fix:** Check `backend/config/cors.php`:

```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_origins' => ['*'],  // restrict to specific origin in production
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
```

After editing, clear the config cache:

```bash
php artisan config:clear
php artisan config:cache
```

---

### Routes not found after adding new routes

**Fix:** Clear the route cache:

```bash
php artisan route:clear
php artisan route:cache
```

---

### `Class not found` after adding a new class

**Fix:** Regenerate the Composer autoload map:

```bash
composer dump-autoload
```

---

## General

---

### Git push rejected

```bash
git pull origin main --rebase
# resolve conflicts if any
git push origin main
```

---

### Environment variable changes not taking effect

**Mobile:** Restart the Expo dev server with `--clear`:

```bash
npx expo start --clear
```

**Backend:** Clear the config cache:

```bash
php artisan config:clear
```
