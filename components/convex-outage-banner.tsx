"use client";

import Link from "next/link";
import { useConvexBackendHealth } from "@/components/convex-backend-health";

export function ConvexOutageBanner() {
  const { outageMessage } = useConvexBackendHealth();
  if (!outageMessage) {
    return null;
  }
  return (
    <div
      className="border-b border-amber-500/40 bg-amber-950/90 px-4 py-2 text-center text-sm text-amber-100"
      role="status"
    >
      {outageMessage}{" "}
      <Link
        className="font-medium underline underline-offset-2 hover:text-white"
        href="https://dashboard.convex.dev"
        rel="noopener noreferrer"
        target="_blank"
      >
        Open Convex dashboard
      </Link>
    </div>
  );
}
