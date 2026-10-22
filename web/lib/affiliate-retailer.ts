import { feedFor } from "@/lib/affiliate-feeds";

/**
 * Visningsnavn for en affiliate-forhandler.
 *
 * Navnene laeses af FEEDS frem for at staa her ogsaa. De stod to steder, og med
 * to nye feeds ville en forhandler kunne komme i importen uden et navn og vises
 * som "prooutdoor" paa produktkortet.
 */
export function retailerLabel(retailer: string): string {
  return feedFor(retailer)?.label ?? retailer;
}
