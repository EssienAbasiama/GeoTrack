# GeoTrack — Manual QA Checklist (iPhone)

A role-by-role test script you run on a physical iPhone. Mark each row ✅/❌ and,
for any ❌, capture: **screen, steps, expected, actual, screenshot, any toast/log text**.

> The backend logic (geofence math, check-in rules, device binding, sessions) is
> already covered by 78 automated tests (`cd backend && php artisan test`). This
> checklist covers what those tests **can't**: real GPS, camera/face, live UI/UX.

---

## 0. Prerequisites (do these first — most "it won't connect" issues live here)

- [ ] **Dev build, not Expo Go.** This app uses `react-native-maps`, `expo-camera`,
      `expo-location` — these are **not** in Expo Go on iOS. Use a development build
      (EAS build / TestFlight / `expo run:ios` on a Mac).
- [ ] **Seed fresh data right before testing** (the demo session is time-relative):
      `cd backend && php artisan migrate:fresh --seed`
- [ ] **Serve on the LAN** (not just localhost): `php artisan serve --host=0.0.0.0 --port=8000`
- [ ] iPhone and PC on the **same Wi-Fi**; allow **port 8000** through Windows Firewall.
- [ ] **API URL reachable:** if running via `expo start` + dev client, it auto-detects
      the Metro host IP. If it's a **standalone/TestFlight build** (no Metro), set
      `EXPO_PUBLIC_API_BASE_URL=http://<your-PC-LAN-IP>:8000/api` (or `app.json` →
      `expo.extra.apiBaseUrl`), otherwise it falls back to a non-existent prod URL.
- [ ] Sanity check: app opens, you can log in (proves phone → backend connectivity).

### Seeded accounts — password for ALL is `Password123!` (all pre-verified)

| Role | Login email | Notes |
|---|---|---|
| Superadmin | `admin@geotrack.edu` | Full admin |
| Lecturer A (Dr. Adebayo Olu) | `adebayo.olu@geotrack.edu` | Teaches **CSC401, CSC403** |
| Lecturer B (Dr. Funmi Ade) | `funmi.ade@geotrack.edu` | Teaches **CSC405, CSC407** |
| HOC (Kemi Adesanya) | `kemi.adesanya@students.geotrack.edu` | role `hoc` — **has admin powers** (see §5) |
| Student | `chika.eze@students.geotrack.edu` | Enrolled in CSC401, CSC403, CSC405 |
| Students (others) | `tunde.bello@…`, `amaka.obi@…`, `sade.ojo@…`, `ifeanyi.nwosu@…`, `bola.adeyemi@students.geotrack.edu` | Same enrollment |

- **Seeded geofence:** every course = circle at **lat 7.2266, lng 3.4400, radius 100 m**
  ("FUNAAB Engineering Block").
- **Seeded active session:** **CSC401** (tap mode, late after 10 min).

---

## ★ Geofence test strategy (read before §3 — this is the core feature)

You can't fake GPS on a stock iPhone, so test the two branches like this:

- **INSIDE (without traveling to FUNAAB):**
  1. Log in as **lecturer** `adebayo.olu@geotrack.edu`.
  2. Open **CSC403** → **Set Class Location** → **Geofence Radius** → **Capture current
     location** → radius **100 m** → Save.
  3. **Start session** (tap mode).
  4. Log out → log in as student `chika.eze@students.geotrack.edu` → open CSC403 → **Check in**.
  - ✅ Expect: green "Ready to check in", button enabled, success screen + notification.

- **OUTSIDE:** As student `chika.eze`, open **CSC401** (seeded session, fence at FUNAAB)
  while you are **not** at FUNAAB.
  - ✅ Expect: red "Move closer to the venue", distance "… m away", check-in button disabled.

---

## 1. Auth & onboarding (any account)

- [ ] Splash → onboarding → auth landing renders cleanly (no flash/jump).
- [ ] Login with a seeded account → lands on the correct home for that role.
- [ ] Login with **wrong password** → clear error toast, no crash.
- [ ] Forgot password → reset code flow (needs working SMTP; otherwise skip).
- [ ] Logout → returns to auth landing; protected screens no longer reachable.
- [ ] (Optional) Register a new user → 6-digit email code. **Note:** mail is SMTP; if not
      configured, the code won't arrive — prefer seeded accounts.

## 2. Device binding (anti-spoofing)

- [ ] First login on the iPhone silently **binds** the device (no error).
- [ ] **Reset device** (Profile/Settings) → revokes, lets you bind again.
- [ ] **Device conflict:** log the **same student** into a **second** phone → the second
      should hit the **Device Conflict** screen (one active device per user).
      *Needs a 2nd device — skip if unavailable and note it.*

## 3. Student role (`chika.eze@students.geotrack.edu`)

- [ ] Dashboard renders: enrolled courses (CSC401/403/405), attendance stats.
- [ ] CSC401 shows an **active session**; tapping leads to the check-in screen.
- [ ] Check-in map renders; status banner + distance update as expected.
- [ ] **INSIDE** flow (per ★ strategy) → success + check-in notification.
- [ ] **OUTSIDE** flow (per ★ strategy) → button disabled, "… m away".
- [ ] **Late:** check in >10 min after session start → record shows **late**.
- [ ] "Navigate" / route-to-class screen draws a walking route + "you've arrived".
- [ ] My attendance history lists the new record.
- [ ] Presence check: when a lecturer triggers one, a prompt appears → respond → confirms.
- [ ] Face enrollment screen (camera) works; in a **face_recognition** session, check-in
      asks for a selfie and succeeds with your enrolled face.

## 4. Lecturer role (`adebayo.olu@geotrack.edu`)

- [ ] Dashboard shows **only own** courses (CSC401, CSC403) — not CSC405/407.
- [ ] **Set Class Location → Geofence Radius**: capture GPS, pick radius (30/50/100/150/200 m), save.
- [ ] **Set Class Location → Perimeter Walk**: walk ≥3 points, "Boundary ready ✓", save.
- [ ] **Start session** (tap and face modes), set duration + late threshold.
- [ ] Starting a **2nd** active session on the same course → blocked ("active session exists").
- [ ] Live session / roster shows students; records update as students check in.
- [ ] Trigger a **manual presence check** → students receive it.
- [ ] **Close session** → status closed; students can no longer check in.
- [ ] Enroll a student (by matric/email) and unenroll → roster updates.
- [ ] Try to edit **CSC405** (not yours) → blocked.

## 5. HOC role (`kemi.adesanya@students.geotrack.edu`) — ⚠️ verify carefully

> Backend reality: role `hoc` returns `isAdmin() = true`, so the HOC currently has
> **full admin powers** (create/edit courses, set geofences, start/close sessions,
> admin dashboard) **and** bypasses device binding — yet is also enrolled as a student.
> **Confirm this matches your intent.** If HOC was meant to be read-only oversight,
> this is a privilege issue to flag.

- [ ] What home/dashboard does HOC land on? (admin? student? both?)
- [ ] Can HOC create/delete courses and edit geofences? (Currently: yes.)
- [ ] Can HOC start/close sessions on any course? (Currently: yes.)
- [ ] Does HOC need a bound device? (Currently: no — bypasses it.)
- [ ] Can HOC also check in to a class as a participant?
- [ ] Decision: is all of the above intended for a "Head of Class"? ✅/❌

## 6. Superadmin (`admin@geotrack.edu`)

- [ ] Admin dashboard: counts (students, lecturers, courses, sessions, records).
- [ ] Create a course → assign a lecturer (must have lecturer role).
- [ ] Lecturer management: list lecturers, assign a course.
- [ ] Set/edit geofence on any course.
- [ ] Delete a course → cascades (geofence/sessions/records gone).

## 7. Cross-cutting UI/UX (check throughout, all roles)

- [ ] **Loading states:** spinners while fetching (no blank flashes).
- [ ] **Error states:** backend messages surface as toasts (kill Wi-Fi mid-action to test).
- [ ] **Empty states:** "No active session", no courses, empty history read well.
- [ ] **Permissions:** deny **location** → graceful message, app still usable;
      deny **camera** in face mode → clear message.
- [ ] **Offline:** airplane mode → network-error handling + auto-retry, no white screen.
- [ ] **Layout:** safe-area around the notch/Dynamic Island; nothing clipped; scrolls OK.
- [ ] **Keyboard:** inputs not covered by keyboard; "done"/submit reachable.
- [ ] **Touch targets:** buttons/back arrows easy to hit (≥44 px).
- [ ] **Navigation:** back works everywhere; no dead-ends; modals dismiss cleanly.
- [ ] **Consistency:** colors/fonts/spacing consistent (primary `#6343cc`).

---

## 8. Report template (paste back to me per failure)

```
Screen:        e.g. CheckInScreen (CSC401)
Role/account:  student / chika.eze@students.geotrack.edu
Steps:         1) … 2) … 3) …
Expected:      green "Ready to check in", button enabled
Actual:        button stayed disabled, banner showed "120 m away"
Toast/log:     "You are not within the class venue."
Screenshot:    attached
```

Send me these and I'll diagnose the cause and propose a fix.
