"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ShelterTipModalContextValue {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const ShelterTipModalContext = createContext<ShelterTipModalContextValue | null>(null);

export function ShelterTipModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <ShelterTipModalContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </ShelterTipModalContext.Provider>
  );
}

export function useShelterTipModal(): ShelterTipModalContextValue {
  const ctx = useContext(ShelterTipModalContext);
  if (!ctx) throw new Error("useShelterTipModal must be used inside ShelterTipModalProvider");
  return ctx;
}
