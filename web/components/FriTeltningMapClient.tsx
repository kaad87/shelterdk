"use client";

import dynamic from "next/dynamic";

const FriTeltningMap = dynamic(() => import("./FriTeltningMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-primary/5 animate-pulse" aria-hidden />,
});

export function FriTeltningMapClient() {
  return (
    <div className="h-[420px] md:h-[520px] rounded-2xl overflow-hidden border border-primary/10">
      <FriTeltningMap src="/data/fri-teltning.json" />
    </div>
  );
}
