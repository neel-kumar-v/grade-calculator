"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookOpen, Plus, Pencil } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./ui/button";
import { CreateCourseModal } from "./CreateCourseModal";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { getScaleByName, calculateGPA, convertGradeToLetter, SCALE_NAMES } from "../lib/gpa";
import { useGradingPeriodName } from "../hooks/useGradingPeriodName";

interface CoursesProps {
  gradingPeriodId: Id<"gradingPeriods">;
  gradingPeriod: Doc<"gradingPeriods">;
}

// Calculate total credits for a grading period
function calculateTotalCredits(gradingPeriod: Doc<"gradingPeriods">): number {
  return gradingPeriod.courses.reduce((sum, course) => sum + course.credits, 0);
}

export function Courses({ gradingPeriodId, gradingPeriod }: CoursesProps) {
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);
  const updateGrades = useMutation(api.gradingPeriods.updateGrades);
  const settings = useQuery(api.settings.get);
  const gradingPeriodName = useGradingPeriodName();

  const scale = useMemo(() => {
    if (!settings || !("gpaScale" in settings)) return getScaleByName("STANDARD_4_0");
    const settingsDoc = settings as any;
    return getScaleByName(settingsDoc.gpaScale, settingsDoc.customScale);
  }, [settings]);

  const isWAM = scale === "WAM";
  const gpaLabel = isWAM ? "WAM" : "GPA";

  const hasCourses = gradingPeriod.courses.length > 0;
  const totalCredits = calculateTotalCredits(gradingPeriod);
  
  // Check if GPA values need to be calculated and saved
  const needsGPACalculation = 
    (gradingPeriod.gpa === undefined || gradingPeriod.core_gpa === undefined) && 
    hasCourses &&
    gradingPeriod.courses.some(course => typeof course.grade === "number" && course.grade > 0);
  
  // Auto-save calculated GPA values if they're missing
  useEffect(() => {
    if (needsGPACalculation) {
      // Trigger recalculation to save GPA values
      updateGrades({ id: gradingPeriodId }).catch(console.error);
    }
  }, [needsGPACalculation, gradingPeriodId, updateGrades]);

  // Calculate GPA from courses directly to ensure accuracy (don't trust stored value)
  let periodGPA: number | null = null;
  let totalWeightedGPA = 0;
  let totalCreditsForGPA = 0;
  for (const course of gradingPeriod.courses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = calculateGPA(course.grade, scale);
      totalWeightedGPA += courseGPA * course.credits;
      totalCreditsForGPA += course.credits;
    }
  }
  periodGPA = totalCreditsForGPA > 0 ? totalWeightedGPA / totalCreditsForGPA : null;

  // Calculate core GPA from courses directly
  let periodCoreGPA: number | null = null;
  let totalWeightedCoreGPA = 0;
  let totalCoreCredits = 0;
  for (const course of gradingPeriod.courses) {
    if (course.part_of_degree && typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = calculateGPA(course.grade, scale);
      totalWeightedCoreGPA += courseGPA * course.credits;
      totalCoreCredits += course.credits;
    }
  }
  periodCoreGPA = totalCoreCredits > 0 ? totalWeightedCoreGPA / totalCoreCredits : null;

  const handleEditCourse = (index: number) => {
    setEditingCourseIndex(index);
    setIsCourseModalOpen(true);
  };

  const handleModalClose = () => {
    setIsCourseModalOpen(false);
    setEditingCourseIndex(null);
  };

  return (
    <div className="flex flex-col gap-4 w-full container max-w-3xl px-6 mx-auto py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{gradingPeriod.name}</h1>
        <Button onClick={() => setIsCourseModalOpen(true)}>
          <Plus className="size-4" />
          Add Course
        </Button>
      </div>

      {hasCourses && periodGPA !== null && (
        <div className="p-3 pr-6 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{gradingPeriodName.slice(0, -1)} {gpaLabel}</h2>
              <p className="text-sm text-muted-foreground">
                {totalCredits} credit{totalCredits !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-col items-end  gap-2">
              <div className="text-xl font-bold">
                {isWAM ? periodGPA.toFixed(2) + "%" : periodGPA.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                {periodCoreGPA !== null ? (isWAM ? periodCoreGPA.toFixed(2) + "%" : periodCoreGPA.toFixed(2)) : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasCourses ? (
        <div className="flex flex-col items-center justify-center py-16 gap-6">
          <BookOpen className="size-16 text-muted-foreground" />
          <h2 className="text-3xl font-semibold">No courses yet</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Get started by adding your first course to this {gradingPeriodName.toLowerCase().slice(0, -1)}.
          </p>
          <Button onClick={() => setIsCourseModalOpen(true)} size="lg">
            Add Course
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {gradingPeriod.courses.map((course, index) => (
            <div key={index} className="group relative">
              <Button
                variant="ghost"
                size="icon"
                title="Edit course"
                fakeButton
                className="absolute left-0 -translate-x-10 translate-y-4 self-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEditCourse(index);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Link
                href={`/${gradingPeriodId}/${index}`}
                className="block"
              >
                <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-base font-semibold">{course.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {course.credits} credit
                        {course.credits !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex flex-row gap-4">
                      {typeof course.grade === "number" && (
                        <div className="flex items-center gap-2 text-md font-medium text-muted-foreground">
                          {course.grade.toFixed(2)}%
                        </div>
                      )}
                      <span className="text-xl flex items-center min-w-10 justify-center font-semibold">
                        {convertGradeToLetter(course.grade)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      <CreateCourseModal
        open={isCourseModalOpen}
        onOpenChange={handleModalClose}
        gradingPeriodId={gradingPeriodId}
        editingCourse={editingCourseIndex !== null ? gradingPeriod.courses[editingCourseIndex] : undefined}
        courseIndex={editingCourseIndex ?? undefined}
      />
    </div>
  );
}


