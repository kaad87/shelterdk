import { redirect } from "next/navigation";

// Signup er admin-only — kontakt ShelterDK for at få oprettet en konto
export default function SignupPage() {
  redirect("/ejer/login");
}
