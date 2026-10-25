import { describe, expect, it } from "vitest";
import { referrerVaert, kildeFor, utmFraSti } from "@/lib/henvisningskilde";

describe("referrerVaert", () => {
  it("tager vaertsnavnet og intet andet", () => {
    // Kun vaerten gemmes. Stien og forespoergselsstrengen kan baere data om
    // en person, og de er ikke noedvendige for at skelne kanalerne.
    expect(referrerVaert("https://www.chatgpt.com/c/abc-123?q=sovepose")).toBe("chatgpt.com");
    expect(referrerVaert("https://www.google.dk/search?q=bedste+sovepose")).toBe("google.dk");
  });

  it("taaler en tom eller ugyldig referrer", () => {
    expect(referrerVaert("")).toBeNull();
    expect(referrerVaert(null)).toBeNull();
    expect(referrerVaert("ikke en url")).toBeNull();
  });
});

describe("kildeFor", () => {
  it("genkender AI-assistenter paa vaertsnavnet", () => {
    // Det er hele pointen: Claude og Gemini tilfoejer ofte ingen utm, saa
    // deres henvisninger taltes som direkte trafik.
    for (const v of ["claude.ai", "gemini.google.com", "chatgpt.com", "perplexity.ai", "copilot.microsoft.com"]) {
      expect(kildeFor(v), v).toBe("ai");
    }
  });

  it("genkender AI-assistenter paa utm-kilden", () => {
    expect(kildeFor(null, "chatgpt.com")).toBe("ai");
    expect(kildeFor(null, "perplexity")).toBe("ai");
    expect(kildeFor(null, "copilot.com")).toBe("ai");
  });

  it("skelner soegemaskine fra AI", () => {
    expect(kildeFor("google.com")).toBe("soegemaskine");
    expect(kildeFor("bing.com")).toBe("soegemaskine");
    // Copilot bygger paa Bing, men en henvisning FRA bing.com er en
    // resultatliste og ikke et sprogmodel-svar.
    expect(kildeFor("bing.com", "bing")).toBe("soegemaskine");
  });

  it("tager underdomaener med, men ikke navne der blot ender ens", () => {
    expect(kildeFor("chat.openai.com")).toBe("ai");
    expect(kildeFor("ikke-chatgpt.com")).toBe("andet");
    expect(kildeFor("notgoogle.com")).toBe("andet");
  });

  it("kalder egne sider internt, saa de ikke taelles som en kanal", () => {
    expect(kildeFor("shelterdk.dk")).toBe("internt");
    expect(kildeFor("www.shelterdk.dk")).toBe("internt");
  });

  it("giver ukendt naar der ingen referrer er", () => {
    expect(kildeFor(null)).toBe("ukendt");
    expect(kildeFor("")).toBe("ukendt");
  });

  it("laader utm-kilden veje tungest", () => {
    // Assistentens egen maerkning af linket slaar vaerten, fordi et klik kan
    // gaa gennem en mellemside.
    expect(kildeFor("t.co", "chatgpt.com")).toBe("ai");
  });
});

describe("utmFraSti", () => {
  it("finder kilden i den sti vi gemmer", () => {
    expect(utmFraSti("/bedste/sovepose?utm_source=chatgpt.com")).toBe("chatgpt.com");
    expect(utmFraSti("/bedste/sovepose?fra=shelter&utm_source=perplexity")).toBe("perplexity");
  });

  it("giver null uden forespoergselsstreng", () => {
    expect(utmFraSti("/bedste/sovepose")).toBeNull();
    expect(utmFraSti(null)).toBeNull();
  });
});
