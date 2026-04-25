import { NextRequest, NextResponse } from "next/server";
import { getPaymentsForAdmin } from "@/lib/payment-db";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payments = await getPaymentsForAdmin();
  return NextResponse.json(payments);
}
