import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16 || token.length > 64) {
    return NextResponse.redirect(`${SITE_ORIGIN}/save-search/error`, 302);
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("saved_searches")
    .select("id, confirmed_at")
    .eq("token", token)
    .single();

  if (!data) {
    return NextResponse.redirect(`${SITE_ORIGIN}/save-search/error`, 302);
  }
  if (!data.confirmed_at) {
    await admin
      .from("saved_searches")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return NextResponse.redirect(`${SITE_ORIGIN}/save-search/confirmed`, 302);
}
