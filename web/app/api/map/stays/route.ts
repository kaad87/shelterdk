import { NextResponse } from "next/server";
import { getPublishedStayPins } from "@/lib/nature-stays";

/**
 * Pins for betalte overnatningssteder, til alle kort paa sitet.
 *
 * Findes for at undgaa at traekke en stays-prop gennem tolv kortsider. Kun
 * forsiden havde dem, fordi den var den eneste der huskede at sende dem med,
 * og det er praecis den slags fejl der opstaar, naar en oplysning skal
 * videregives manuelt tolv steder.
 *
 * Svaret er offentligt: det er de samme pins som vises paa kortet, og
 * getPublishedStayPins slipper kun publicerede steder med et Booking-link
 * igennem. Ingen kladder, ingen steder uden link.
 *
 * Caches haardt. Publicerede steder aendrer sig sjaeldent, og et ucachet kald
 * pr. kortvisning er netop den slags hot-path-forespoergsel der har koestet
 * egress foer.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    const stays = await getPublishedStayPins();
    return NextResponse.json({ stays }, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    // Et kort uden betalte pins er stadig et brugbart kort. En fejl her maa
    // ikke vaelte siden.
    return NextResponse.json({ stays: [] }, { status: 200 });
  }
}
