import { Suspense } from "react";
import { ClaimShelterPanel } from "@/components/ejer/ClaimShelterPanel";

export default function EjerClaimPage() {
  return (
    <Suspense>
      <ClaimShelterPanel />
    </Suspense>
  );
}
