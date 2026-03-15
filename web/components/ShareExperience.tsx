import Link from "next/link";
import { MessageCircle, ArrowRight } from "lucide-react";

export function ShareExperience() {
  return (
    <div className="mt-10 rounded-xl border border-primary/10 bg-primary/5 p-6 sm:p-8 text-center">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <MessageCircle size={20} className="text-primary/60" />
      </div>
      <h3 className="font-serif text-xl font-bold text-primary mb-2">
        Har du været på sheltertur?
      </h3>
      <p className="text-primary/70 text-sm mb-4 max-w-md mx-auto">
        Vi vil gerne høre om din oplevelse! Del dine tips, billeder eller
        spørgsmål med os.
      </p>
      <Link
        href="/kontakt"
        className="inline-flex items-center gap-2 text-accent font-medium text-sm hover:underline"
      >
        Del din oplevelse
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
