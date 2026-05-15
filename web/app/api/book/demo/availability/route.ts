// Mock availability for the demo booking page.
// Blocks a handful of realistic-looking upcoming dates so the calendar
// looks lived-in without touching the real database.
export const dynamic = "force-dynamic";

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const dates: Record<string, "confirmed"> = {};

  // Block some upcoming stretches to simulate real usage
  const blocks = [
    [3, 5],   // denne uge
    [10, 12], // næste uge
    [18, 21], // om tre uger
    [28, 30], // om en måned
  ];

  for (const [start, end] of blocks) {
    for (let i = start; i < end; i++) {
      dates[isoDate(i)] = "confirmed";
    }
  }

  return Response.json({ dates });
}
