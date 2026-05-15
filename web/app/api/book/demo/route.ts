// Mock booking endpoint for the demo page.
// Accepts the same payload as the real booking route but does nothing with it —
// just returns a fake success token so the form can show the confirmation flow.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST() {
  // Simulate a short processing delay so it feels real
  await new Promise((r) => setTimeout(r, 600));

  return Response.json(
    { success: true, guestToken: "demo-token" },
    { status: 201 }
  );
}
