import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://shelterdk.dk";

async function unsubscribe(token: string): Promise<Response> {
  if (!token || token.length < 16 || token.length > 64) {
    return NextResponse.redirect(`${SITE_ORIGIN}/save-search/error`, 302);
  }
  await createAdminClient().from("saved_searches").delete().eq("token", token);
  return NextResponse.redirect(`${SITE_ORIGIN}/save-search/unsubscribed`, 302);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return unsubscribe(token);
}

// Gmail/Yahoo one-click List-Unsubscribe POST håndteres samme sted.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return unsubscribe(token);
}
