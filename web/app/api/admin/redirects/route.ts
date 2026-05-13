import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { describeAdminDataError } from "@/lib/admin-route-errors";
import {
  createCustomRedirect,
  deleteCustomRedirect,
  listCustomRedirects,
  updateCustomRedirect,
  type CustomRedirectStatusCode,
} from "@/lib/custom-redirects";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10) || 200);
  try {
    const redirects = await listCustomRedirects(limit);
    return NextResponse.json(redirects);
  } catch (err) {
    return NextResponse.json(
      {
        error: describeAdminDataError(err, {
          entityLabel: "Redirect-panelet",
          tableName: "custom_redirects",
          migrationFile: "20260513_custom_redirects.sql",
          fallbackMessage: "Kunne ikke hente redirects lige nu.",
        }),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.sourcePath || !body?.destinationUrl || !body?.statusCode) {
    return NextResponse.json({ error: "Mangler sourcePath, destinationUrl eller statusCode" }, { status: 400 });
  }

  try {
    const row = await createCustomRedirect({
      sourcePath: String(body.sourcePath),
      destinationUrl: String(body.destinationUrl),
      statusCode: Number(body.statusCode) as CustomRedirectStatusCode,
      isActive: body.isActive !== false,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error: describeAdminDataError(err, {
          entityLabel: "Redirect-panelet",
          tableName: "custom_redirects",
          migrationFile: "20260513_custom_redirects.sql",
          fallbackMessage: err instanceof Error ? err.message : "Kunne ikke oprette redirect",
        }),
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.sourcePath || !body?.destinationUrl || !body?.statusCode) {
    return NextResponse.json({ error: "Mangler id, sourcePath, destinationUrl eller statusCode" }, { status: 400 });
  }

  try {
    const row = await updateCustomRedirect(String(body.id), {
      sourcePath: String(body.sourcePath),
      destinationUrl: String(body.destinationUrl),
      statusCode: Number(body.statusCode) as CustomRedirectStatusCode,
      isActive: body.isActive !== false,
      note: typeof body.note === "string" ? body.note : null,
    });
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json(
      {
        error: describeAdminDataError(err, {
          entityLabel: "Redirect-panelet",
          tableName: "custom_redirects",
          migrationFile: "20260513_custom_redirects.sql",
          fallbackMessage: err instanceof Error ? err.message : "Kunne ikke opdatere redirect",
        }),
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Mangler id" }, { status: 400 });
  }

  try {
    await deleteCustomRedirect(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: describeAdminDataError(err, {
          entityLabel: "Redirect-panelet",
          tableName: "custom_redirects",
          migrationFile: "20260513_custom_redirects.sql",
          fallbackMessage: err instanceof Error ? err.message : "Kunne ikke slette redirect",
        }),
      },
      { status: 400 }
    );
  }
}
