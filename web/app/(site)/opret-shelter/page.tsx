import type { Metadata } from "next";
import { ShelterSubmissionForm } from "@/components/ShelterSubmissionForm";

export const metadata: Metadata = {
  title: "Opret shelter | ShelterDK",
  description:
    "Har du et shelter du vil have listet på ShelterDK? Indsend det her — vi gennemgår din ansøgning og vender tilbage.",
  robots: "noindex",
};

export default function OpretShelterPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav className="mb-6 text-sm text-primary/60">
        <a href="/" className="hover:text-accent transition-colors">
          Hjem
        </a>
        <span className="mx-1.5">/</span>
        <span className="text-primary font-medium">Opret shelter</span>
      </nav>

      <h1 className="text-2xl font-bold text-primary mb-2">Opret shelter</h1>
      <p className="text-sm text-primary/60 mb-8">
        Udfyld formularen herunder for at indsende dit shelter til ShelterDK.
        Vi gennemgår ansøgningen og vender tilbage til dig på den angivne email.
      </p>

      <ShelterSubmissionForm />
    </div>
  );
}
