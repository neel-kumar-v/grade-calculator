"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
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

  const gradingPeriodIdTyped = gradingPeriodId as Id<"gradingPeriods">;

  // Immediate synchronous cache hit from warm query cache
  const allGradingPeriods = useQuery(
    api.gradingPeriods.get,
    isAuthenticated ? {} : "skip"
  );
  const cachedGradingPeriod = allGradingPeriods?.find(
    (p) => p._id === gradingPeriodIdTyped
  );

  const gradingPeriodQuery = useQuery(
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
