import { redirect } from "next/navigation";
import { getSessionUser } from "@/utils/supabase/server-session";
import { ChangePasswordForm } from "@/components/ejer/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/ejer/login");
  return <ChangePasswordForm />;
}
