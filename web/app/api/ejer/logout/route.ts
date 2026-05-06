import { NextResponse } from "next/server";
import { createSessionClient } from "@/utils/supabase/server-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
