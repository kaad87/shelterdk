import { Suspense } from "react";
import { LoginForm } from "@/components/ejer/LoginForm";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
