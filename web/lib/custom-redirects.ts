import { createAdminClient } from "@/utils/supabase/server-admin";
import {
  normalizeRedirectDestination,
  normalizeRedirectSourcePath,
  RESERVED_REDIRECT_PREFIXES,
} from "@/lib/custom-redirect-utils";

export type CustomRedirectStatusCode = 301 | 302 | 307 | 308;

export interface CustomRedirectRow {
  id: string;
  source_path: string;
  destination_url: string;
  status_code: CustomRedirectStatusCode;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function validateRedirectInput(sourcePath: string, destinationUrl: string) {
  const source = normalizeRedirectSourcePath(sourcePath);
  const destination = normalizeRedirectDestination(destinationUrl);

  if (!source || !source.startsWith("/")) {
    return { ok: false as const, error: "Kilde-stien skal starte med /" };
  }

  if (source.length > 255) {
    return { ok: false as const, error: "Kilde-stien er for lang" };
  }

  if (
    RESERVED_REDIRECT_PREFIXES.some((prefix) => source === prefix || source.startsWith(`${prefix}/`))
  ) {
    return { ok: false as const, error: "Denne sti er reserveret af systemet" };
  }

  if (!destination) {
    return { ok: false as const, error: "Destination mangler" };
  }

  if (!destination.startsWith("/") && !/^https?:\/\//i.test(destination)) {
    return { ok: false as const, error: "Destination skal starte med / eller være en fuld http(s)-URL" };
  }

  if (destination === source) {
    return { ok: false as const, error: "Kilde og destination må ikke være identiske" };
  }

  return {
    ok: true as const,
    source,
    destination,
  };
}

export async function listCustomRedirects(limit = 200) {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await createAdminClient()
    .from("custom_redirects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`Kunne ikke hente redirects: ${error.message}`);
  return (data ?? []) as CustomRedirectRow[];
}

export async function createCustomRedirect(input: {
  sourcePath: string;
  destinationUrl: string;
  statusCode: CustomRedirectStatusCode;
  isActive?: boolean;
  note?: string | null;
}) {
  const validated = validateRedirectInput(input.sourcePath, input.destinationUrl);
  if (!validated.ok) throw new Error(validated.error);

  const { data, error } = await createAdminClient()
    .from("custom_redirects")
    .insert({
      source_path: validated.source,
      destination_url: validated.destination,
      status_code: input.statusCode,
      is_active: input.isActive ?? true,
      note: input.note?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Kunne ikke oprette redirect: ${error.message}`);
  return data as CustomRedirectRow;
}

export async function updateCustomRedirect(
  id: string,
  input: {
    sourcePath: string;
    destinationUrl: string;
    statusCode: CustomRedirectStatusCode;
    isActive: boolean;
    note?: string | null;
  }
) {
  const validated = validateRedirectInput(input.sourcePath, input.destinationUrl);
  if (!validated.ok) throw new Error(validated.error);

  const { data, error } = await createAdminClient()
    .from("custom_redirects")
    .update({
      source_path: validated.source,
      destination_url: validated.destination,
      status_code: input.statusCode,
      is_active: input.isActive,
      note: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Kunne ikke opdatere redirect: ${error.message}`);
  return data as CustomRedirectRow;
}

export async function deleteCustomRedirect(id: string) {
  const { error } = await createAdminClient().from("custom_redirects").delete().eq("id", id);
  if (error) throw new Error(`Kunne ikke slette redirect: ${error.message}`);
}
