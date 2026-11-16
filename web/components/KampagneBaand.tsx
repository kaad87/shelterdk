import { blackWeekBaand } from "@/lib/kampagne";
import { KampagneBaandLink } from "./KampagneBaandLink";

/**
 * Smalt bånd over headeren i ugerne op til Black Friday.
 *
 * Står i (site)/layout.tsx og dermed på alle sider. Det er pointen: guiderne
 * giver 92,6 % af grej-klikkene, men trafikken ligger på shelter-siderne og
 * listevisningerne, og dér stod der ingenting om Black Friday (målt 16/11
 * 2026: kun footeren, /tilbud og en note i guiderne linkede til siden).
 *
 * Renderes på serveren med fast højde, så det er med i den første HTML og
 * ikke skubber noget efter indlæsning. Det ruller væk med siden; kun
 * navigationen under det er sticky.
 *
 * Datoen afgøres her og ikke i klientkomponenten. Gjorde den det selv, ville
 * en statisk side bygget i november og hentet i december være uenig med sig
 * selv ved hydrering.
 */
export function KampagneBaand() {
  const baand = blackWeekBaand(new Date());
  if (!baand) return null;
  return <KampagneBaandLink aar={baand.aar} />;
}
