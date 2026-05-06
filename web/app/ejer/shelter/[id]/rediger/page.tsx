import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, getShelterPhotos } from "@/lib/owner-db";
import { ShelterEditForm } from "@/components/ejer/ShelterEditForm";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ id: string }> }

export default async function RedigerPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const { id } = await params;
  const shelter = await getOwnerShelterById(id, user.id);
  if (!shelter) notFound();

  const photos = shelter.shelter_id
    ? await getShelterPhotos(shelter.shelter_id)
    : [];

  return (
    <ShelterEditForm
      shelter={shelter}
      photos={photos}
      shelterDbId={shelter.shelter_id ?? ""}
    />
  );
}
