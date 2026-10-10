import { describe, expect, it } from "vitest";
import { INTERNAL_EVENTS, TRACKABLE_EVENTS } from "@/lib/internal-events";

/**
 * /api/track har to porte: først afvises alt der ikke står i TRACKABLE_EVENTS
 * med 400, derefter skrives delmængden i INTERNAL_EVENTS til Supabase. Et
 * event der kun står på den anden liste bliver afvist, før det når basen — og
 * resultatet er en tabel uden rækker, hvilket ser nøjagtig ud som "ingen
 * udløste eventet". gear_block_seen blev tilføjet sådan og ville have målt nul
 * visninger af grej-blokken, altså netop den konklusion eventet skulle
 * modbevise.
 */
describe("event-vokabular", () => {
  it("accepterer hvert event der skal skrives til internal_events", () => {
    const afvist = [...INTERNAL_EVENTS].filter((e) => !TRACKABLE_EVENTS.has(e));
    expect(afvist, `afvises af /api/track før de kan gemmes: ${afvist.join(", ")}`)
      .toEqual([]);
  });

  it("holder internal_events som en ægte delmængde", () => {
    expect(INTERNAL_EVENTS.size).toBeLessThan(TRACKABLE_EVENTS.size);
  });
});
