"use client";


import { use, useEffect } from "react";
import { useQuery } from "convex/react";
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
  const gradingPeriodIdTyped = gradingPeriodId as Id<"gradingPeriods">;
  const index = Number(courseIndex);

  if (!Number.isFinite(index) || index < 0) {
    return <NotFound />;
  }

  const data = useQuery(api.gradingPeriods.getCourseById, {
    gradingPeriodId: gradingPeriodIdTyped,
    courseIndex: index,
  });

  const gradingPeriod = useQuery(api.gradingPeriods.getById, {
    id: gradingPeriodIdTyped,
  });

  useEffect(() => {
    if (data?.course && gradingPeriod) {
      document.title = `${data.course.name} (${gradingPeriod.name}) - Heavyweight`;
    }
  }, [data, gradingPeriod]);

  if (data === undefined) {
    return (
    <div className="flex flex-col container max-w-3xl  mx-auto py-16 gap-4">
      <div>Loading course...</div>
    </div>
  );
  }

  if (data === null) {
    return <NotFound />;
  }

  return (
    <CourseCategories
      gradingPeriodId={gradingPeriodIdTyped}
      courseIndex={data.courseIndex}
      course={data.course}
    />
  );
}


