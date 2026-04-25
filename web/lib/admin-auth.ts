import { NextRequest } from "next/server";

export function isAdmin(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length === 0) return false;
  const header = req.headers.get("x-admin-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || query === secret;
}
