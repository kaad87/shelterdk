import type { Metadata } from "next";
import Link from "next/link";
import { getPaymentsForAdmin, getPayoutsForAdmin } from "@/lib/payment-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { absolute: "Admin – Betalinger | ShelterDK" },
};

function Badge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    expired: "bg-red-100 text-red-500",
    failed: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    paid: "Betalt",
    pending: "Afventer",
    expired: "Udløbet",
    failed: "Fejlet",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default async function AdminPaymentsPage() {
  const [payments, payouts] = await Promise.all([
    getPaymentsForAdmin(),
    getPayoutsForAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-12">
      <nav className="mb-2 text-sm text-primary/60">
        <Link href="/" className="hover:text-accent transition-colors">
          Hjem
        </Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin" className="hover:text-accent transition-colors">
          Admin
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Betalinger</span>
      </nav>

      {/* ── Transactions ── */}
      <section>
        <h1 className="text-2xl font-bold text-primary mb-6">
          Transaktioner ({payments.length})
        </h1>
        <div className="overflow-x-auto rounded-xl border border-primary/10">
          <table className="w-full text-sm">
            <thead className="border-b border-primary/10 bg-primary/[0.02]">
              <tr>
                {[
                  "Shelter",
                  "Gæst",
                  "Datoer",
                  "Total",
                  "Gebyr",
                  "Status",
                  "Oprettet",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-primary/50 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-primary/5 hover:bg-primary/[0.02]"
                >
                  <td className="px-4 py-3 font-medium">{p.shelter_title}</td>
                  <td className="px-4 py-3 text-primary/70">{p.guest_name}</td>
                  <td className="px-4 py-3 text-primary/50 text-xs">
                    {p.check_in} – {p.check_out}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.amount_total_dkk} kr
                  </td>
                  <td className="px-4 py-3 text-right text-primary/60">
                    {p.amount_platform_dkk} kr
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-primary/40 text-xs">
                    {new Date(p.created_at).toLocaleDateString("da-DK")}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-primary/30"
                  >
                    Ingen transaktioner endnu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Payouts ── */}
      <section>
        <h2 className="text-xl font-bold text-primary mb-6">
          Udbetalinger ({payouts.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-primary/10">
          <table className="w-full text-sm">
            <thead className="border-b border-primary/10 bg-primary/[0.02]">
              <tr>
                {["Shelter", "Periode", "Beløb", "Status", "Udbetalt", "Note"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-primary/50 font-medium"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-primary/5">
                  <td className="px-4 py-3 font-medium">{p.shelter_title}</td>
                  <td className="px-4 py-3 text-primary/50 text-xs">
                    {p.period_start} – {p.period_end}
                  </td>
                  <td className="px-4 py-3 text-right">{p.amount_dkk} kr</td>
                  <td className="px-4 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-primary/40 text-xs">
                    {p.paid_at
                      ? new Date(p.paid_at).toLocaleDateString("da-DK")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-primary/40 text-xs">
                    {p.notes ?? "—"}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-primary/30"
                  >
                    Ingen udbetalinger endnu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
