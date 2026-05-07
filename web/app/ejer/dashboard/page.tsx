import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getSheltersByAuthUser } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export default async function EjerDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const shelters = await getSheltersByAuthUser(user.id);

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">Ejer-portal</p>
          <h1 className="font-serif text-2xl font-bold text-primary">Mine shelters</h1>
          <p className="text-sm text-primary/50 mt-1">{user.email}</p>
        </div>
        <form action="/api/ejer/logout" method="POST">
          <button
            type="submit"
            className="text-sm text-primary/40 hover:text-primary border border-primary/15 rounded-lg px-3 py-1.5 transition-colors"
          >
            Log ud
          </button>
        </form>
      </div>

      {shelters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/15 p-8 text-center">
          <p className="text-sm text-primary/50">Ingen shelters fundet. Kontakt os på kontakt@shelterdk.dk.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shelters.map((shelter) => (
            <div
              key={shelter.id}
              className="rounded-2xl border border-primary/8 bg-white p-5 flex items-center justify-between gap-4"
            >
              <div>
                <h2 className="font-semibold text-primary">{shelter.title}</h2>
                <p className="text-xs text-primary/40 mt-0.5">
                  {shelter.active_booking_count > 0
                    ? `${shelter.active_booking_count} aktive bookinger`
                    : "Ingen aktive bookinger"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/ejer/shelter/${shelter.id}/bookinger`}
                  className="text-sm font-medium text-primary border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                >
                  Bookinger
                </Link>
                <Link
                  href={`/ejer/shelter/${shelter.id}/rediger`}
                  className="text-sm font-medium text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/5 transition-colors"
                >
                  Rediger
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
