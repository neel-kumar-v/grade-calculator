"use client";
import { useState } from "react";
import Link from "next/link";
import { Calendar, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { CreateGradingPeriodModal } from "./CreateGradingPeriodModal";
import type { Doc } from "../convex/_generated/dataModel";

interface GradingPeriodsProps {
  gradingPeriods: Doc<"gradingPeriods">[] | undefined;
}

// Convert percentage (0-100) to GPA (0-4.0) using standard 4.0 scale
export function percentageToGPA(percentage: number): number {
  if (percentage >= 93) return 4.0;
  if (percentage >= 90) return 3.7;
  if (percentage >= 87) return 3.3;
  if (percentage >= 83) return 3.0;
  if (percentage >= 80) return 2.7;
  if (percentage >= 77) return 2.3;
  if (percentage >= 73) return 2.0;
  if (percentage >= 70) return 1.7;
  if (percentage >= 67) return 1.3;
  if (percentage >= 65) return 1.0;
  return 0.0;
}

// Calculate total credits for a grading period
function calculateTotalCredits(gradingPeriod: Doc<"gradingPeriods">): number {
  return gradingPeriod.courses.reduce((sum, course) => sum + course.credits, 0);
}

export default function GradingPeriods({ gradingPeriods }: GradingPeriodsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  let content = null;

  if (gradingPeriods === undefined) {
    content = <div>Loading...</div>;
  } else if (gradingPeriods.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <Calendar className="size-16 text-muted-foreground" />
        <h2 className="text-3xl font-semibold">No grading periods yet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Get started by creating your first grading period.
        </p>
        <Button onClick={() => setIsModalOpen(true)} size="lg">
          Create Grading Period
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
              const courseGPA = percentageToGPA(course.grade);
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
              const courseGPA = percentageToGPA(course.grade);
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
                        {gpa.toFixed(2)}
                      </div>
                    )}
                    {coreGpa !== null && (
                      <div className="text-sm text-muted-foreground">
                        {coreGpa.toFixed(2)}
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
        <h1 className="text-2xl font-bold">Your Grading Periods</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="size-4" />
          Add Grading Period
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