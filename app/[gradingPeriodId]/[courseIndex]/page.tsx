"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { useConvexBackendHealth } from "@/components/convex-backend-health";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { NotFound } from "../../../components/NotFound";
import { CourseCategories } from "../../../components/CourseCategories";

interface PageParams {
  gradingPeriodId: string;
  courseIndex: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

export default function CoursePage({ params }: PageProps) {
  const { gradingPeriodId, courseIndex } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { outageMessage } = useConvexBackendHealth();

  const gradingPeriodIdTyped = gradingPeriodId as Id<"gradingPeriods">;
  const index = Number(courseIndex);
  const isValidIndex = Number.isFinite(index) && index >= 0;

  // Immediate synchronous cache hit from warm query cache
  const allGradingPeriods = useConvexQuery(
    api.gradingPeriods.get,
    isAuthenticated ? {} : "skip"
  );
  const cachedGradingPeriod = allGradingPeriods?.find(
    (p) => p._id === gradingPeriodIdTyped
  );
  const cachedCourse = cachedGradingPeriod?.courses?.[index];

  const courseQuery = useConvexQuery(
    api.gradingPeriods.getCourseById,
    isAuthenticated && isValidIndex
      ? {
          gradingPeriodId: gradingPeriodIdTyped,
          courseIndex: index,
        }
      : "skip"
  );

  const gradingPeriodQuery = useConvexQuery(
    api.gradingPeriods.getById,
    isAuthenticated && isValidIndex ? { id: gradingPeriodIdTyped } : "skip"
  );

  const courseData = courseQuery?.course ?? cachedCourse;
  const gradingPeriod = gradingPeriodQuery ?? cachedGradingPeriod;

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    if (courseData && gradingPeriod) {
      document.title = `${courseData.name} (${gradingPeriod.name}) - Heavyweight`;
    }
  }, [courseData, gradingPeriod]);

  if (!isValidIndex) {
    return <NotFound />;
  }

  if (isAuthLoading || (!isAuthenticated && !isAuthLoading)) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-6 flex flex-col gap-6">
        <h1
          style={{ viewTransitionName: `course-title-${courseIndex}` }}
          className="text-2xl font-bold w-fit"
        >
          Loading course...
        </h1>
      </div>
    );
  }

  if (!courseData) {
    if (courseQuery === null || (allGradingPeriods && !cachedCourse)) {
      return <NotFound />;
    }
    if (outageMessage) {
      return (
        <div className="container max-w-2xl mx-auto py-12 px-6 flex flex-col gap-6">
          <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
            Course data is paused while Convex is offline. {outageMessage}
          </p>
        </div>
      );
    }
    return (
      <div className="container max-w-2xl mx-auto py-12 px-6 flex flex-col gap-6">
        <h1
          style={{ viewTransitionName: `course-title-${courseIndex}` }}
          className="text-2xl font-bold w-fit"
        >
          Loading course...
        </h1>
      </div>
    );
  }

  return (
    <CourseCategories
      gradingPeriodId={gradingPeriodIdTyped}
      courseIndex={index}
      course={courseData}
    />
  );
}
