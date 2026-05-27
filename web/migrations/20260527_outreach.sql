-- Outreach til potentielle bookingsystem-kunder
--
-- Bruges fra /admin/outreach til at sende personlige mails til ejere af
-- shelters der endnu ikke bruger ShelterDK's bookingsystem. Følger samme
-- review-queue-pattern som booking-kandidaterne.

-- Editable template (én række, id='default').
create table if not exists public.outreach_templates (
  id text primary key default 'default',
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Per-shelter outreach-status. Bruges til at huske hvem der er kontaktet,
-- så vi ikke spammer + så vi kan filtrere køen.
create table if not exists public.outreach_review (
  shelter_id uuid primary key references public.shelters(id) on delete cascade,
  status text not null check (status in ('sent', 'replied', 'not_relevant', 'needs_research')),
  recipient_email text,
  recipient_name text,
  notes text,
  sent_at timestamptz,
  reviewed_at timestamptz not null default now()
);

create index if not exists outreach_review_status_idx
  on public.outreach_review(status);
create index if not exists outreach_review_sent_at_idx
  on public.outreach_review(sent_at desc);

-- Service-role only. Aktiver RLS uden policies.
alter table public.outreach_templates enable row level security;
alter table public.outreach_review enable row level security;

-- Indsæt default-template (Christians outreach-tekst).
insert into public.outreach_templates (id, subject, body)
values (
  'default',
  '{shelter_title} – tilbud om gratis bookingsystem til jeres shelter',
  $TPL$Hej {recipient_name}

Jeg hedder Christian og driver platformen ShelterDK.dk. Vores mission er ret simpel: Vi vil skabe et samlet, overskueligt overblik over Danmarks mange shelters, så det bliver nemmere for danskerne at komme ud og nyde naturen. (Du kan evt. læse lidt mere om tankerne bag projektet i denne artikel fra Politiken): https://politiken.dk/rejser/art10803977/Holder-du-af-sheltere-er-det-her-m%C3%A5ske-nyheden-du-har-ventet-p%C3%A5

Jeg skriver til jer i dag, fordi vi har rigtig mange brugere, der kigger på jeres shelter: {shelter_url}

En af de absolut største frustrationer for friluftsfolk er frygten for at pakke rygsækken, vandre afsted, og så opdage, at shelteret allerede er optaget. Når vi fjerner den usikkerhed og lader folk booke på forhånd, oplever vi faktisk, at shelteret bliver brugt af endnu flere. Det tiltrækker nemlig dem, der ellers helt fravælger turen på grund af usikkerheden — for eksempel børnefamilier eller folk, der kommer langvejsfra.

Samtidig ved jeg, at mange shelter-ejere bruger meget tid på at besvare henvendelser om ledige datoer. For at løse det hele på en gang, har jeg bygget en simpel, brugervenlig booking-kalender, som I kan få lov at bruge helt uden omkostninger for jer. Nedenfor ser du et eksempel på en booking-side som vi har lavet for Geopark Odsherred og en demo-side for det ejer-dashboard som man får, hvor I har mulighed for at redigere jeres shelteroplysninger, hvilke beløb for evt. opkrævning, se bookinger osv.:

Booking-siden: https://shelterdk.dk/danmark/sjaelland-og-oeerne/odsherred/shelterplads-ved-solvognens-fundsted-11573
Ejer-dashboardet (din side): https://shelterdk.dk/demo/ejer

Du kan klikke rundt i begge links og se præcis, hvad en gæst oplever, og hvad du som ejer ser.

Her er hvad systemet gør for jer i praksis:

- Gæsten booker via system: Gennem vores system kan brugere booke shelteret ud i fremtiden.
- Du godkender eller afviser: Du beholder fuld kontrol. Systemet sender bare besked og lukker datoerne automatisk.
- Eller: Hvis man foretrækker det, kan systemet også sættes op, så gæsten booker med det samme uden at vente på godkendelse. Det er allerede indbygget — vi vælger bare, hvad der passer jer bedst.
- Kalendersynkronisering: Bookinger fra systemet opdaterer automatisk jeres kalender, hvis det ønskes, og manuelle bookinger I selv laver blokerer datoerne online.
- Besked-system: Mulighed for at kommunikere med den besøgende ved at sende beskeder frem og tilbage på en fast platform.
- Autogenerede beskeder: Systemet sender autogenerede beskeder baseret på dit shelter og specifikke ønsker i beskeden.

Systemet er også fleksibelt i forhold til, hvor bookingen skal ligge. Vil I have det på jeres egen hjemmeside, sætter vi det ind der som et lille vindue — gæsten behøver aldrig forlade jeres side. Foretrækker I at bookingen ligger på ShelterDK.dk, kan vi også det. Begge løsninger er allerede bygget og klar.

For at systemet kan køre rundt, er det skruet sådan sammen, at det koster brugeren et lille bookinggebyr. Det gør vi af to årsager:

1. Det dækker mine udgifter til at udvikle og drive det bagvedliggende IT-system.
2. Det minimerer "no-shows". Erfaringen viser, at hvis bookinger er 100 % gratis, har folk en tendens til at booke mange weekender langt ud i fremtiden "bare for at være sikre" — for derefter ikke at dukke op. Det er lige nu et kæmpe problem. Et lille gebyr gør bookingen forpligtende, så jeres shelter ikke står tomt til gene for andre.

For at gøre det hele så enkelt som muligt for jeres gæster arbejder jeg på at producere fysiske skilte til de shelters, der er med i systemet. Skiltet hænges op på shelteret og fortæller besøgende, at stedet skal bookes med en QR-kode der tager dem direkte til booking-siden. På den måde undgår vi situationen, hvor en gæst der har booket og rejst langt, ankommer til et shelter der allerede er optaget af nogen, som ikke var klar over at stedet skal bookes på forhånd.

Det blev lidt langt! Beklager — men prøv demoen, hvis du har lyst, og fortæl mig hvad du tænker. Helt uforpligtende.

Med venlig hilsen
Christian
ShelterDK.dk$TPL$
)
on conflict (id) do nothing;
