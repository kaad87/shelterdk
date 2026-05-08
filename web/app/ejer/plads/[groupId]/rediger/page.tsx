import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getShelterGroupByDbShelterId, getShelterPhotos, getSharedShelterContent } from "@/lib/owner-db";
import { ShelterGroupSettingsForm } from "@/components/ejer/ShelterGroupSettingsForm";

export const dynamic = "force-dynamic";

function stripUnitSuffix(title: string) {
  return title.replace(/\s+[–-]\s+Shelter\s+\d+$/i, "").trim();
}

export default async function EjerShelterGroupEditPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");

  const { groupId } = await params;
  const shelters = await getShelterGroupByDbShelterId(groupId, user.id);
  if (shelters.length < 2) notFound();
  const [sharedContent, photos] = await Promise.all([
    getSharedShelterContent(groupId),
    getShelterPhotos(groupId),
  ]);

  return (
    <ShelterGroupSettingsForm
      groupId={groupId}
      label={stripUnitSuffix(shelters[0].title)}
      shelters={shelters}
      sharedDescription={sharedContent?.description ?? ""}
      photos={photos}
      photoShelterUnitId={shelters[0].id}
      shelterDbId={groupId}
    />
  );
}
