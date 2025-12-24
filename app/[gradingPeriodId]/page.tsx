"use client";

import { use, useEffect } from "react";
import { useQuery } from "convex/react";
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
  const gradingPeriodIdTyped = gradingPeriodId as Id<"gradingPeriods">;
  const gradingPeriod = useQuery(api.gradingPeriods.getById, {
    id: gradingPeriodIdTyped,
  });

  useEffect(() => {
    if (gradingPeriod) {
      document.title = `${gradingPeriod.name} - Heavyweight`;
    }
  }, [gradingPeriod]);

  if (gradingPeriod === undefined) {
    return (
      <div className="flex flex-col container max-w-3xl  mx-auto py-12 gap-4 w-full">
        <div>Loading...</div>
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


