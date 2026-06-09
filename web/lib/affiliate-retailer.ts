/** Visningsnavn for en affiliate-forhandler. */
export function retailerLabel(retailer: string): string {
  const labels: Record<string, string> = {
    outmore: "Outmore.dk",
    backpackerlife: "Backpackerlife.dk",
    outdoortid: "Outdoortid.dk",
  };
  return labels[retailer] ?? retailer;
}
