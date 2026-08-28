"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
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

  const gradingPeriodIdTyped = gradingPeriodId as Id<"gradingPeriods">;
  const index = Number(courseIndex);
  const isValidIndex = Number.isFinite(index) && index >= 0;

  // Immediate synchronous cache hit from warm query cache
  const allGradingPeriods = useQuery(
    api.gradingPeriods.get,
    isAuthenticated ? {} : "skip"
  );
  const cachedGradingPeriod = allGradingPeriods?.find(
    (p) => p._id === gradingPeriodIdTyped
  );
  const cachedCourse = cachedGradingPeriod?.courses?.[index];

  const courseQuery = useQuery(
    api.gradingPeriods.getCourseById,
    isAuthenticated && isValidIndex
      ? {
          gradingPeriodId: gradingPeriodIdTyped,
          courseIndex: index,
        }
      : "skip"
  );

  const gradingPeriodQuery = useQuery(
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
