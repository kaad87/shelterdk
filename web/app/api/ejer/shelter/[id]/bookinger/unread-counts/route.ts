import { NextRequest, NextResponse } from "next/server";
import { getUnreadCountsForShelter } from "@/lib/messages-db";
import { getAuthenticatedOwnerContext } from "@/lib/ejer-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const context = await getAuthenticatedOwnerContext(id);
  if (!context) return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });

  const counts = await getUnreadCountsForShelter(context.shelter.id);
  return NextResponse.json({ counts });
}
