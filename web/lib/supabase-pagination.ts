import { createPublicClient } from "@/utils/supabase/server-public";

const DEFAULT_BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Kører en Supabase-query med retry + eksponentiel backoff på transiente
 * fejl. Vigtigt under static generation af ~2900 sider ved build: et
 * enkelt Supabase-timeout må ikke kaste og dermed vælte hele deployet.
 *
 * `runQuery` skal bygge OG eksekvere queryen på ny hver gang — Supabase
 * query-builders er single-use og kan ikke gen-eksekveres.
 */
export async function querySupabaseWithRetry<T>(
  runQuery: () => PromiseLike<{ data: T | null; error: unknown }>,
  opts: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<T | null> {
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  const baseDelay = opts.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await runQuery();
    if (!error) return data;
    lastError = error;
    if (attempt < maxRetries) {
      await sleep(baseDelay * 2 ** attempt);
    }
  }
  throw lastError;
}

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

    // Byg + eksekver queryen på ny i hvert retry-forsøg (builders er single-use).
    const data = await querySupabaseWithRetry<T[]>(() => {
      let query = supabase
        .from("shelters")
        .select(selectClause)
        .is("duplicate_of_shelter_id", null);
      if (configure) {
        query = configure(query);
      }
      return query.range(from, to) as PromiseLike<{ data: T[] | null; error: unknown }>;
    });

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}
