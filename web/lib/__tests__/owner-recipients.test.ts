import { describe, it, expect } from "vitest";
import { ownerRecipients, parseNotifyEmailsInput } from "../booking-email";

/**
 * Ejer-notifikationer kan gå til flere adresser (ønsket fra ejeren af Legind
 * Bjerge, aug 2026). De ekstra adresser bor i `bookable_shelters.notify_emails`
 * og må ALDRIG lægges i `owner_email` — dét felt er identitetsnøgle for login og
 * ejer-claim, og ændres det, nulstilles `auth_user_id`.
 */
describe("ownerRecipients", () => {
  it("sender kun til ejeren når der ikke er ekstra modtagere", () => {
    expect(ownerRecipients("lene@eksempel.dk", null)).toEqual(["lene@eksempel.dk"]);
    expect(ownerRecipients("lene@eksempel.dk", [])).toEqual(["lene@eksempel.dk"]);
  });

  it("lægger ekstra modtagere til — ejeren står først", () => {
    expect(ownerRecipients("lene@eksempel.dk", ["forening@eksempel.dk"])).toEqual([
      "lene@eksempel.dk",
      "forening@eksempel.dk",
    ]);
  });

  it("dedupliker, så samme adresse i begge felter kun giver én mail", () => {
    expect(
      ownerRecipients("lene@eksempel.dk", ["Lene@Eksempel.dk", "forening@eksempel.dk"])
    ).toEqual(["lene@eksempel.dk", "forening@eksempel.dk"]);
  });

  it("normaliserer store bogstaver og mellemrum", () => {
    // Ejeren skrev adressen med stort L i sms'en; Gmail er case-insensitivt,
    // men vi vil ikke sende to mails til det der reelt er samme postkasse.
    expect(ownerRecipients("  Lene@Eksempel.DK  ", [" Forening@Eksempel.dk "])).toEqual([
      "lene@eksempel.dk",
      "forening@eksempel.dk",
    ]);
  });

  it("frasorterer ugyldige og tomme værdier i stedet for at fejle afsendelsen", () => {
    expect(
      ownerRecipients("lene@eksempel.dk", ["", "   ", "ikke-en-email", "ok@eksempel.dk"])
    ).toEqual(["lene@eksempel.dk", "ok@eksempel.dk"]);
  });

  it("returnerer tom liste hvis ejer-adressen er ubrugelig", () => {
    // Kaldes stadig — sendLoggedEmail sender ikke til en tom modtagerliste.
    expect(ownerRecipients("", null)).toEqual([]);
    expect(ownerRecipients("ikke-en-email", null)).toEqual([]);
  });
});

/** Admin-feltet "Ekstra notifikationsmails". */
describe("parseNotifyEmailsInput", () => {
  const OWNER = "lene@eksempel.dk";

  it("splitter på komma, semikolon og linjeskift", () => {
    const r = parseNotifyEmailsInput("a@x.dk, b@x.dk; c@x.dk\nd@x.dk", OWNER);
    expect(r.emails).toEqual(["a@x.dk", "b@x.dk", "c@x.dk", "d@x.dk"]);
    expect(r.invalid).toEqual([]);
  });

  it("frasorterer ejerens egen adresse — den er allerede modtager", () => {
    const r = parseNotifyEmailsInput(`${OWNER}, forening@x.dk`, OWNER);
    expect(r.emails).toEqual(["forening@x.dk"]);
  });

  it("melder ugyldige adresser tilbage frem for at smide dem væk stille", () => {
    // En tabt adresse betyder at ejeren aldrig får sine notifikationer, så
    // kaldestedet skal kunne afvise med en brugbar fejl.
    const r = parseNotifyEmailsInput("god@x.dk, ikke-en-email, @også-skæv", OWNER);
    expect(r.emails).toEqual(["god@x.dk"]);
    expect(r.invalid).toEqual(["ikke-en-email", "@også-skæv"]);
  });

  it("dedupliker og normaliserer", () => {
    const r = parseNotifyEmailsInput(" Forening@X.dk , forening@x.dk ", OWNER);
    expect(r.emails).toEqual(["forening@x.dk"]);
  });

  it("håndterer tomt felt som 'ingen ekstra modtagere'", () => {
    expect(parseNotifyEmailsInput("", OWNER)).toEqual({ emails: [], invalid: [] });
    expect(parseNotifyEmailsInput("  ,  ; ", OWNER)).toEqual({ emails: [], invalid: [] });
    expect(parseNotifyEmailsInput(undefined, OWNER)).toEqual({ emails: [], invalid: [] });
  });

  it("accepterer også et array (API kan kaldes programmatisk)", () => {
    const r = parseNotifyEmailsInput(["a@x.dk", "B@X.dk"], OWNER);
    expect(r.emails).toEqual(["a@x.dk", "b@x.dk"]);
  });
});
