/**
 * Fletter per-region-lister til én national topliste. Bruges på
 * /shelter-booking, hvor de bookbare shelters skal stå ØVERST — forsiden
 * udkonkurrerede guiden på "book shelter" fordi den havde selve listen.
 */
export function mergeTopByScore<T extends { id: string; display_score?: number | null }>(
  lists: T[][],
  limit: number
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const list of lists) {
    for (const s of list) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
  }
  merged.sort((a, b) => (b.display_score ?? -Infinity) - (a.display_score ?? -Infinity));
  return merged.slice(0, limit);
}
