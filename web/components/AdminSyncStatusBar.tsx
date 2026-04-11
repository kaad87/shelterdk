import { createClient } from "@supabase/supabase-js";

export async function AdminSyncStatusBar() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from("affiliate_sync_runs")
    .select("status, started_at, finished_at, error_message, products_total")
    .order("started_at", { ascending: false })
    .limit(1);

  const run = data?.[0];
  if (!run) {
    return <span className="text-sm text-primary/50">Ingen sync-data</span>;
  }
  const ok = run.status === "success";
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={ok ? "text-emerald-600" : "text-red-500"}>
        {ok ? "✓" : "✗"} {run.status}
      </span>
      <span className="text-primary/60">
        {run.finished_at
          ? new Date(run.finished_at).toLocaleString("da-DK")
          : "kører…"}
        {run.products_total != null && ` · ${run.products_total} produkter`}
      </span>
    </div>
  );
}
