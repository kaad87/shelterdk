import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, getSharedShelterContent } from "@/lib/owner-db";
import { ShelterEditForm } from "@/components/ejer/ShelterEditForm";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function RedigerPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) notFound();

  const sharedContent = shelter.shelter_id
    ? await getSharedShelterContent(shelter.shelter_id)
    : null;

  return (
    <div>
      <div className="mb-6">
        <a
          href="/ejer/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary/55 hover:text-primary transition-colors"
        >
          ← Tilbage til dashboard
        </a>
      </div>

      <ShelterEditForm
        shelter={shelter}
        sharedContent={sharedContent}
        shelterDbId={shelter.shelter_id ?? ""}
      />
    </div>
  );
}
