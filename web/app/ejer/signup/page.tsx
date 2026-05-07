import { Suspense } from "react";
import { SignupForm } from "@/components/ejer/SignupForm";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
