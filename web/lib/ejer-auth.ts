import { getSessionUser } from "@/utils/supabase/server-session";
import { getOwnerShelterById } from "@/lib/owner-db";
import type { BookableShelter } from "@/types/booking";

export interface AuthenticatedOwnerContext {
  user: { id: string; email: string };
  shelter: BookableShelter;
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
