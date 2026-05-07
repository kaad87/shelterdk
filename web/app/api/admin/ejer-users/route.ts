import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server-admin";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-admin-secret") ??
    new URL(req.url).searchParams.get("secret");
  return provided === secret;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email: string =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const shelterIds: string[] = Array.isArray(body.shelter_ids)
    ? body.shelter_ids.filter((id: unknown) => typeof id === "string")
    : [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Ugyldig email" }, { status: 400 });

  if (shelterIds.length === 0)
    return NextResponse.json(
      { error: "Vælg mindst ét shelter" },
      { status: 400 }
    );

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  // Create the auth user — email_confirm: true skips the confirmation email
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

  if (createError) {
    const isExisting =
      createError.message.toLowerCase().includes("already registered") ||
      createError.message.toLowerCase().includes("already exists") ||
      createError.message.toLowerCase().includes("already been registered");
    if (isExisting) {
      return NextResponse.json(
        { error: "Der findes allerede en konto med denne email" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  const userId = created.user.id;

  // Link the selected shelters to the new user
  const { data: linked, error: linkError } = await admin
    .from("bookable_shelters")
    .update({ auth_user_id: userId })
    .in("id", shelterIds)
    .select("id, title");

  if (linkError) {
    // Best-effort cleanup: delete the auth user we just created
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tempPassword,
    sheltersLinked: linked?.length ?? 0,
    shelters: linked ?? [],
  });
}
