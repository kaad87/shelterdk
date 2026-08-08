import { describe, it, expect } from "vitest";
import { ownerRecipients } from "../booking-email";

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
