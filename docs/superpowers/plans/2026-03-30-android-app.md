# ShelterDK Android App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Android app for shelterdk.dk using Expo/React Native that shares business logic with the existing Next.js website via a monorepo.

**Architecture:** Monorepo with npm workspaces (`web/`, `app/`, `shared/`). The Expo app uses Mapbox GL Native for maps, expo-location for GPS tracking, expo-sqlite for local caching, and Zustand + TanStack Query for state. The app talks directly to the existing Supabase backend.

**Tech Stack:** Expo SDK 52, Expo Router v4, @rnmapbox/maps, expo-location, expo-camera, expo-sqlite, @supabase/supabase-js, Zustand, TanStack Query, Sentry.

**Spec:** `docs/superpowers/specs/2026-03-30-android-app-design.md`

---

## File Structure Overview

### New files: `shared/`

```
shared/
├── package.json
├── tsconfig.json
├── index.ts                        ← barrel export
├── types/
│   ├── shelter.ts                  ← migrated from web/types/shelter.ts
│   └── curated-route.ts            ← migrated from web/types/curated-route.ts
├── lib/
│   ├── shelter-detail.ts           ← migrated from web/lib/shelter-detail.ts
│   ├── slug.ts                     ← migrated from web/lib/slug.ts
│   ├── haversine.ts                ← migrated from web/lib/haversine.ts
│   ├── soeg-filters.ts             ← migrated from web/lib/soeg-filters.ts
│   ├── relative-time-da.ts         ← migrated from web/lib/relative-time-da.ts
│   ├── area-prepositions.ts        ← pure preposition logic extracted from web/lib/area-db.ts
│   └── gpx-export.ts              ← pure GPX XML generation (no DOM dependency)
└── constants/
    └── facilities.ts               ← shared facility definitions (filter chips, icons)
```

### New files: `app/` (Expo project)

```
app/
├── package.json
├── tsconfig.json
├── app.json                        ← Expo config
├── metro.config.js                 ← Metro resolver for shared/
├── eas.json                        ← EAS Build config
├── babel.config.js
├── app/
│   ├── _layout.tsx                 ← Root layout (providers, error boundary)
│   ├── (tabs)/
│   │   ├── _layout.tsx             ← Tab navigator (5 tabs)
│   │   ├── index.tsx               ← Kort tab (map)
│   │   ├── explore.tsx             ← Udforsk tab (search/list)
│   │   ├── routes.tsx              ← Ruter tab
│   │   ├── guides.tsx              ← Guides tab
│   │   └── profile.tsx             ← Profil tab
│   ├── shelter/
│   │   └── [slug].tsx              ← Shelter detail screen
│   ├── route/
│   │   └── [slug].tsx              ← Route detail screen
│   └── tracking.tsx                ← Active tracking fullscreen
├── components/
│   ├── ShelterCard.tsx             ← Shelter list item
│   ├── ShelterMap.tsx              ← Mapbox map wrapper
│   ├── FilterChips.tsx             ← Facility filter UI
│   ├── OfflineBanner.tsx           ← "Du er offline" indicator
│   ├── ErrorBoundary.tsx           ← Per-tab error boundary
│   └── PhotoUpload.tsx             ← Camera/gallery picker
├── lib/
│   ├── supabase.ts                 ← RN Supabase client (AsyncStorage)
│   ├── database.ts                 ← SQLite schema + migrations
│   ├── sync-manager.ts             ← Offline queue + sync logic
│   ├── device-id.ts                ← Device UUID generation
│   ├── network.ts                  ← NetInfo connectivity hook
│   └── image-url.ts                ← Google photo proxy URL builder
├── stores/
│   ├── tracking-store.ts           ← Zustand: GPS tracking state
│   ├── filter-store.ts             ← Zustand: active filters
│   └── download-store.ts           ← Zustand: offline map downloads
├── hooks/
│   ├── use-shelters.ts             ← TanStack Query: shelter data
│   ├── use-shelter-detail.ts       ← TanStack Query: single shelter
│   ├── use-routes.ts               ← TanStack Query: curated routes
│   ├── use-location.ts             ← expo-location wrapper
│   └── use-offline.ts              ← Network state hook
└── assets/
    ├── icon.png                    ← App icon (1024x1024)
    ├── splash.png                  ← Splash screen
    └── adaptive-icon.png           ← Android adaptive icon
```

### Modified files: `web/`

After shared code extraction, web imports change from `@/lib/slug` to `@shelterdk/shared/lib/slug` (or path alias). Affected files are listed per task.

### Root

```
shelterdk/
├── package.json                    ← NEW: workspace root
└── ... existing files
```

---

## Phase 1: Foundation

### Task 1: Monorepo Setup

Create root workspace configuration and shared package so both web and app can share code.

**Files:**
- Create: `package.json` (root)
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/index.ts`
- Modify: `web/package.json` (add name field)
- Modify: `web/tsconfig.json` (add shared path alias)

- [ ] **Step 1: Create root package.json**

```json
{
  "private": true,
  "workspaces": ["shared", "web", "app"]
}
```

Note: The existing root `package.json` has scripts for data backfill. Merge the `workspaces` field into it, keeping existing scripts.

- [ ] **Step 2: Create shared/package.json**

```json
{
  "name": "@shelterdk/shared",
  "version": "1.0.0",
  "private": true,
  "main": "index.ts",
  "types": "index.ts"
}
```

- [ ] **Step 3: Create shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Create shared/index.ts (empty barrel)**

```typescript
// Barrel exports — populated as files are migrated
export {};
```

- [ ] **Step 5: Add name to web/package.json**

Add `"name": "@shelterdk/web"` at the top of the existing `web/package.json`.

- [ ] **Step 6: Add shared path alias to web/tsconfig.json**

Add to `compilerOptions.paths`:
```json
{
  "paths": {
    "@/*": ["./*"],
    "@shared/*": ["../shared/*"]
  }
}
```

- [ ] **Step 7: Install workspace dependencies**

Run from repo root:
```bash
npm install
```
Expected: Creates hoisted `node_modules/` at root with symlinks.

- [ ] **Step 8: Verify web still builds**

```bash
cd web && npx next build
```
Expected: Build succeeds with no errors. This confirms workspaces didn't break existing setup.

- [ ] **Step 9: Commit**

```bash
git add package.json shared/ web/package.json web/tsconfig.json
git commit -m "feat: set up monorepo with npm workspaces and shared package"
```

---

### Task 2: Extract Shared Types

Move type definitions from web to shared. Update web imports.

**Files:**
- Create: `shared/types/shelter.ts` (copy from `web/types/shelter.ts`)
- Create: `shared/types/curated-route.ts` (copy from `web/types/curated-route.ts`)
- Modify: `shared/index.ts` (add exports)
- Modify: `web/types/shelter.ts` (re-export from shared)
- Modify: `web/types/curated-route.ts` (re-export from shared)

- [ ] **Step 1: Copy types to shared**

```bash
mkdir -p shared/types
cp web/types/shelter.ts shared/types/shelter.ts
cp web/types/curated-route.ts shared/types/curated-route.ts
```

These files have zero imports — pure type definitions. No modifications needed.

- [ ] **Step 2: Update shared/index.ts**

```typescript
// Types
export type { Shelter } from "./types/shelter";
export type { RouteShelter, CuratedRouteIndex, CuratedRouteData, CuratedRouteDataMap } from "./types/curated-route";
```

- [ ] **Step 3: Replace web type files with re-exports**

Replace `web/types/shelter.ts`:
```typescript
export type { Shelter } from "@shared/types/shelter";
```

Replace `web/types/curated-route.ts`:
```typescript
export type { RouteShelter, CuratedRouteIndex, CuratedRouteData, CuratedRouteDataMap } from "@shared/types/curated-route";
```

- [ ] **Step 4: Verify web still builds**

```bash
cd web && npx next build
```
Expected: Build succeeds. All existing `import type { Shelter } from "@/types/shelter"` still work via re-export.

- [ ] **Step 5: Commit**

```bash
git add shared/types/ shared/index.ts web/types/
git commit -m "refactor: extract shared types to shared/ package"
```

---

### Task 3: Extract Shared Utilities

Move pure utility functions from web to shared.

**Files:**
- Create: `shared/lib/slug.ts`
- Create: `shared/lib/haversine.ts`
- Create: `shared/lib/relative-time-da.ts`
- Create: `shared/lib/soeg-filters.ts`
- Create: `shared/lib/shelter-detail.ts`
- Create: `shared/lib/area-prepositions.ts`
- Create: `shared/lib/gpx-export.ts` (pure XML generation from web/lib/gpx-export.ts)
- Modify: Corresponding web files (re-export from shared)
- Modify: `shared/index.ts`

- [ ] **Step 1: Copy pure utility files**

```bash
mkdir -p shared/lib
cp web/lib/slug.ts shared/lib/slug.ts
cp web/lib/haversine.ts shared/lib/haversine.ts
cp web/lib/relative-time-da.ts shared/lib/relative-time-da.ts
cp web/lib/soeg-filters.ts shared/lib/soeg-filters.ts
cp web/lib/shelter-detail.ts shared/lib/shelter-detail.ts
```

- [ ] **Step 2: Fix imports in shared copies**

`shared/lib/soeg-filters.ts` — change:
```typescript
// FROM:
import type { Shelter } from "@/types/shelter";
// TO:
import type { Shelter } from "../types/shelter";
```

`shared/lib/shelter-detail.ts` — change:
```typescript
// FROM:
import type { Shelter } from "@/types/shelter";
// TO:
import type { Shelter } from "../types/shelter";
```

All other copied files have zero imports — no changes needed.

- [ ] **Step 3: Extract area prepositions from area-db.ts**

Create `shared/lib/area-prepositions.ts` with only the pure logic from `web/lib/area-db.ts` (no Supabase dependency):

```typescript
const AREA_PREPOSITION: Record<string, string> = {
  bornholm: "på",
  lolland: "på",
  "lolland-falster": "på",
  fanoe: "på",
  samsoe: "på",
  laesoe: "på",
  haervejen: "på",
  limfjorden: "ved",
  vadehavet: "ved",
};

export function prepositionForArea(area: { slug: string }): string {
  return AREA_PREPOSITION[area.slug] ?? "i";
}

export function prepositionForRegionName(region: string): "i" | "på" {
  const r = (region || "").trim().toLowerCase();
  if (r === "fyn" || r === "sjælland" || r === "bornholm") return "på";
  return "i";
}
```

- [ ] **Step 3b: Extract pure GPX export functions**

Copy `web/lib/gpx-export.ts` to `shared/lib/gpx-export.ts` but ONLY the pure XML generation functions: `escapeXml`, `generateGpx`, `generateRouteGpx`, and the `GpxWaypoint` type. These are pure string builders with zero DOM dependency.

Do NOT copy `downloadGpx` and `downloadRouteGpx` — these use `Blob`, `document.createElement("a")`, and `URL.createObjectURL` which are browser-only DOM APIs.

Update `web/lib/gpx-export.ts` to import the pure functions from shared and keep only the DOM-dependent download helpers locally:
```typescript
export { generateGpx, generateRouteGpx, type GpxWaypoint } from "@shared/lib/gpx-export";
// Keep downloadGpx and downloadRouteGpx here — they use DOM APIs
```

Note: `web/lib/gpx-parser.ts` stays in web/ entirely — it uses `FileReader` and `DOMParser` (DOM-only). The app will use a different XML parser if GPX import is ever needed.

- [ ] **Step 4: Replace web files with re-exports**

For each migrated file, replace the web copy with a re-export. Example for `web/lib/slug.ts`:
```typescript
export { slugifySegment, slugifySegmentLegacy, segmentSlugToName } from "@shared/lib/slug";
```

Do the same for:
- `web/lib/haversine.ts`
- `web/lib/relative-time-da.ts`
- `web/lib/soeg-filters.ts`
- `web/lib/shelter-detail.ts`

For `web/lib/area-db.ts`: keep the file, but replace the preposition functions with imports from shared:
```typescript
import { prepositionForArea, prepositionForRegionName } from "@shared/lib/area-prepositions";
export { prepositionForArea, prepositionForRegionName };
// ... keep all Supabase query functions unchanged
```

- [ ] **Step 5: Update shared/index.ts with new exports**

Add all new exports to `shared/index.ts`.

- [ ] **Step 6: Verify web builds**

```bash
cd web && npx next build
```
Expected: Build succeeds.

- [ ] **Step 7: Run existing tests**

```bash
cd web && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add shared/lib/ shared/index.ts web/lib/slug.ts web/lib/haversine.ts web/lib/relative-time-da.ts web/lib/soeg-filters.ts web/lib/shelter-detail.ts web/lib/area-db.ts
git commit -m "refactor: extract shared utilities to shared/ package"
```

---

### Task 4: Scaffold Expo App

Create the Expo project with basic configuration.

**Files:**
- Create: `app/` (entire Expo project via `create-expo-app`)
- Create: `app/metro.config.js`
- Create: `app/app.json` (customize)
- Modify: `app/package.json` (add dependencies)

- [ ] **Step 1: Create Expo app**

```bash
cd /Users/CKA/shelterdk
npx create-expo-app@latest app --template blank-typescript
```

- [ ] **Step 2: Configure Metro for monorepo**

Create `app/metro.config.js`:
```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch shared/ for changes
config.watchFolders = [monorepoRoot];

// Resolve from both app/ and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure shared/ package resolves correctly
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 3: Configure app.json**

Update `app/app.json`:
```json
{
  "expo": {
    "name": "ShelterDK",
    "slug": "shelterdk",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a3a2a"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a3a2a"
      },
      "package": "dk.shelterdk.app",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_MEDIA_IMAGES",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "ShelterDK bruger din position til at vise shelters nær dig og tracke dine ture.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "ShelterDK bruger kameraet til at tage billeder af shelters."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "ShelterDK bruger dine billeder til at uploade shelter-fotos."
        }
      ]
    ],
    "scheme": "shelterdk"
  }
}
```

- [ ] **Step 4: Add name to app/package.json**

Add `"name": "@shelterdk/app"` to `app/package.json`.

- [ ] **Step 5: Install core dependencies**

```bash
cd app
npx expo install expo-router expo-location expo-camera expo-image-picker expo-image-manipulator expo-sqlite expo-task-manager @react-native-async-storage/async-storage
npx expo install @supabase/supabase-js zustand @tanstack/react-query
npx expo install react-native-safe-area-context react-native-screens react-native-gesture-handler
npx expo install @react-native-community/netinfo
npm install @shelterdk/shared@*
```

- [ ] **Step 6: Add tsconfig.json for the app**

Create `app/tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@shared/*": ["../shared/*"]
    }
  }
}
```

- [ ] **Step 7: Verify Expo starts**

```bash
cd app && npx expo start --android
```
Expected: App starts on emulator/device with default blank screen.

- [ ] **Step 8: Commit**

```bash
git add app/
git commit -m "feat: scaffold Expo app with monorepo config"
```

---

### Task 5: Tab Navigation Shell

Set up the 5-tab navigation structure with placeholder screens.

**Files:**
- Create: `app/app/_layout.tsx`
- Create: `app/app/(tabs)/_layout.tsx`
- Create: `app/app/(tabs)/index.tsx`
- Create: `app/app/(tabs)/explore.tsx`
- Create: `app/app/(tabs)/routes.tsx`
- Create: `app/app/(tabs)/guides.tsx`
- Create: `app/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create root layout with providers**

Create `app/app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="shelter/[slug]" options={{ headerShown: true, title: "" }} />
          <Stack.Screen name="route/[slug]" options={{ headerShown: true, title: "" }} />
          <Stack.Screen name="tracking" options={{ presentation: "fullScreenModal" }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Create tab layout**

Create `app/app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";
import { Map, Search, Route, BookOpen, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#1a3a2a",
        tabBarInactiveTintColor: "#999",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Kort", tabBarIcon: ({ color, size }) => <Map color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Udforsk", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="routes"
        options={{ title: "Ruter", tabBarIcon: ({ color, size }) => <Route color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="guides"
        options={{ title: "Guides", tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}
```

Note: Install `lucide-react-native` and its peer `react-native-svg`:
```bash
cd app && npx expo install lucide-react-native react-native-svg
```

- [ ] **Step 3: Create placeholder tab screens**

Create each tab with a simple placeholder. Example for `app/app/(tabs)/index.tsx`:
```tsx
import { View, Text, StyleSheet } from "react-native";

export default function MapTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kort</Text>
      <Text style={styles.subtitle}>Kort kommer her</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f0" },
  title: { fontSize: 24, fontWeight: "bold", color: "#1a3a2a" },
  subtitle: { fontSize: 16, color: "#666", marginTop: 8 },
});
```

Repeat for `explore.tsx` ("Udforsk"), `routes.tsx` ("Ruter"), `guides.tsx` ("Guides"), `profile.tsx` ("Profil").

- [ ] **Step 4: Verify navigation works**

```bash
cd app && npx expo start --android
```
Expected: App shows 5 tabs at bottom. Tapping each tab shows its placeholder. Tab icons and labels render correctly.

- [ ] **Step 5: Commit**

```bash
git add app/app/
git commit -m "feat: add 5-tab navigation shell with Expo Router"
```

---

## Phase 2: Data Layer

### Task 6: Supabase Client for React Native

Set up the Supabase client with AsyncStorage and device ID.

**Files:**
- Create: `app/lib/supabase.ts`
- Create: `app/lib/device-id.ts`
- Create: `app/.env` (gitignored)

- [ ] **Step 1: Create .env file**

Create `app/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=<same as NEXT_PUBLIC_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<same as NEXT_PUBLIC_SUPABASE_ANON_KEY>
```

Add to `.gitignore`: `app/.env`

- [ ] **Step 2: Create device-id.ts**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "shelterdk_device_id";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  cachedDeviceId = id;
  return id;
}
```

- [ ] **Step 3: Create supabase.ts**

```typescript
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 4: Test Supabase connection**

Temporarily add to `app/app/(tabs)/index.tsx`:
```tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// Inside component:
const [count, setCount] = useState<number | null>(null);
useEffect(() => {
  supabase.from("shelters").select("id", { count: "exact", head: true }).then(({ count }) => setCount(count));
}, []);
// Render: <Text>Shelters: {count ?? "loading..."}</Text>
```

Expected: Shows shelter count (e.g., "Shelters: 1043"). Remove test code after verification.

- [ ] **Step 5: Commit**

```bash
git add app/lib/supabase.ts app/lib/device-id.ts app/.env.example
git commit -m "feat: add Supabase client and device ID for React Native"
```

---

### Task 7: SQLite Database and Cache Layer

Set up local SQLite database for offline caching of shelter data.

**Files:**
- Create: `app/lib/database.ts`
- Create: `app/hooks/use-shelters.ts`

- [ ] **Step 1: Create database.ts with schema**

```typescript
import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("shelterdk.db");
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS shelters (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      lat REAL,
      lon REAL,
      image_url TEXT,
      image_urls TEXT,
      user_image_urls TEXT,
      google_rating REAL,
      google_user_ratings_total INTEGER,
      google_place_name TEXT,
      google_photo_ref TEXT,
      booking_url TEXT,
      region TEXT,
      kommune TEXT,
      place TEXT,
      water TEXT,
      toilet TEXT,
      capacity INTEGER,
      display_score REAL,
      area_slug TEXT,
      geofa_raw TEXT,
      google_places TEXT,
      seo_description TEXT,
      updated_at TEXT,
      cached_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_shelters_region ON shelters(region);
    CREATE INDEX IF NOT EXISTS idx_shelters_area ON shelters(area_slug);
    CREATE INDEX IF NOT EXISTS idx_shelters_lat_lon ON shelters(lat, lon);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_attempt TEXT
    );

    CREATE TABLE IF NOT EXISTS tracked_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      name TEXT,
      points TEXT NOT NULL,
      distance_km REAL,
      duration_seconds INTEGER,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'last_shelter_sync'"
  );
  return row?.value ?? null;
}

export async function setLastSyncTime(time: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('last_shelter_sync', ?)",
    time
  );
}
```

- [ ] **Step 2: Create use-shelters.ts hook**

```typescript
import * as SQLite from "expo-sqlite";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getDatabase, getLastSyncTime, setLastSyncTime } from "../lib/database";
import type { Shelter } from "@shared/types/shelter";

const SHELTER_COLUMNS = `id, title, slug, description, location, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, google_photo_ref, google_places, booking_url, region, kommune, place, water, toilet, capacity, display_score, area_slug, geofa_raw, seo_description, updated_at`;

async function syncShelters(): Promise<Shelter[]> {
  const db = await getDatabase();
  const lastSync = await getLastSyncTime();

  // Try fetching from server
  let query = supabase
    .from("shelters")
    .select(SHELTER_COLUMNS)
    .is("duplicate_of_shelter_id", null)
    .order("display_score", { ascending: false });

  if (lastSync) {
    query = query.gt("updated_at", lastSync);
  }

  const { data, error } = await query;

  if (error) {
    // Offline or error — return cached data
    console.warn("Supabase fetch failed, using cache:", error.message);
    return getCachedShelters(db);
  }

  if (data && data.length > 0) {
    // Upsert into SQLite (wrapped in transaction for performance with 1000+ rows)
    await db.execAsync("BEGIN");
    for (const s of data) {
      const coords = parseLocation(s.location);
      await db.runAsync(
        `INSERT OR REPLACE INTO shelters (id, slug, title, description, location, lat, lon, image_url, image_urls, user_image_urls, google_rating, google_user_ratings_total, google_place_name, google_photo_ref, google_places, booking_url, region, kommune, place, water, toilet, capacity, display_score, area_slug, geofa_raw, seo_description, updated_at, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [s.id, s.slug, s.title, s.description, s.location, coords?.lat ?? null, coords?.lon ?? null, s.image_url, JSON.stringify(s.image_urls), JSON.stringify(s.user_image_urls), s.google_rating, s.google_user_ratings_total, s.google_place_name, s.google_photo_ref, JSON.stringify(s.google_places), s.booking_url, s.region, s.kommune, s.place, s.water, s.toilet, s.capacity, s.display_score, s.area_slug, JSON.stringify(s.geofa_raw), s.seo_description, s.updated_at]
      );
    }
    await db.execAsync("COMMIT");
    await setLastSyncTime(new Date().toISOString());
  }

  return getCachedShelters(db);
}

function parseLocation(location: string | null): { lat: number; lon: number } | null {
  if (!location) return null;
  // POINT(lon lat) format
  const match = location.match(/POINT\(([\d.-]+)\s+([\d.-]+)\)/);
  if (match) return { lon: parseFloat(match[1]), lat: parseFloat(match[2]) };
  return null;
}

async function getCachedShelters(db: SQLite.SQLiteDatabase): Promise<Shelter[]> {
  const rows = await db.getAllAsync<any>("SELECT * FROM shelters ORDER BY display_score DESC");
  return rows.map((r) => ({
    ...r,
    image_urls: r.image_urls ? JSON.parse(r.image_urls) : null,
    user_image_urls: r.user_image_urls ? JSON.parse(r.user_image_urls) : null,
    google_places: r.google_places ? JSON.parse(r.google_places) : null,
    geofa_raw: r.geofa_raw ? JSON.parse(r.geofa_raw) : null,
  }));
}

export function useShelters() {
  return useQuery({
    queryKey: ["shelters"],
    queryFn: syncShelters,
    staleTime: 5 * 60 * 1000, // 5 min before refetch
    gcTime: Infinity, // never garbage collect
  });
}
```

- [ ] **Step 3: Test by showing shelter count from SQLite**

Update map tab to use `useShelters()` and display count:
```tsx
const { data: shelters, isLoading } = useShelters();
// <Text>Shelters: {isLoading ? "Syncer..." : shelters?.length}</Text>
```

Expected: First load fetches from Supabase and caches. Kill app, enable airplane mode, reopen — data still shows from SQLite.

- [ ] **Step 4: Commit**

```bash
git add app/lib/database.ts app/hooks/use-shelters.ts
git commit -m "feat: add SQLite cache layer with Supabase sync for shelters"
```

---

### Task 8: Network State and Offline Banner

Detect connectivity and show offline indicator.

**Files:**
- Create: `app/hooks/use-offline.ts`
- Create: `app/components/OfflineBanner.tsx`
- Modify: `app/app/_layout.tsx` (add banner)

- [ ] **Step 1: Create use-offline.ts**

```typescript
import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  return isOffline;
}
```

- [ ] **Step 2: Create OfflineBanner.tsx**

```tsx
import { View, Text, StyleSheet } from "react-native";
import { useOffline } from "../hooks/use-offline";

export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Du er offline — viser cached data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#f59e0b",
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 3: Add to root layout**

Add `<OfflineBanner />` at the top of the root layout, just inside the providers.

- [ ] **Step 4: Test offline behavior**

Enable airplane mode on device/emulator. Expected: yellow banner appears. Disable: banner disappears.

- [ ] **Step 5: Commit**

```bash
git add app/hooks/use-offline.ts app/components/OfflineBanner.tsx app/app/_layout.tsx
git commit -m "feat: add offline detection and banner component"
```

---

## Phase 3: Core Screens

### Task 9: Mapbox Map Screen

Replace map tab placeholder with full Mapbox map showing shelter markers.

**Files:**
- Create: `app/components/ShelterMap.tsx`
- Modify: `app/app/(tabs)/index.tsx`

**Prerequisites:** Mapbox access token. Create account at mapbox.com and get a public token.

- [ ] **Step 1: Install Mapbox**

```bash
cd app && npx expo install @rnmapbox/maps
```

Add to `app/app.json` plugins:
```json
["@rnmapbox/maps", { "RNMapboxMapsDownloadToken": "YOUR_MAPBOX_SECRET_TOKEN" }]
```

Note: The download token is for fetching the SDK at build time. The public token is used at runtime.

- [ ] **Step 2: Create ShelterMap.tsx**

```tsx
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import type { Shelter } from "@shared/types/shelter";
import { getLocationCoords } from "@shared/lib/shelter-detail";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

interface Props {
  shelters: Shelter[];
  onShelterPress?: (shelter: Shelter) => void;
  userLocation?: { lat: number; lon: number } | null;
}

export function ShelterMap({ shelters, onShelterPress, userLocation }: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  const features: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: shelters
      .map((s) => {
        const coords = getLocationCoords(s);
        if (!coords) return null;
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [coords.lon, coords.lat] },
          properties: { id: s.id, title: s.title, slug: s.slug },
        };
      })
      .filter(Boolean) as GeoJSON.Feature[],
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Outdoors}>
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [10.0, 56.0], // Center of Denmark
            zoomLevel: 6,
          }}
        />

        {userLocation && (
          <Mapbox.UserLocation visible animated />
        )}

        <Mapbox.ShapeSource
          id="shelters"
          shape={features}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
          onPress={(e) => {
            const feature = e.features[0];
            if (feature?.properties?.slug) {
              const shelter = shelters.find((s) => s.slug === feature.properties.slug);
              if (shelter) onShelterPress?.(shelter);
            }
          }}
        >
          <Mapbox.CircleLayer
            id="clusters"
            filter={["has", "point_count"]}
            style={{
              circleColor: "#1a3a2a",
              circleRadius: ["step", ["get", "point_count"], 20, 10, 25, 50, 30],
              circleOpacity: 0.85,
            }}
          />
          <Mapbox.SymbolLayer
            id="cluster-count"
            filter={["has", "point_count"]}
            style={{
              textField: ["get", "point_count_abbreviated"],
              textSize: 14,
              textColor: "#ffffff",
            }}
          />
          <Mapbox.CircleLayer
            id="unclustered-point"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleColor: "#1a3a2a",
              circleRadius: 8,
              circleStrokeWidth: 2,
              circleStrokeColor: "#ffffff",
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
```

- [ ] **Step 3: Wire up map tab**

Replace `app/app/(tabs)/index.tsx`:
```tsx
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ShelterMap } from "../../components/ShelterMap";
import { useShelters } from "../../hooks/use-shelters";

export default function MapTab() {
  const { data: shelters } = useShelters();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ShelterMap
        shelters={shelters ?? []}
        onShelterPress={(s) => router.push(`/shelter/${s.slug}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

- [ ] **Step 4: Test map rendering**

Expected: Map of Denmark with green dots for shelters. Clusters at low zoom. Tapping a dot navigates (will 404 for now — shelter detail not yet built).

- [ ] **Step 5: Commit**

```bash
git add app/components/ShelterMap.tsx app/app/(tabs)/index.tsx
git commit -m "feat: add Mapbox map with shelter markers and clustering"
```

---

### Task 10: Filter Chips on Map

Add facility filter chips above the map.

**Files:**
- Create: `shared/constants/facilities.ts`
- Create: `app/stores/filter-store.ts`
- Create: `app/components/FilterChips.tsx`
- Modify: `app/app/(tabs)/index.tsx`

- [ ] **Step 1: Create shared facility definitions**

Create `shared/constants/facilities.ts`:
```typescript
export interface FacilityFilter {
  key: string;
  label: string;
  icon: string; // lucide icon name
  /** Supabase column or geofa_raw key to filter on */
  filterType: "column" | "geofa";
  filterKey: string;
  filterValue: string;
}

export const FACILITY_FILTERS: FacilityFilter[] = [
  { key: "toilet", label: "Toilet", icon: "Bath", filterType: "column", filterKey: "toilet", filterValue: "Ja" },
  { key: "water", label: "Vand", icon: "Droplets", filterType: "column", filterKey: "water", filterValue: "Ja" },
  { key: "baalplads", label: "Bålplads", icon: "Flame", filterType: "geofa", filterKey: "baal_tilladelse", filterValue: "Ja" },
  { key: "hund", label: "Hund", icon: "Dog", filterType: "geofa", filterKey: "hund_tilladt", filterValue: "Ja" },
  { key: "strand", label: "Strand", icon: "Waves", filterType: "geofa", filterKey: "strand_naerhed", filterValue: "Ja" },
  { key: "bruser", label: "Bruser", icon: "ShowerHead", filterType: "geofa", filterKey: "bruser_bad", filterValue: "Ja" },
  { key: "bookable", label: "Kan bookes", icon: "CalendarCheck", filterType: "column", filterKey: "booking_url", filterValue: "NOT_NULL" },
];
```

- [ ] **Step 2: Create filter store**

Create `app/stores/filter-store.ts`:
```typescript
import { create } from "zustand";

interface FilterState {
  activeFilters: string[];
  toggle: (key: string) => void;
  clear: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  activeFilters: [],
  toggle: (key) =>
    set((state) => ({
      activeFilters: state.activeFilters.includes(key)
        ? state.activeFilters.filter((k) => k !== key)
        : [...state.activeFilters, key],
    })),
  clear: () => set({ activeFilters: [] }),
}));
```

- [ ] **Step 3: Create FilterChips.tsx**

```tsx
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { FACILITY_FILTERS } from "@shared/constants/facilities";
import { useFilterStore } from "../stores/filter-store";

interface FilterChipsProps {
  /** When true, position absolutely over the map. Default false (inline). */
  overlay?: boolean;
}

export function FilterChips({ overlay = false }: FilterChipsProps) {
  const { activeFilters, toggle } = useFilterStore();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.container, overlay && styles.overlay]} contentContainerStyle={styles.content}>
      {FACILITY_FILTERS.map((f) => {
        const active = activeFilters.includes(f.key);
        return (
          <Pressable
            key={f.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(f.key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  overlay: { position: "absolute", top: 8, left: 0, right: 0, zIndex: 10 },
  content: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  chipText: { fontSize: 13, color: "#333" },
  chipTextActive: { color: "#fff" },
});
```

- [ ] **Step 4: Add client-side filtering to map tab**

Update `app/app/(tabs)/index.tsx` to filter shelters based on active filters before passing to map. Filter logic uses `FACILITY_FILTERS` definitions to check shelter columns or `geofa_raw` JSON fields.

- [ ] **Step 5: Test filters**

Expected: Tapping "Toilet" chip highlights it and reduces visible markers. Tapping again removes filter. Multiple filters combine (AND logic).

- [ ] **Step 6: Commit**

```bash
git add shared/constants/facilities.ts app/stores/filter-store.ts app/components/FilterChips.tsx app/app/(tabs)/index.tsx
git commit -m "feat: add facility filter chips on map screen"
```

---

### Task 11: Shelter Detail Screen

Show full shelter information when tapping a marker or list item.

**Files:**
- Create: `app/app/shelter/[slug].tsx`
- Create: `app/hooks/use-shelter-detail.ts`
- Create: `app/lib/image-url.ts`

- [ ] **Step 1: Create image URL helper**

Create `app/lib/image-url.ts`:
```typescript
const PHOTO_PROXY_BASE = "https://shelterdk.dk/api/google-photo";

export function getGooglePhotoUrl(ref: string, maxWidth = 600): string {
  return `${PHOTO_PROXY_BASE}?ref=${encodeURIComponent(ref)}&maxwidth=${maxWidth}`;
}
```

- [ ] **Step 2: Create use-shelter-detail.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getDatabase } from "../lib/database";

export function useShelterDetail(slug: string) {
  return useQuery({
    queryKey: ["shelter", slug],
    queryFn: async () => {
      // Try Supabase first
      const { data, error } = await supabase
        .from("shelters")
        .select("*")
        .eq("slug", slug)
        .single();

      if (data) return data;

      // Fallback to SQLite cache
      const db = await getDatabase();
      const cached = await db.getFirstAsync("SELECT * FROM shelters WHERE slug = ?", [slug]);
      if (cached) {
        return {
          ...cached,
          geofa_raw: cached.geofa_raw ? JSON.parse(cached.geofa_raw) : null,
          image_urls: cached.image_urls ? JSON.parse(cached.image_urls) : null,
          user_image_urls: cached.user_image_urls ? JSON.parse(cached.user_image_urls) : null,
        };
      }

      throw new Error("Shelter not found");
    },
  });
}
```

- [ ] **Step 3: Create shelter detail screen**

Create `app/app/shelter/[slug].tsx`:
```tsx
import { ScrollView, View, Text, Image, StyleSheet, Pressable, Linking } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useShelterDetail } from "../../hooks/use-shelter-detail";
import { getFeatures, getCapacity, getAddress, getLocationCoords } from "@shared/lib/shelter-detail";
import { MapPin, Droplets, Bath, Flame, Dog, ExternalLink } from "lucide-react-native";

export default function ShelterDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: shelter, isLoading, error } = useShelterDetail(slug);

  if (isLoading) return <View style={styles.center}><Text>Henter...</Text></View>;
  if (error || !shelter) return <View style={styles.center}><Text>Shelter ikke fundet</Text></View>;

  const features = getFeatures(shelter);
  const capacity = getCapacity(shelter);
  const address = getAddress(shelter);
  const coords = getLocationCoords(shelter);

  return (
    <>
      <Stack.Screen options={{ title: shelter.title }} />
      <ScrollView style={styles.container}>
        {shelter.image_url && (
          <Image source={{ uri: shelter.image_url }} style={styles.hero} />
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{shelter.title}</Text>

          {address && (
            <View style={styles.row}>
              <MapPin size={16} color="#666" />
              <Text style={styles.address}>{address}</Text>
            </View>
          )}

          {capacity && (
            <Text style={styles.capacity}>Kapacitet: {capacity} pladser</Text>
          )}

          {features.length > 0 && (
            <View style={styles.chips}>
              {features.map((f) => (
                <View key={f.label} style={styles.featureChip}>
                  <Text style={styles.featureText}>{f.label}{f.value ? `: ${f.value}` : ""}</Text>
                </View>
              ))}
            </View>
          )}

          {shelter.description && (
            <Text style={styles.description}>{shelter.description}</Text>
          )}

          {shelter.booking_url && (
            <Pressable
              style={styles.bookingButton}
              onPress={() => Linking.openURL(shelter.booking_url)}
            >
              <ExternalLink size={16} color="#fff" />
              <Text style={styles.bookingText}>Book shelter</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { width: "100%", height: 250 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  address: { fontSize: 14, color: "#666" },
  capacity: { fontSize: 14, color: "#666", marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  featureChip: { backgroundColor: "#e8f0e8", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  featureText: { fontSize: 12, color: "#1a3a2a" },
  description: { fontSize: 15, color: "#333", lineHeight: 22, marginBottom: 16 },
  bookingButton: {
    backgroundColor: "#1a3a2a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 24,
  },
  bookingText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 4: Test shelter detail**

Tap a shelter marker on map → navigates to detail screen with title, image, features, description. Back button returns to map.

- [ ] **Step 5: Commit**

```bash
git add app/app/shelter/ app/hooks/use-shelter-detail.ts app/lib/image-url.ts
git commit -m "feat: add shelter detail screen with offline fallback"
```

---

### Task 12: Explore/Search Tab

Shelter list with search and region sections.

**Files:**
- Create: `app/components/ShelterCard.tsx`
- Modify: `app/app/(tabs)/explore.tsx`

- [ ] **Step 1: Create ShelterCard.tsx**

```tsx
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { Shelter } from "@shared/types/shelter";
import { getDisplayImageUrl, getCapacity, getAddress } from "@shared/lib/shelter-detail";
import { Star, MapPin } from "lucide-react-native";

interface Props {
  shelter: Shelter;
}

export function ShelterCard({ shelter }: Props) {
  const router = useRouter();
  const imageUrl = getDisplayImageUrl(shelter);
  const capacity = getCapacity(shelter);
  const address = getAddress(shelter);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/shelter/${shelter.slug}`)}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>Intet billede</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{shelter.title}</Text>
        {address && (
          <View style={styles.row}>
            <MapPin size={12} color="#999" />
            <Text style={styles.meta} numberOfLines={1}>{address}</Text>
          </View>
        )}
        <View style={styles.row}>
          {shelter.google_rating && (
            <>
              <Star size={12} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.meta}>{shelter.google_rating.toFixed(1)}</Text>
            </>
          )}
          {capacity && <Text style={styles.meta}> · {capacity} pl.</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", marginBottom: 10, elevation: 1 },
  image: { width: 100, height: 80 },
  placeholder: { backgroundColor: "#e5e5e5", justifyContent: "center", alignItems: "center" },
  placeholderText: { fontSize: 11, color: "#999" },
  info: { flex: 1, padding: 10, justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: "#1a3a2a", marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { fontSize: 12, color: "#999" },
});
```

- [ ] **Step 2: Build explore tab with search**

Replace `app/app/(tabs)/explore.tsx`:
```tsx
import { useState, useMemo } from "react";
import { View, TextInput, FlatList, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useShelters } from "../../hooks/use-shelters";
import { ShelterCard } from "../../components/ShelterCard";
import { FilterChips } from "../../components/FilterChips";
import { useFilterStore } from "../../stores/filter-store";
import { FACILITY_FILTERS } from "@shared/constants/facilities";
import type { Shelter } from "@shared/types/shelter";

const REGIONS = ["Jylland", "Fyn", "Sjælland", "Bornholm"];

export default function ExploreTab() {
  const { data: shelters, isLoading } = useShelters();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const { activeFilters } = useFilterStore();

  const filtered = useMemo(() => {
    if (!shelters) return [];
    let result = shelters;

    // Text search
    if (query.length >= 2) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) => s.title?.toLowerCase().includes(q) || s.kommune?.toLowerCase().includes(q) || s.place?.toLowerCase().includes(q)
      );
    }

    // Region filter
    if (region) {
      result = result.filter((s) => s.region === region);
    }

    // Facility filters
    for (const key of activeFilters) {
      const def = FACILITY_FILTERS.find((f) => f.key === key);
      if (!def) continue;
      result = result.filter((s) => {
        if (def.filterType === "column") {
          if (def.filterValue === "NOT_NULL") return !!s[def.filterKey as keyof Shelter];
          return s[def.filterKey as keyof Shelter] === def.filterValue;
        }
        // geofa filter
        const raw = s.geofa_raw as Record<string, unknown> | null;
        return raw?.[def.filterKey] === def.filterValue;
      });
    }

    return result;
  }, [shelters, query, region, activeFilters]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Udforsk shelters</Text>

      <TextInput
        style={styles.search}
        placeholder="Søg shelter, kommune, sted..."
        value={query}
        onChangeText={setQuery}
        placeholderTextColor="#999"
      />

      <View style={styles.regions}>
        {REGIONS.map((r) => (
          <Pressable
            key={r}
            style={[styles.regionChip, region === r && styles.regionActive]}
            onPress={() => setRegion(region === r ? null : r)}
          >
            <Text style={[styles.regionText, region === r && styles.regionTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <FilterChips />

      <Text style={styles.count}>{filtered.length} shelters</Text>

      <FlatList
        data={filtered}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => <ShelterCard shelter={item} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8 },
  search: { margin: 16, padding: 12, backgroundColor: "#fff", borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: "#ddd" },
  regions: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  regionChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  regionActive: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  regionText: { fontSize: 13, color: "#333" },
  regionTextActive: { color: "#fff" },
  count: { paddingHorizontal: 16, fontSize: 13, color: "#999", marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
});
```

Note: `FilterChips` here is used in non-absolute mode. Modify the component to accept an optional `style` prop, or create a variant without `position: absolute` for list usage.

- [ ] **Step 3: Test search and filters**

Expected: Type "bornholm" → shows shelters in Bornholm. Tap "Jylland" → shows Jylland shelters. Combine text + region + facility filters.

- [ ] **Step 4: Commit**

```bash
git add app/components/ShelterCard.tsx app/app/(tabs)/explore.tsx
git commit -m "feat: add explore tab with search, regions, and filters"
```

---

### Task 13: Guides and Blog Tab

Display guides and blog posts from shared data.

**Files:**
- Modify: `app/app/(tabs)/guides.tsx`

**Note:** The guide/blog data lives in `web/data/guides.ts` and `web/data/blog.ts`. These are static data arrays. For v1, copy the data arrays to shared or create a simple API endpoint. The simplest approach: the app fetches guides/blog from the website's rendered JSON, or we move the data files to shared.

- [ ] **Step 1: Move guide/blog data to shared**

```bash
mkdir -p shared/data
cp web/data/guides.ts shared/data/guides.ts
cp web/data/blog.ts shared/data/blog.ts
```

Fix any imports in these files (they should be self-contained — verify no `@/` imports).

Update web copies to re-export from shared:
```typescript
// web/data/guides.ts
export { getGuides, getGuideBySlug, getGuideCategories, GUIDE_CATEGORIES, GUIDES } from "@shared/data/guides";
export type { Guide, GuideCategory } from "@shared/data/guides";
```

Same pattern for `web/data/blog.ts`.

- [ ] **Step 2: Build guides tab**

Replace `app/app/(tabs)/guides.tsx`:
```tsx
import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getGuides, getBlogPosts } from "@shared/data/guides";
import { useRouter } from "expo-router";

type Tab = "guides" | "blog";

export default function GuidesTab() {
  const [tab, setTab] = useState<Tab>("guides");
  const router = useRouter();
  const guides = getGuides();
  const posts = getBlogPosts();

  const items = tab === "guides"
    ? guides.map((g) => ({ slug: g.slug, title: g.title, excerpt: g.excerpt, image: g.coverImage, type: "guide" as const }))
    : posts.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, image: p.coverImage, type: "blog" as const }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Guides & Blog</Text>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "guides" && styles.tabActive]} onPress={() => setTab("guides")}>
          <Text style={[styles.tabText, tab === "guides" && styles.tabTextActive]}>Guides</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "blog" && styles.tabActive]} onPress={() => setTab("blog")}>
          <Text style={[styles.tabText, tab === "blog" && styles.tabTextActive]}>Blog</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => {/* TODO: guide/blog detail screen */}}>
            {item.image && <Image source={{ uri: item.image }} style={styles.cardImage} />}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardExcerpt} numberOfLines={2}>{item.excerpt}</Text>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, marginTop: 12, marginBottom: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  tabActive: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  tabText: { fontSize: 14, color: "#333" },
  tabTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 10, overflow: "hidden", marginBottom: 12, elevation: 1 },
  cardImage: { width: "100%", height: 160 },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1a3a2a", marginBottom: 4 },
  cardExcerpt: { fontSize: 13, color: "#666", lineHeight: 18 },
});
```

- [ ] **Step 3: Test**

Expected: Shows guides list with images and titles. Toggles between guides and blog.

- [ ] **Step 4: Commit**

```bash
git add shared/data/ web/data/guides.ts web/data/blog.ts app/app/(tabs)/guides.tsx
git commit -m "feat: add guides and blog tab with shared data"
```

---

## Phase 4: Native Features

### Task 14: GPS Location and User Position

Add live user position on the map with permission handling.

**Files:**
- Create: `app/hooks/use-location.ts`
- Modify: `app/app/(tabs)/index.tsx`
- Modify: `app/components/ShelterMap.tsx`

- [ ] **Step 1: Create use-location.ts**

```typescript
import { useEffect, useState } from "react";
import * as Location from "expo-location";

interface UserLocation {
  lat: number;
  lon: number;
  accuracy: number | null;
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setLoading(false);
    })();
  }, []);

  return { location, permissionDenied, loading };
}
```

- [ ] **Step 2: Add user location to map**

Update map tab to pass `userLocation` prop to `ShelterMap`. Add a "center on me" floating button.

- [ ] **Step 3: Add UserLocation component to ShelterMap**

In `ShelterMap.tsx`, the `<Mapbox.UserLocation visible animated />` already handles this when location permission is granted.

- [ ] **Step 4: Test**

Expected: Blue pulsing dot at current location. "Center on me" button pans map to user location. Permission dialog appears first time.

- [ ] **Step 5: Commit**

```bash
git add app/hooks/use-location.ts app/app/(tabs)/index.tsx app/components/ShelterMap.tsx
git commit -m "feat: add live user location on map with permission handling"
```

---

### Task 15: GPS Route Tracking

Background location tracking for recording hikes.

**Files:**
- Create: `app/stores/tracking-store.ts`
- Create: `app/app/tracking.tsx`
- Modify: `app/app/(tabs)/routes.tsx`

- [ ] **Step 1: Create tracking store**

```typescript
import { create } from "zustand";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDatabase } from "../lib/database";
import { getDeviceId } from "../lib/device-id";

const TRACKING_TASK = "shelterdk-bg-location";

interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
  accuracy: number | null;
}

interface TrackingState {
  isTracking: boolean;
  points: TrackPoint[];
  startedAt: string | null;
  distanceKm: number;
  durationSeconds: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  addPoint: (point: TrackPoint) => void;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  isTracking: false,
  points: [],
  startedAt: null,
  distanceKm: 0,
  durationSeconds: 0,

  start: async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Baggrundslokation kræves for rute-tracking");
    }

    await Location.startLocationUpdatesAsync(TRACKING_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "ShelterDK",
        notificationBody: "Tracker din rute...",
      },
    });

    set({ isTracking: true, points: [], startedAt: new Date().toISOString(), distanceKm: 0, durationSeconds: 0 });
  },

  stop: async () => {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
    const { points, startedAt } = get();
    const finishedAt = new Date().toISOString();

    // Calculate total distance
    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      totalKm += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    }

    // Save to SQLite
    const db = await getDatabase();
    const deviceId = await getDeviceId();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt!).getTime();

    await db.runAsync(
      "INSERT INTO tracked_routes (device_id, points, distance_km, duration_seconds, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)",
      [deviceId, JSON.stringify(points), totalKm, Math.round(durationMs / 1000), startedAt, finishedAt]
    );

    set({ isTracking: false });
  },

  addPoint: (point) => {
    set((state) => {
      const points = [...state.points, point];
      let distanceKm = state.distanceKm;
      if (points.length > 1) {
        const prev = points[points.length - 2];
        distanceKm += haversineKm(prev.lat, prev.lon, point.lat, point.lon);
      }
      const durationSeconds = state.startedAt
        ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000)
        : 0;
      return { points, distanceKm, durationSeconds };
    });
  },
}));

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Background task handler
TaskManager.defineTask(TRACKING_TASK, ({ data, error }) => {
  if (error) {
    console.error("Background location error:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    for (const loc of locations) {
      useTrackingStore.getState().addPoint({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        timestamp: loc.timestamp,
        accuracy: loc.coords.accuracy,
      });
    }
  }
});
```

Note: `expo-task-manager` must be installed:
```bash
cd app && npx expo install expo-task-manager
```

- [ ] **Step 2: Create tracking screen**

Create `app/app/tracking.tsx` — fullscreen map showing live route as it's tracked. Displays distance, duration, and a stop button.

- [ ] **Step 3: Build routes tab**

Replace `app/app/(tabs)/routes.tsx` with:
- "Start tracking" button at top → navigates to `/tracking`
- "Mine ture" section — FlatList of tracked routes from SQLite
- "Curated ruter" section — list of Naturstyrelsen routes (fetched via TanStack Query)

- [ ] **Step 4: Test tracking**

Start tracking → walk around → stop. Verify: route points saved in SQLite, distance calculated, appears in "Mine ture" list.

- [ ] **Step 5: Commit**

```bash
git add app/stores/tracking-store.ts app/app/tracking.tsx app/app/(tabs)/routes.tsx
git commit -m "feat: add GPS route tracking with background location"
```

---

### Task 16: Offline Map Downloads

Allow users to download map tile packs for offline use.

**Files:**
- Create: `app/stores/download-store.ts`
- Modify: `app/components/ShelterMap.tsx`
- Modify: `app/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create download store**

```typescript
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Mapbox from "@rnmapbox/maps";

interface OfflineRegion {
  name: string;
  bounds: [[number, number], [number, number]]; // SW, NE
  minZoom: number;
  maxZoom: number;
}

const OFFLINE_REGIONS: OfflineRegion[] = [
  { name: "Jylland Nord", bounds: [[8.0, 56.5], [11.0, 57.8]], minZoom: 8, maxZoom: 14 },
  { name: "Jylland Syd", bounds: [[8.0, 54.8], [11.0, 56.5]], minZoom: 8, maxZoom: 14 },
  { name: "Fyn", bounds: [[9.5, 54.9], [11.0, 55.7]], minZoom: 8, maxZoom: 14 },
  { name: "Sjælland", bounds: [[11.0, 54.9], [12.8, 56.2]], minZoom: 8, maxZoom: 14 },
  { name: "Bornholm", bounds: [[14.6, 54.9], [15.2, 55.4]], minZoom: 8, maxZoom: 14 },
];

interface DownloadState {
  downloaded: Record<string, boolean>;
  downloading: string | null;
  progress: number;
  regions: OfflineRegion[];
  startDownload: (regionName: string) => Promise<void>;
  deleteRegion: (regionName: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      downloaded: {},
      downloading: null,
      progress: 0,
      regions: OFFLINE_REGIONS,

      startDownload: async (regionName) => {
        const region = OFFLINE_REGIONS.find((r) => r.name === regionName);
        if (!region) return;

        set({ downloading: regionName, progress: 0 });

        await Mapbox.offlineManager.createPack(
          {
            name: regionName,
            styleURL: Mapbox.StyleURL.Outdoors,
            bounds: region.bounds,
            minZoom: region.minZoom,
            maxZoom: region.maxZoom,
          },
          (pack, status) => {
            if (status.percentage) {
              set({ progress: status.percentage });
            }
            if (status.percentage === 100) {
              set((state) => ({
                downloaded: { ...state.downloaded, [regionName]: true },
                downloading: null,
                progress: 0,
              }));
            }
          },
          (pack, error) => {
            console.error("Download error:", error);
            set({ downloading: null, progress: 0 });
          }
        );
      },

      deleteRegion: async (regionName) => {
        await Mapbox.offlineManager.deletePack(regionName);
        set((state) => {
          const downloaded = { ...state.downloaded };
          delete downloaded[regionName];
          return { downloaded };
        });
      },
    }),
    {
      name: "shelterdk-downloads",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ downloaded: state.downloaded }),
    }
  )
);
```

Note: The Mapbox offline API may differ slightly — verify against `@rnmapbox/maps` documentation at implementation time.

- [ ] **Step 2: Add download button to map**

Add a floating "Download" button on the map screen. When tapped, shows a bottom sheet listing available regions with download/delete toggles and progress bars.

- [ ] **Step 3: Show downloaded regions in profile tab**

Update `app/app/(tabs)/profile.tsx` to list downloaded regions with their sizes and option to delete.

- [ ] **Step 4: Test offline maps**

Download "Bornholm" (smallest region). Enable airplane mode. Pan to Bornholm — tiles still render. Pan elsewhere — tiles blank.

- [ ] **Step 5: Commit**

```bash
git add app/stores/download-store.ts app/components/ShelterMap.tsx app/app/(tabs)/profile.tsx
git commit -m "feat: add offline map tile downloads per region"
```

---

### Task 17: Camera and Photo Upload

Allow users to take/select photos and upload to Supabase Storage.

**Files:**
- Create: `app/components/PhotoUpload.tsx`
- Create: `app/lib/sync-manager.ts`
- Modify: `app/app/shelter/[slug].tsx`

- [ ] **Step 1: Create sync-manager.ts**

```typescript
import { getDatabase } from "./database";
import { supabase } from "./supabase";
import { getDeviceId } from "./device-id";
import NetInfo from "@react-native-community/netinfo";

export async function enqueueSyncAction(type: string, payload: object): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO sync_queue (type, payload) VALUES (?, ?)",
    [type, JSON.stringify(payload)]
  );
  // Try immediate sync
  processSyncQueue();
}

export async function processSyncQueue(): Promise<void> {
  const netInfo = await NetInfo.fetch();
  if (!netInfo.isConnected) return;

  const db = await getDatabase();
  const pending = await db.getAllAsync<{ id: number; type: string; payload: string; attempts: number }>(
    "SELECT * FROM sync_queue WHERE status = 'pending' AND attempts < 10 ORDER BY created_at ASC LIMIT 10"
  );

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload);

      if (item.type === "photo_upload") {
        await uploadPhoto(payload);
      } else if (item.type === "route_sync") {
        await syncRoute(payload);
      }

      await db.runAsync("UPDATE sync_queue SET status = 'done' WHERE id = ?", [item.id]);
    } catch (err) {
      const nextAttempt = item.attempts + 1;
      await db.runAsync(
        "UPDATE sync_queue SET attempts = ?, last_attempt = datetime('now') WHERE id = ?",
        [nextAttempt, item.id]
      );
    }
  }
}

async function uploadPhoto(payload: { shelterId: number; uri: string; caption: string }): Promise<void> {
  const deviceId = await getDeviceId();
  const fileName = `${deviceId}/${Date.now()}.jpg`;

  const response = await fetch(payload.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from("community-photos")
    .upload(fileName, blob, { contentType: "image/jpeg" });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("community-photos")
    .getPublicUrl(fileName);

  const { error: dbError } = await supabase
    .from("community_photos")
    .insert({
      shelter_id: payload.shelterId,
      image_url: publicUrl,
      caption: payload.caption,
      device_id: deviceId,
    });

  if (dbError) throw dbError;
}

async function syncRoute(payload: { points: string; distanceKm: number; durationSeconds: number; startedAt: string; finishedAt: string }): Promise<void> {
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from("tracked_routes")
    .insert({
      device_id: deviceId,
      points: payload.points,
      distance_km: payload.distanceKm,
      duration_seconds: payload.durationSeconds,
      started_at: payload.startedAt,
      finished_at: payload.finishedAt,
    });
  if (error) throw error;
}

// Start periodic sync processing
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncProcessor(): void {
  if (syncInterval) return;
  syncInterval = setInterval(processSyncQueue, 30_000); // every 30s
  processSyncQueue(); // immediate first run
}
```

- [ ] **Step 2: Create PhotoUpload.tsx**

```tsx
import { useState } from "react";
import { View, Text, Pressable, Image, TextInput, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Camera } from "lucide-react-native";
import { enqueueSyncAction } from "../lib/sync-manager";

interface Props {
  shelterId: number;
  onUploadQueued?: () => void;
}

export function PhotoUpload({ shelterId, onUploadQueued }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  const pickImage = async (useCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;

    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Kamera", "ShelterDK skal bruge dit kamera for at tage billeder.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Galleri", "ShelterDK skal have adgang til dine billeder.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    }

    if (result.canceled || !result.assets[0]) return;

    // Compress
    const compressed = await manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    setPreview(compressed.uri);
  };

  const submit = async () => {
    if (!preview) return;
    await enqueueSyncAction("photo_upload", {
      shelterId,
      uri: preview,
      caption,
    });
    setPreview(null);
    setCaption("");
    onUploadQueued?.();
    Alert.alert("Tak!", "Dit billede uploades snart.");
  };

  return (
    <View style={styles.container}>
      {!preview ? (
        <View style={styles.buttons}>
          <Pressable style={styles.button} onPress={() => pickImage(true)}>
            <Camera size={20} color="#1a3a2a" />
            <Text style={styles.buttonText}>Tag foto</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => pickImage(false)}>
            <Text style={styles.buttonText}>Vælg fra galleri</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Image source={{ uri: preview }} style={styles.preview} />
          <TextInput
            style={styles.captionInput}
            placeholder="Tilføj en tekst (valgfrit)"
            value={caption}
            onChangeText={setCaption}
          />
          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={() => setPreview(null)}>
              <Text style={styles.buttonText}>Annuller</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.submitButton]} onPress={submit}>
              <Text style={[styles.buttonText, { color: "#fff" }]}>Upload</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 24 },
  buttons: { flexDirection: "row", gap: 12 },
  button: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
  submitButton: { backgroundColor: "#1a3a2a", borderColor: "#1a3a2a" },
  buttonText: { fontSize: 14, fontWeight: "600", color: "#1a3a2a" },
  preview: { width: "100%", height: 200, borderRadius: 10, marginBottom: 12 },
  captionInput: { padding: 12, backgroundColor: "#fff", borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#ddd" },
});
```

- [ ] **Step 3: Add PhotoUpload to shelter detail**

Add `<PhotoUpload shelterId={shelter.id} />` below the description section in `app/app/shelter/[slug].tsx`.

- [ ] **Step 4: Start sync processor in root layout**

In `app/app/_layout.tsx`, call `startSyncProcessor()` on mount.

- [ ] **Step 5: Test photo upload**

Take photo on shelter detail → "Dit billede uploades snart" → verify it appears in Supabase Storage. Test offline: take photo without internet → reconnect → photo uploads automatically.

- [ ] **Step 6: Commit**

```bash
git add app/lib/sync-manager.ts app/components/PhotoUpload.tsx app/app/shelter/ app/app/_layout.tsx
git commit -m "feat: add camera photo upload with offline queue"
```

---

## Phase 5: Polish & Deploy

### Task 18: Error Boundaries and Sentry

Add crash reporting and per-tab error handling.

**Files:**
- Create: `app/components/ErrorBoundary.tsx`
- Modify: `app/app/_layout.tsx`
- Modify: `app/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Install Sentry**

```bash
cd app && npx expo install @sentry/react-native
```

- [ ] **Step 2: Create ErrorBoundary.tsx**

```tsx
import { Component, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Sentry will auto-capture via its integration
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Noget gik galt</Text>
          <Text style={styles.subtitle}>{this.props.fallbackTitle ?? "Prøv igen eller genstart appen"}</Text>
          <Pressable style={styles.button} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.buttonText}>Prøv igen</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f5f5f0" },
  title: { fontSize: 20, fontWeight: "bold", color: "#1a3a2a", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24, textAlign: "center" },
  button: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#1a3a2a", borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 3: Initialize Sentry in root layout**

```typescript
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
});
```

Wrap root layout export with `Sentry.wrap()`.

- [ ] **Step 4: Wrap each tab with ErrorBoundary**

In `app/app/(tabs)/_layout.tsx`, wrap each tab's component content with `<ErrorBoundary>`.

- [ ] **Step 5: Test error boundary**

Temporarily throw an error in a tab. Expected: "Noget gik galt" UI with retry button.

- [ ] **Step 6: Commit**

```bash
git add app/components/ErrorBoundary.tsx app/app/_layout.tsx app/app/(tabs)/_layout.tsx
git commit -m "feat: add Sentry crash reporting and error boundaries"
```

---

### Task 19: Profile Tab

User's offline data, photos, and settings.

**Files:**
- Modify: `app/app/(tabs)/profile.tsx`

- [ ] **Step 1: Build profile tab**

```tsx
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDownloadStore } from "../../stores/download-store";
import { useEffect, useState } from "react";
import { getDatabase } from "../../lib/database";
import { Download, Trash2, Map, Camera, Route } from "lucide-react-native";

export default function ProfileTab() {
  const { regions, downloaded, downloading, progress, startDownload, deleteRegion } = useDownloadStore();
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [trackedRoutesCount, setTrackedRoutesCount] = useState(0);

  useEffect(() => {
    (async () => {
      const db = await getDatabase();
      const queue = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'");
      setSyncQueueCount(queue?.count ?? 0);
      const routes = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM tracked_routes");
      setTrackedRoutesCount(routes?.count ?? 0);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.header}>Profil</Text>

      {/* Stats */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Route size={20} color="#1a3a2a" />
          <Text style={styles.statNumber}>{trackedRoutesCount}</Text>
          <Text style={styles.statLabel}>Ture</Text>
        </View>
        <View style={styles.stat}>
          <Camera size={20} color="#1a3a2a" />
          <Text style={styles.statNumber}>{syncQueueCount}</Text>
          <Text style={styles.statLabel}>Venter</Text>
        </View>
      </View>

      {/* Offline Maps */}
      <Text style={styles.sectionTitle}>Offline kort</Text>
      {regions.map((r) => (
        <View key={r.name} style={styles.regionRow}>
          <Map size={18} color="#1a3a2a" />
          <Text style={styles.regionName}>{r.name}</Text>
          {downloaded[r.name] ? (
            <Pressable onPress={() => {
              Alert.alert("Slet kort", `Slet offline kort for ${r.name}?`, [
                { text: "Annuller" },
                { text: "Slet", style: "destructive", onPress: () => deleteRegion(r.name) },
              ]);
            }}>
              <Trash2 size={18} color="#ef4444" />
            </Pressable>
          ) : downloading === r.name ? (
            <Text style={styles.progress}>{Math.round(progress)}%</Text>
          ) : (
            <Pressable onPress={() => startDownload(r.name)}>
              <Download size={18} color="#1a3a2a" />
            </Pressable>
          )}
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },
  header: { fontSize: 22, fontWeight: "bold", color: "#1a3a2a", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 },
  stats: { flexDirection: "row", paddingHorizontal: 16, gap: 16, marginBottom: 24 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", gap: 4 },
  statNumber: { fontSize: 24, fontWeight: "bold", color: "#1a3a2a" },
  statLabel: { fontSize: 12, color: "#999" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1a3a2a", paddingHorizontal: 16, marginBottom: 8 },
  regionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  regionName: { flex: 1, fontSize: 15, color: "#333" },
  progress: { fontSize: 13, color: "#1a3a2a", fontWeight: "600" },
});
```

- [ ] **Step 2: Test**

Expected: Shows ture count, pending sync count, and offline map regions with download/delete buttons.

- [ ] **Step 3: Commit**

```bash
git add app/app/(tabs)/profile.tsx
git commit -m "feat: add profile tab with offline maps and stats"
```

---

### Task 20: EAS Build and Play Store Setup

Configure EAS Build for generating a signed Android APK/AAB.

**Files:**
- Create: `app/eas.json`
- Modify: `app/app.json` (add EAS project ID)

- [ ] **Step 1: Install EAS CLI**

```bash
npm install -g eas-cli
```

- [ ] **Step 2: Log in and initialize**

```bash
cd app
eas login
eas init
```

This creates an EAS project and adds `extra.eas.projectId` to `app.json`.

- [ ] **Step 3: Create eas.json**

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./play-store-key.json" }
    }
  }
}
```

- [ ] **Step 4: Build preview APK**

```bash
cd app && eas build --platform android --profile preview
```

Expected: EAS builds in the cloud. Download APK and install on device for testing.

- [ ] **Step 5: Build production AAB**

```bash
cd app && eas build --platform android --profile production
```

Expected: Signed AAB ready for Play Store upload.

- [ ] **Step 6: Commit**

```bash
git add app/eas.json app/app.json
git commit -m "feat: configure EAS Build for Android builds"
```

---

## Phase 6: Verification Checkpoint

### Task 21: End-to-End Verification

Manual testing checklist before Play Store submission.

- [ ] **Step 1: Fresh install test**

Install production APK on a device with no prior data. Verify:
- First launch downloads shelter data (~2-5 MB)
- Map shows shelter markers across Denmark
- Filters reduce visible markers correctly

- [ ] **Step 2: Offline test**

Download "Bornholm" offline tiles. Enable airplane mode. Verify:
- Offline banner appears
- Map tiles render for Bornholm
- Shelter detail screens load from cache
- Photo upload gets queued (not lost)
- Disable airplane mode → queued upload completes

- [ ] **Step 3: GPS tracking test**

Start route tracking. Walk 100m. Stop tracking. Verify:
- Route appears in "Mine ture"
- Distance is approximately correct
- Background tracking works with app minimized

- [ ] **Step 4: Camera test**

Open shelter detail → take photo → upload. Verify:
- Photo appears in Supabase Storage
- Photo entry created in community_photos table

- [ ] **Step 5: Navigation test**

Verify all 5 tabs work. Navigate to shelter detail from both map (tap marker) and explore (tap card). Back navigation works. Swipe-back gesture works.

- [ ] **Step 6: Error handling test**

Kill network mid-request. Verify: error message shown, not a crash. Sentry receives test event.

- [ ] **Step 7: Document results and fix any issues**

Create `docs/superpowers/test-results/2026-XX-XX-android-e2e.md` with test results.

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Foundation | 1-5 | Monorepo, shared code, Expo scaffold, navigation |
| 2. Data Layer | 6-8 | Supabase client, SQLite cache, offline detection |
| 3. Core Screens | 9-13 | Map, filters, shelter detail, explore, guides |
| 4. Native Features | 14-17 | GPS location, route tracking, offline maps, camera |
| 5. Polish & Deploy | 18-20 | Error handling, profile tab, EAS Build |
| 6. Verification | 21 | End-to-end manual testing |

**Total: 21 tasks.** Each task produces a working, committable increment.

### Deferred to post-v1

- `omrade/[slug]` screen (area detail page) — add when area browsing gets user traction
- Deep linking with `.well-known/assetlinks.json` — add before Play Store submission
- OTA updates via `expo-updates` — configure after first Play Store release
- Mapbox offline API: verify `@rnmapbox/maps` v10+ TileStore API at implementation time (Task 16 code may need adapting)
