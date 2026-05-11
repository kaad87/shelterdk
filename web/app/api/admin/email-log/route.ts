import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { listEmailLogs, type EmailLogCategory, type EmailLogStatus } from "@/lib/email-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "all") as EmailLogStatus | "all";
  const category = (searchParams.get("category") ?? "all") as EmailLogCategory | "all";
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200);

  const logs = await listEmailLogs({ status, category, limit });
  return NextResponse.json(logs);
}
