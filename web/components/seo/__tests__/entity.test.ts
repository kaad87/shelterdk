import { describe, it, expect } from "vitest";
import { ORGANIZATION_REF, ORGANIZATION_ID } from "@/components/seo/organization";

describe("organisation-entiteten", () => {
  it("refereres med @id, så alle sider peger på den samme entitet", () => {
    expect(ORGANIZATION_ID).toBe("https://shelterdk.dk#organization");
    expect(ORGANIZATION_REF).toEqual({ "@id": "https://shelterdk.dk#organization" });
  });
});
