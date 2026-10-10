import { describe, it, expect } from "vitest";
import { guideHealth, type HealthInput } from "@/lib/guide-health";

const NOW = new Date("2026-09-21T12:00:00Z");
const base: HealthInput = {
  slug: "telt",
  lastReviewedAt: "2026-09-01",
  entries: [
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: "Vores valg", retailer: "backpackerlife" },
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "backpackerlife" },
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outmore" },
    { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outdoortid" },
  ],
};

describe("guideHealth", () => {
  it("melder alt godt når produkterne er på lager og gennemgangen er frisk", () => {
    const h = guideHealth(base, NOW);
    expect(h.dead).toBe(0);
    expect(h.problems).toEqual([]);
  });

  it("tæller udsolgte og blokerede som døde", () => {
    const h = guideHealth({ ...base, entries: [
      { inStock: false, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outmore" },
      { inStock: true, isBlocked: true, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outmore" },
      ...base.entries.slice(2),
    ] }, NOW);
    expect(h.dead).toBe(2);
  });

  it("advarer når guiden har under fire produkter der kan købes", () => {
    const h = guideHealth({ ...base, entries: base.entries.map((e, i) => (i < 2 ? { ...e, inStock: false } : e)) }, NOW);
    expect(h.problems).toContain("kun 2 produkter kan købes");
  });

  it("advarer om produkter der har været ude af feedet længe", () => {
    const h = guideHealth({ ...base, entries: [{ ...base.entries[0], inStock: false, lastSeenAt: "2026-04-12" }, ...base.entries.slice(1)] }, NOW);
    expect(h.problems.some((p) => /afmeldt/.test(p))).toBe(true);
  });

  it("advarer når gennemgangen er over 120 dage gammel", () => {
    const h = guideHealth({ ...base, lastReviewedAt: "2026-04-01" }, NOW);
    expect(h.problems.some((p) => /gennemgået/.test(p))).toBe(true);
  });

  it("tier om prædikater på udsolgte varer — resolveAwards fjerner dem ved render", () => {
    // Blev tidligere meldt som et problem og udløste på 10 af 30 guider. Et
    // vagtjob der mailer hver dag om noget brugeren ikke kan se, bliver
    // ignoreret, og så fanger det heller ikke det der betyder noget.
    const h = guideHealth({ ...base, entries: [
      { ...base.entries[0], inStock: false },
      ...base.entries.slice(1),
    ] }, NOW);
    expect(h.problems.some((p) => /prædikat/.test(p))).toBe(false);
  });

  it("advarer når siden ikke kan vise et førstevalg", () => {
    // resolveAwards giver topprædikatet til den højest scorende vare på lager
    // UDEN prædikat. Har alle et, er der ingen arvtager, og siden står uden
    // "Vores valg". Det skete på tarp, telt og drikkedunk, da de afmeldte
    // varer med topprædikatet blev slettet.
    const h = guideHealth({ ...base, entries: [
      { ...base.entries[0], inStock: false, awardLabel: "Vores valg" },
      { ...base.entries[1], awardLabel: "Bedst til prisen" },
      { ...base.entries[2], awardLabel: "Bedste letvægt" },
      { ...base.entries[3], awardLabel: "Bedste premium" },
    ] }, NOW);
    expect(h.problems.some((p) => /f[øo]rstevalg/.test(p))).toBe(true);
    expect(h.canShowTopAward).toBe(false);
  });

  it("tier når en vare på lager kan arve førstevalget", () => {
    const h = guideHealth({ ...base, entries: [
      { ...base.entries[0], inStock: false, awardLabel: "Vores valg" },
      ...base.entries.slice(1),
    ] }, NOW);
    expect(h.canShowTopAward).toBe(true);
    expect(h.problems.some((p) => /f[øo]rstevalg/.test(p))).toBe(false);
  });

  it("tier når førstevalget allerede sidder på en vare der kan købes", () => {
    expect(guideHealth(base, NOW).canShowTopAward).toBe(true);
  });

  it("markerer koncentration som en risiko, men alarmerer ikke om den", () => {
    // 25 af 30 guider overskrider grænsen i dag. Stod den i problems, ville
    // vagtjobbet maile om dem alle hver morgen og blive slået fra.
    const h = guideHealth({ ...base, entries: base.entries.map((e) => ({ ...e, retailer: "outmore" })) }, NOW);
    expect(h.topRetailerShare).toBe(1);
    expect(h.concentrationRisk).toBe(true);
    expect(h.problems).toEqual([]);
  });

  it("markerer ikke risiko når forhandlerne er spredt", () => {
    const h = guideHealth(base, NOW);
    expect(h.topRetailerShare).toBeCloseTo(0.5);
    expect(h.concentrationRisk).toBe(false);
  });

  it("måler koncentrationen på det der kan købes, ikke på det der er dødt", () => {
    // Tre hos outmore er udsolgte; den eneste levende vare er hos backpackerlife,
    // så guiden hænger reelt på backpackerlife — ikke på outmore.
    const h = guideHealth({ ...base, entries: [
      { inStock: true, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "backpackerlife" },
      { inStock: false, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outmore" },
      { inStock: false, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outmore" },
      { inStock: false, isBlocked: false, lastSeenAt: "2026-09-21", awardLabel: null, retailer: "outmore" },
    ] }, NOW);
    expect(h.topRetailer).toBe("backpackerlife");
    expect(h.topRetailerShare).toBe(1);
  });

  it("melder hvor meget der ville være tilbage hvis den største forhandler forsvandt", () => {
    // Det var sådan campingstol døde: alle fem hos outmore på én gang.
    const h = guideHealth({ ...base, entries: base.entries.map((e) => ({ ...e, retailer: "outmore" })) }, NOW);
    expect(h.survivesTopRetailerLoss).toBe(0);
    expect(guideHealth(base, NOW).survivesTopRetailerLoss).toBe(2);
  });

  it("tæller ikke en manglende forhandler som en koncentration", () => {
    const h = guideHealth({ ...base, entries: base.entries.map((e) => ({ ...e, retailer: null })) }, NOW);
    expect(h.topRetailer).toBeNull();
    expect(h.problems.some((p) => /forhandler/.test(p))).toBe(false);
  });

  it("markerer enkelt-forhandler-risiko når under to varer ville overleve", () => {
    // Det var campingstols tilstand: alle varer hos outmore, nul tilbage da
    // rækken forsvandt.
    const alle = guideHealth({ ...base, entries: base.entries.map((e) => ({ ...e, retailer: "outmore" })) }, NOW);
    expect(alle.survivesTopRetailerLoss).toBe(0);
    expect(alle.singleRetailerRisk).toBe(true);

    // Én overlevende er stadig for få — en enkelt vare er ikke en guide.
    const en = guideHealth({ ...base, entries: [
      { ...base.entries[0], retailer: "outmore" },
      { ...base.entries[1], retailer: "outmore" },
      { ...base.entries[2], retailer: "outmore" },
      { ...base.entries[3], retailer: "backpackerlife" },
    ] }, NOW);
    expect(en.singleRetailerRisk).toBe(true);
  });

  it("er tilfreds med to overlevende, også når andelen er høj", () => {
    // Pointen: andelen må gerne være skæv, så længe guiden ikke kan gå i nul.
    const h = guideHealth({ ...base, entries: [
      { ...base.entries[0], retailer: "backpackerlife" },
      { ...base.entries[1], retailer: "backpackerlife" },
      { ...base.entries[2], retailer: "outmore" },
      { ...base.entries[3], retailer: "outdoortid" },
    ] }, NOW);
    expect(h.survivesTopRetailerLoss).toBe(2);
    expect(h.singleRetailerRisk).toBe(false);
  });
});
