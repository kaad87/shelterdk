import { NextRequest, NextResponse } from "next/server";
import { sendGa4Event } from "@/lib/server-analytics";

export async function POST(req: NextRequest) {
  let path: string;
  let title: string | undefined;
  let referrer: string | undefined;
  try {
    const body = await req.json();
    path = typeof body?.path === "string" ? body.path : "/";
    title = typeof body?.title === "string" ? body.title.slice(0, 100) : undefined;
    referrer = typeof body?.referrer === "string" && body.referrer ? body.referrer : undefined;
  } catch {
    path = "/";
  }

  await sendGa4Event({
    headers: req.headers,
    eventName: "page_view",
    path,
    title,
    referrer,
    skipIfConsentAccept: true,
  });

  return new NextResponse(null, { status: 204 });
}
