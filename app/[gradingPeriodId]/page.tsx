"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { useConvexBackendHealth } from "@/components/convex-backend-health";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { NotFound } from "../../components/NotFound";
import { Courses } from "../../components/Courses";

interface PageProps {
  params: Promise<{
    gradingPeriodId: string;
  }>;
}

export default function GradingPeriodPage({ params }: PageProps) {
  const { gradingPeriodId } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { outageMessage } = useConvexBackendHealth();

  const gradingPeriodIdTyped = gradingPeriodId as Id<"gradingPeriods">;

  // Immediate synchronous cache hit from warm query cache
  const allGradingPeriods = useConvexQuery(
    api.gradingPeriods.get,
    isAuthenticated ? {} : "skip"
  );
  const cachedGradingPeriod = allGradingPeriods?.find(
    (p) => p._id === gradingPeriodIdTyped
  );

  const gradingPeriodQuery = useConvexQuery(
    api.gradingPeriods.getById,
    isAuthenticated ? { id: gradingPeriodIdTyped } : "skip"
  );

  const gradingPeriod = gradingPeriodQuery ?? cachedGradingPeriod;

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    if (gradingPeriod) {
      document.title = `${gradingPeriod.name} - Heavyweight`;
    }
  }, [gradingPeriod]);

  if (isAuthLoading || (!isAuthenticated && !isAuthLoading)) {
    return (
      <div className="flex flex-col container max-w-2xl mx-auto py-12 px-6 gap-4 w-full">
        <h1
          style={{ viewTransitionName: `period-title-${gradingPeriodId}` }}
          className="text-2xl font-bold w-fit"
        >
          Loading...
        </h1>
      </div>
    );
  }

  if (gradingPeriod === undefined) {
    if (allGradingPeriods && !cachedGradingPeriod && gradingPeriodQuery === null) {
      return <NotFound />;
    }
    if (outageMessage) {
      return (
        <div className="flex flex-col container max-w-2xl mx-auto py-12 px-6 gap-4 w-full">
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            Grading period data is paused while Convex is offline. {outageMessage}
          </p>
        </div>
      );
    }
    return (
      <div className="flex flex-col container max-w-2xl mx-auto py-12 px-6 gap-4 w-full">
        <h1
          style={{ viewTransitionName: `period-title-${gradingPeriodId}` }}
          className="text-2xl font-bold w-fit"
        >
          Loading...
        </h1>
      </div>
    );
  }

  if (gradingPeriod === null) {
    return <NotFound />;
  }

  return (
    <Courses
      gradingPeriodId={gradingPeriodIdTyped}
      gradingPeriod={gradingPeriod}
    />
  );
}
