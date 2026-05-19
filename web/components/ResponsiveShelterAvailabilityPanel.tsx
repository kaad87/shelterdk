"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShelterAvailabilityPanel } from "@/components/ShelterAvailabilityPanel";

interface ResponsiveShelterAvailabilityPanelProps {
  slug: string;
  title: string;
  mobileTargetId: string;
  desktopTargetId: string;
  mobileClassName?: string;
  desktopClassName?: string;
}

export function ResponsiveShelterAvailabilityPanel({
  slug,
  title,
  mobileTargetId,
  desktopTargetId,
  mobileClassName = "",
  desktopClassName = "",
}: ResponsiveShelterAvailabilityPanelProps) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (isDesktop == null) return;
    setTarget(
      document.getElementById(isDesktop ? desktopTargetId : mobileTargetId)
    );
  }, [desktopTargetId, isDesktop, mobileTargetId]);

  if (!target || isDesktop == null) return null;

  return createPortal(
    <ShelterAvailabilityPanel
      slug={slug}
      title={title}
      className={isDesktop ? desktopClassName : mobileClassName}
    />,
    target
  );
}
