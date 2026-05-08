import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById, getShelterGroupByDbShelterId } from "@/lib/owner-db";
import type { BookableShelter } from "@/types/booking";

export interface AuthenticatedOwnerContext {
  user: { id: string; email: string };
  shelter: BookableShelter;
}

export interface AuthenticatedOwnerGroupContext {
  user: { id: string; email: string };
  shelters: BookableShelter[];
}

export async function getAuthenticatedOwnerContext(
  shelterId: string
): Promise<AuthenticatedOwnerContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const shelter = await getOwnerShelterById(shelterId, user.id);
  if (!shelter) return null;

  return { user, shelter };
}

export async function getAuthenticatedOwnerGroupContext(
  shelterDbId: string
): Promise<AuthenticatedOwnerGroupContext | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const shelters = await getShelterGroupByDbShelterId(shelterDbId, user.id);
  if (!shelters.length) return null;

  return { user, shelters };
}
