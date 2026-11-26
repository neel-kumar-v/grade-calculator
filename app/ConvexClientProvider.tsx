"use client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { ConvexBackendHealthProvider } from "@/components/convex-backend-health";
import { ConvexOutageBanner } from "@/components/convex-outage-banner";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ConvexBackendHealthProvider>
        <ConvexOutageBanner />
        {children}
      </ConvexBackendHealthProvider>
    </ConvexAuthProvider>
  );
}
