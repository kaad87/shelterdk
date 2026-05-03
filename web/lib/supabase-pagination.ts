import { createPublicClient } from "@/utils/supabase/server-public";

const DEFAULT_BATCH_SIZE = 1000;

export async function fetchAllShelterRows<T>(
  selectClause: string,
  configure?: (query: any) => any,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<T[]> {
  const supabase = createPublicClient();
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    let query = supabase
      .from("shelters")
      .select(selectClause)
      .is("duplicate_of_shelter_id", null);

    if (configure) {
      query = configure(query);
    }

    const { data, error } = await query.range(from, to);
    if (error) throw error;

    const batch = (data as T[]) ?? [];
    rows.push(...batch);

    if (batch.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}
