# GeoTrack — Changelog

All notable changes to GeoTrack are documented here.

Format: `[version] — YYYY-MM-DD`  
Types: `Added` | `Changed` | `Fixed` | `Removed` | `Security`

---

## [0.2.0] — 2026-03-15

### Added

- Laravel 12 backend scaffolded in `backend/`
- Laravel Sanctum installed and configured for token-based API authentication
- `HasApiTokens` trait added to `User` model
- `routes/api.php` created with public auth group and protected routes group
- Logout endpoint: `POST /api/auth/logout`
- CORS configuration published (`config/cors.php`) — allows all origins for local development
- `backend/.env` pre-configured: `APP_NAME=GeoTrack`, MySQL connection, `APP_URL=http://localhost:8000`
- Project restructured into monorepo layout:
  - `mobile/` — React Native / Expo application
  - `backend/` — Laravel REST API
  - `docs/` — Project documentation
- `docs/` folder fully initialised with:
  - `architecture.md`
  - `api-docs.md`
  - `mobile-guidelines.md`
  - `backend-guidelines.md`
  - `setup.md`
  - `deployment.md`
  - `troubleshooting.md`
  - `changelog.md`
  - `diagrams/` folder

### Changed

- Root `.gitignore` updated to scope Expo paths under `mobile/` and add Laravel backend ignores

---

## [0.1.0] — 2026-03-15

### Added

- Initial Expo + React Native project scaffolded (Expo SDK 55, React Native 0.83, TypeScript)
- NativeWind v4 configured:
  - `nativewind` and `tailwindcss` installed
  - `babel.config.js` with `nativewind/babel` and `react-native-reanimated/plugin`
  - `metro.config.js` with `withNativeWind()`
  - `tailwind.config.js` with `nativewind/preset`
  - `global.css` with Tailwind directives
  - `nativewind-env.d.ts` for TypeScript support
  - `global.css` imported in `index.ts`
- `react-native-reanimated` and `react-native-safe-area-context` installed
- `App.tsx` updated to use NativeWind `className` styling
- `README.md` created with full project documentation:
  - Problem statement
  - Core features
  - System architecture
  - Technology stack
  - Setup instructions (mobile + backend)
  - Security considerations
  - Development roadmap
  - Author information
- Initial git repository created and pushed to `origin/main`

---

> This changelog follows the principles of [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
