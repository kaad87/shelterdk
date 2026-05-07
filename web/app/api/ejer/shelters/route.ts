import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/utils/supabase/server-session";
import { getSheltersByAuthUser } from "@/lib/owner-db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const shelters = await getSheltersByAuthUser(user.id);
  return NextResponse.json({ shelters });
}
