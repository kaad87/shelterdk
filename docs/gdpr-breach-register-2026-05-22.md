# Intern dokumentation af databrud — 22. maj 2026

> **Status:** Lukket internt. Ikke anmeldt til Datatilsynet efter risikovurdering.
>
> Denne fil opfylder dokumentationspligten i **GDPR Artikel 33, stk. 5**:
> "Den dataansvarlige skal dokumentere ethvert brud på persondatasikkerheden,
> herunder de faktiske omstændigheder ved bruddet, dets virkninger og de
> trufne afhjælpende foranstaltninger."

## 1. Identifikation

| Felt | Værdi |
|------|-------|
| **Dataansvarlig** | ShelterDK (CVR: indsæt CVR) |
| **Kontaktperson** | Christian Kaad Andersen — kaad87@gmail.com |
| **Brud-ID (intern)** | SDK-BREACH-2026-05-22-001 |
| **Opdaget af** | Egen sikkerhedsaudit (intern, ikke ekstern rapport) |
| **Opdaget den** | 22. maj 2026 |
| **Anmeldt til Datatilsynet?** | **Nej** — se afsnit 6 (risikovurdering) |

## 2. Hvad skete

Under en intern sikkerhedsaudit blev det opdaget at **Row Level Security (RLS)** ikke var aktiveret på et antal Supabase-tabeller, som indeholder personoplysninger. Disse tabeller var derfor potentielt læsbare via det offentlige `anon`-API-nøglepar, der distribueres som del af klientkoden.

Det er **ikke konstateret** at uautoriseret tredjepart faktisk har tilgået data. Audit-loggen for `anon`-queries er ikke aktiveret i Supabase, så det kan ikke endeligt udelukkes.

## 3. Berørte tabeller og datatyper

| Tabel | Personoplysninger | Antal rækker på opdagelsestidspunkt |
|-------|-------------------|------------------------------------|
| `shelter_bookings` | guest_email, guest_name, message, bookingdatoer | 28 |
| `contact_messages` | name, email, message | ~15 (kontaktformular-henvendelser) |
| `owner_claim_tokens` | owner_email, token | ~30 (de fleste udløbet pga. 7-dages TTL) |
| `community_submissions` | submitter_email, navn | < 10 |

**Ingen** eksponering af: passwords, kreditkortdata, CPR-numre, sundhedsdata, eller andre særlige kategorier af persondata jf. GDPR Artikel 9.

## 4. Hvor længe var tilstanden eksisterende

Tilstanden eksisterede potentielt fra projektets opstart frem til 22. maj 2026 (samme dag den blev opdaget og lukket).

## 5. Afhjælpende foranstaltninger

| Tiltag | Hvornår | Reference |
|--------|---------|-----------|
| RLS aktiveret på alle berørte tabeller | 22. maj 2026 | migration `045_complete_rls_lockdown.sql` |
| Anon-nøglens skriverettigheder fjernet fra `contact_messages` (nu via admin client) | 22. maj 2026 | commit `e13e3f21` |
| Eventuelle ubrugte `owner_claim_tokens` udstedt før 045 rotereret | 23. maj 2026 | (manuel SQL — se README) |
| Periodisk RLS-test indført som del af `npm test` (TODO) | Planlagt | — |

## 6. Risikovurdering (jf. Artikel 33, stk. 1)

Vurderingen efter [Datatilsynets vejledning om risiko ved brud](https://www.datatilsynet.dk/) og **EDPB Guidelines 9/2022 on personal data breach notification**:

### Sandsynlighed for misbrug
**Lav.** Forudsætter at angriber:
1. kender til ShelterDK,
2. ved at Supabase anvendes som backend,
3. henter anon-nøglen ud af klientkoden,
4. kender tabelstruktur,
5. eksekverer `SELECT *` på de relevante tabeller.

Ingen konkrete tegn på at dette er sket. Ingen henvendelser fra registrerede om spam/phishing relateret til ShelterDK.

### Konsekvens hvis misbrugt
**Lav til moderat.** Data er primært kontaktoplysninger + bookingdatoer. Ingen finansielle, biometriske eller sundhedsdata. Worst case: målrettet phishing mod 28 personer.

`owner_claim_tokens` ville give midlertidig adgang til ejer-portalen for det specifikke shelter, men tokens har **7-dages TTL** og er reaktivt rotereret.

### Konklusion
"Det er **usandsynligt at bruddet medfører en risiko** for fysiske personers rettigheder og frihedsrettigheder" jf. Artikel 33, stk. 1 *in fine*. **Anmeldelse til Datatilsynet er derfor ikke obligatorisk.**

Bruddet dokumenteres internt i nærværende fil jf. Artikel 33, stk. 5.

### Underrettelse af registrerede (Artikel 34)
Ikke gennemført, da bruddet vurderes ikke at medføre **høj risiko** for de registrerede jf. Artikel 34, stk. 1.

## 7. Lessons learned & forebyggelse

- RLS skal være **default-on** ved oprettelse af nye tabeller. Tilføj checklist-punkt til migration-template.
- Eksisterende cron-/job-test (test-suite) skal udvides med en automatisk RLS-coverage-test der fejler hvis en tabel uden RLS oprettes.
- Anon-nøglen skal kun have `SELECT` på eksplicit allow-listede tabeller — verificeret post-045.

## 8. Underskrift

| Rolle | Navn | Dato |
|-------|------|------|
| Dataansvarlig | Christian Kaad Andersen | 23. maj 2026 |

---

*Dette dokument opbevares i mindst 5 år (intern proces — der er ingen lovbestemt opbevaringsfrist for selve brud-registret, men længere opbevaring beskytter mod efterfølgende krav)*.
