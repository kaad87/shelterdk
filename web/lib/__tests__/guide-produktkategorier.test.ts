import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { kodeKategorier } from "@/lib/kategori-labels";

/**
 * Vagten mod at guidernes produktkategorier sejler igen.
 *
 * buying_guides.product_categories peger paa
 * affiliate_products.category_mapped. Kolonnen er blevet forkert to gange,
 * fordi intet bandt de to sider sammen: migration 059 fyldte den, fase 2
 * omdoebte kategorierne, og ingen test faldt. Fire toejguider stod derefter
 * paa 'beklaedning' i et aar.
 *
 * Her laeses den SENESTE migration, der saetter feltet, og hver vaerdi holdes
 * op mod de kategorier, koden selv kan skrive paa en vare. Omdoeber nogen en
 * kategori uden at rette migrationen, faelder det her i stedet for at blive
 * en tom produktsoegning i admin.
 */
function senesteKategoriMigration(): string {
  const dir = join(__dirname, "../../../migrations");
  const fil = readdirSync(dir)
    .filter((f) => /^\d+_buying_guides_product_categories/.test(f))
    .sort()
    .pop();
  if (!fil) throw new Error("fandt ingen product_categories-migration");
  return readFileSync(join(dir, fil), "utf8");
}

/** Kategorierne i migrationens array[...]-udtryk. */
function kategorierIMigration(sql: string): string[] {
  const ud: string[] = [];
  for (const m of sql.matchAll(/array\[([^\]]+)\]/gi)) {
    for (const d of m[1].matchAll(/'([^']+)'/g)) ud.push(d[1]);
  }
  return [...new Set(ud)];
}

describe("buying_guides.product_categories", () => {
  const sql = senesteKategoriMigration();
  const brugte = kategorierIMigration(sql);

  it("finder kategorier i migrationen", () => {
    expect(brugte.length).toBeGreaterThan(20);
  });

  it("bruger kun kategorier koden selv kan tildele", () => {
    const kendte = new Set(kodeKategorier());
    expect(brugte.filter((k) => !kendte.has(k))).toEqual([]);
  });

  it("naevner ikke den gamle samle-kategori beklaedning", () => {
    // Fase 2 delte den op i hue, handsker, gamacher og undertoj.
    expect(brugte).not.toContain("beklædning");
    expect(brugte).not.toContain("beklaedning");
  });

  it("giver hver guide i migrationen mindst én kategori", () => {
    for (const m of sql.matchAll(/\('([a-z0-9-]+)',\s*array\[([^\]]*)\]\)/gi)) {
      expect(m[2].trim().length, m[1]).toBeGreaterThan(0);
    }
  });
});
