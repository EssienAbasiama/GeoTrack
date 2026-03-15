# GeoTrack — Mobile App Guidelines

> Last updated: 2026-03-15

---

## Stack

| Tool         | Version |
| ------------ | ------- |
| React Native | 0.83.2  |
| Expo SDK     | 55      |
| TypeScript   | ~5.9    |
| NativeWind   | ^4.2    |
| Tailwind CSS | ^3.4    |

---

## Folder Structure

```
mobile/
│
├── app/                    # Screens and navigation (Expo Router or React Navigation)
│   ├── (auth)/             # Auth screens: login, register
│   ├── (student)/          # Student screens: dashboard, check-in
│   └── (lecturer)/         # Lecturer screens: session management, records
│
├── components/             # Reusable UI components
│   ├── ui/                 # Base components (Button, Input, Card, etc.)
│   └── shared/             # Feature-shared components
│
├── hooks/                  # Custom React hooks (useLocation, useAuth, etc.)
│
├── services/               # API call functions (auth, attendance, sessions)
│
├── store/                  # State management (Zustand or Context API)
│
├── types/                  # TypeScript type definitions
│
├── utils/                  # Utility/helper functions
│
├── constants/              # App-wide constants (API_URL, colours, etc.)
│
├── assets/                 # Images, fonts, icons
│
├── App.tsx                 # App entry component
├── index.ts                # Expo entry point (imports global.css)
├── global.css              # Tailwind CSS entry
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Coding Standards

### TypeScript

- Strict mode is enabled (`"strict": true` in `tsconfig.json`)
- Always type props, state, and API responses explicitly
- Avoid `any` — use proper types or `unknown`
- Use `interface` for object shapes, `type` for unions/intersections

```ts
// ✅ Good
interface AttendanceSession {
  id: number;
  courseId: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

// ❌ Avoid
const session: any = { ... };
```

---

### Styling — NativeWind

- Use `className` for all styling (NativeWind utility classes)
- Do not mix `StyleSheet.create` with `className` — pick one per component
- Follow Tailwind's utility-first approach
- Prefer responsive and accessible defaults

```tsx
// ✅ Good
<View className="flex-1 bg-white px-4 py-6">
  <Text className="text-lg font-semibold text-slate-900">Hello</Text>
</View>

// ❌ Avoid mixing
<View style={{ flex: 1 }} className="bg-white">
```

---

### Components

- One component per file
- File name matches the component name (`AttendanceCard.tsx`)
- Use functional components only — no class components
- Keep components small and focused
- Extract logic into custom hooks

```tsx
// ✅ Component file: components/ui/Button.tsx
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-xl px-6 py-3 ${variant === "primary" ? "bg-blue-600" : "border border-blue-600"}`}
    >
      <Text
        className={`text-center font-semibold ${variant === "primary" ? "text-white" : "text-blue-600"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

---

### API Services

- All API calls live in `services/`
- Use `axios` or `fetch` with a base URL from `constants/`
- Always handle errors with try/catch

```ts
// services/auth.ts
import { API_URL } from "@/constants";

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("Login failed");
  return res.json();
}
```

---

### Naming Conventions

| Item        | Convention                  | Example              |
| ----------- | --------------------------- | -------------------- |
| Components  | PascalCase                  | `AttendanceCard.tsx` |
| Hooks       | camelCase with `use` prefix | `useLocation.ts`     |
| Services    | camelCase                   | `authService.ts`     |
| Types       | PascalCase                  | `AttendanceSession`  |
| Constants   | UPPER_SNAKE_CASE            | `API_URL`            |
| CSS classes | Tailwind utility            | `bg-blue-600`        |

---

### Git & Commits

- Branch from `main`: `feature/`, `fix/`, `chore/`
- Commit messages: `feat: add check-in screen`, `fix: geofence radius off by one`
- Never commit secrets or `.env` files

---

## Running the App

```bash
cd mobile
npm install
npx expo start
```
