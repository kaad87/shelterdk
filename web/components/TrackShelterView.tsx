"use client";

import { useEffect } from "react";
import { trackShelterView } from "@/lib/tracking";

interface TrackShelterViewProps {
  shelterName: string;
  shelterId: string;
}

export function TrackShelterView({
  shelterName,
  shelterId,
}: TrackShelterViewProps) {
  useEffect(() => {
    trackShelterView(shelterName, shelterId);
  }, [shelterId, shelterName]);

  return null;
}
