"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from "convex/react";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { useConvexBackendHealth } from "@/components/convex-backend-health";
import { api } from "../convex/_generated/api";
import { SignIn } from "../components/auth/SignIn";
import GradingPeriods from "../components/GradingPeriods";
import { useState, useEffect, type ReactNode } from "react";

function AuthWrapper({ 
  setIsAuthenticated, 
  children 
}: { 
  setIsAuthenticated: (value: boolean) => void; 
  children: ReactNode;
}) {
  useEffect(() => {
    setIsAuthenticated(true);
  }, [setIsAuthenticated]);
  return <>{children}</>;
}

function UnauthWrapper({ 
  setIsAuthenticated, 
  children 
}: { 
  setIsAuthenticated: (value: boolean) => void; 
  children: ReactNode;
}) {
  useEffect(() => {
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);
  return <>{children}</>;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { outageMessage } = useConvexBackendHealth();
  const gradingPeriods = useConvexQuery(api.gradingPeriods.get);

  useEffect(() => {
    document.title = "Heavyweight";
  }, []);

  return (
    <main className={`flex min-h-[90vh] container max-w-2xl  mx-auto flex-col px-6 bg-background ${isAuthenticated ? 'items-start justify-start' : 'items-center justify-center'}`}>
      <AuthLoading>
        {outageMessage ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Connecting to Convex...
          </div>
        ) : (
          "Loading... "
        )}
      </AuthLoading>
      <Unauthenticated>
        <UnauthWrapper setIsAuthenticated={setIsAuthenticated}>
          <SignIn />
        </UnauthWrapper>
      </Unauthenticated>
      <Authenticated>
        <AuthWrapper setIsAuthenticated={setIsAuthenticated}>
          <GradingPeriods gradingPeriods={gradingPeriods ?? undefined} />
        </AuthWrapper>
      </Authenticated>
    </main>
  );
}
