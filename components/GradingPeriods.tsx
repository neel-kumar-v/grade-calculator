"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Calendar, Plus } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./ui/button";
import { CreateGradingPeriodModal } from "./CreateGradingPeriodModal";
import type { Doc } from "../convex/_generated/dataModel";
import { getScaleByName, calculateGPA, SCALE_NAMES } from "../lib/gpa";
import { useGradingPeriodName } from "../hooks/useGradingPeriodName";

interface GradingPeriodsProps {
  gradingPeriods: Doc<"gradingPeriods">[] | undefined;
}

// Calculate total credits for a grading period
function calculateTotalCredits(gradingPeriod: Doc<"gradingPeriods">): number {
  return gradingPeriod.courses.reduce((sum, course) => sum + course.credits, 0);
}

export default function GradingPeriods({ gradingPeriods }: GradingPeriodsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const settings = useQuery(api.settings.get);
  const gradingPeriodName = useGradingPeriodName();

  const scale = useMemo(() => {
    if (!settings || !("gpaScale" in settings)) return getScaleByName("STANDARD_4_0");
    const settingsDoc = settings as any;
    return getScaleByName(settingsDoc.gpaScale, settingsDoc.customScale);
  }, [settings]);

  const isWAM = scale === "WAM";
  const gpaLabel = isWAM ? "WAM" : "GPA";

  let content = null;

  if (gradingPeriods === undefined) {
    content = <div>Loading...</div>;
  } else if (gradingPeriods.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <Calendar className="size-16 text-muted-foreground" />
        <h2 className="text-3xl font-semibold">No {gradingPeriodName.toLowerCase()} yet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Get started by creating your first {gradingPeriodName.toLowerCase()}.
        </p>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          Create {gradingPeriodName.slice(0, -1)}
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-2">
        {gradingPeriods.map((gradingPeriod) => {
          const totalCredits = calculateTotalCredits(gradingPeriod);
          // Calculate GPA from courses to ensure accuracy
          let gpa: number | null = null;
          let totalWeightedGPA = 0;
          let totalCreditsForGPA = 0;
          for (const course of gradingPeriod.courses) {
            if (typeof course.grade === "number" && course.grade > 0) {
              const courseGPA = calculateGPA(course.grade, scale);
              totalWeightedGPA += courseGPA * course.credits;
              totalCreditsForGPA += course.credits;
            }
          }
          gpa = totalCreditsForGPA > 0 ? totalWeightedGPA / totalCreditsForGPA : null;
          
          // Calculate core GPA
          let coreGpa: number | null = null;
          let totalWeightedCoreGPA = 0;
          let totalCoreCredits = 0;
          for (const course of gradingPeriod.courses) {
            if (course.part_of_degree && typeof course.grade === "number" && course.grade > 0) {
              const courseGPA = calculateGPA(course.grade, scale);
              totalWeightedCoreGPA += courseGPA * course.credits;
              totalCoreCredits += course.credits;
            }
          }
          coreGpa = totalCoreCredits > 0 ? totalWeightedCoreGPA / totalCoreCredits : null;

          return (
            <Link
              key={gradingPeriod._id}
              href={`/${gradingPeriod._id}`}
              className="block"
            >
              <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-semibold">{gradingPeriod.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {totalCredits} credit
                      {totalCredits !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-px">
                    {gpa !== null && (
                      <div className="text-xl font-semibold">
                        {isWAM ? gpa.toFixed(2) + "%" : gpa.toFixed(2)}
                      </div>
                    )}
                    {coreGpa !== null && (
                      <div className="text-sm text-muted-foreground">
                        {isWAM ? coreGpa.toFixed(2) + "%" : coreGpa.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full container max-w-3xl mx-auto py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your {gradingPeriodName}</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="size-4" />
          Add {gradingPeriodName.slice(0, -1)}
        </Button>
      </div>
      {content}
      <CreateGradingPeriodModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}