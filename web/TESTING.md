# Testing

## Kør tests

```bash
npm run test        # Kør alle tests én gang
npm run test:watch  # Kør tests i watch-mode (genkører ved ændringer)
```

## Teststruktur

- **Vitest** bruges til unit tests
- Tests ligger i `lib/__tests__/` ved siden af den kode, de tester
- Filer hedder `*.test.ts` eller `*.test.tsx`

## Hvad testes

- `lib/soeg-filters.ts` – `filterSheltersByRegion` (regionfiltrering på Jylland/Sjælland-sider)
- `lib/slug.ts` – `slugifySegment`, `segmentSlugToName`
- `lib/relative-time-da.ts` – `formatRelativeTimeDa`
- `components/CookieBanner.tsx` – samtykkevalg, gem i localStorage, vis GTM kun ved accept
- `app/api/collect/route.ts` – returner 204 ved accept, send page_view til GA4 ved necessary

## Pre-commit hook

Når du committer (efter `git init`), kører Husky automatisk:

1. **lint-staged** – ESLint på staged `.ts`/`.tsx` filer
2. **npm run test** – alle Vitest-tests

Hvis enten fejler, bliver commit blokeret.

## Tilføj nye tests

Opret fx `lib/__tests__/min-modul.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { minFunktion } from "../min-modul";

describe("minFunktion", () => {
  it("gør det forventede", () => {
    expect(minFunktion("input")).toBe("output");
  });
});
```
