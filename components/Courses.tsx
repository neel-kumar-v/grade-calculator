"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CreateCourseModal } from "./CreateCourseModal";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { percentageToGPA } from "./GradingPeriods";
interface CoursesProps {
  gradingPeriodId: Id<"gradingPeriods">;
  gradingPeriod: Doc<"gradingPeriods">;
}

function convertGradeToLetter(grade: number): string {
  switch (true) {
    case grade >= 97: return "A+";
    case grade >= 93: return "A";
    case grade >= 90: return "A-";
    case grade >= 87: return "B+";
    case grade >= 83: return "B";
    case grade >= 80: return "B-";
    case grade >= 77: return "C+";
    case grade >= 73: return "C";
    case grade >= 70: return "C-";
    case grade >= 67: return "D+";
    case grade >= 65: return "D";
    case grade >= 63: return "D-";
    default: return "F";
  }
}

// Calculate total credits for a grading period
function calculateTotalCredits(gradingPeriod: Doc<"gradingPeriods">): number {
  return gradingPeriod.courses.reduce((sum, course) => sum + course.credits, 0);
}

export function Courses({ gradingPeriodId, gradingPeriod }: CoursesProps) {
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [gradeValues, setGradeValues] = useState<Record<number, string>>({});
  const updateCourse = useMutation(api.gradingPeriods.updateCourse);
  const updateGrades = useMutation(api.gradingPeriods.updateGrades);

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
  let semesterGPA: number | null = null;
  let totalWeightedGPA = 0;
  let totalCreditsForGPA = 0;
  for (const course of gradingPeriod.courses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = percentageToGPA(course.grade);
      totalWeightedGPA += courseGPA * course.credits;
      totalCreditsForGPA += course.credits;
    }
  }
  semesterGPA = totalCreditsForGPA > 0 ? totalWeightedGPA / totalCreditsForGPA : null;

  // Calculate core GPA from courses directly
  let semesterCoreGPA: number | null = null;
  let totalWeightedCoreGPA = 0;
  let totalCoreCredits = 0;
  for (const course of gradingPeriod.courses) {
    if (course.part_of_degree && typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = percentageToGPA(course.grade);
      totalWeightedCoreGPA += courseGPA * course.credits;
      totalCoreCredits += course.credits;
    }
  }
  semesterCoreGPA = totalCoreCredits > 0 ? totalWeightedCoreGPA / totalCoreCredits : null;

  const handleGradeChange = (index: number, value: string) => {
    setGradeValues(prev => ({ ...prev, [index]: value }));
  };

  const handleGradeSave = async (index: number) => {
    const course = gradingPeriod.courses[index];
    if (!course || !course.manual) return;

    const value = gradeValues[index] ?? course.grade.toFixed(2);
    const newGrade = parseFloat(value);
    if (isNaN(newGrade) || newGrade < 0 || newGrade > 100) {
      // Reset to original value if invalid
      setGradeValues(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
      return;
    }

    const updatedCourse = {
      ...course,
      grade: newGrade,
    };

    await updateCourse({
      gradingPeriodId,
      courseIndex: index,
      course: updatedCourse,
    });

    // Clear the local value after saving
    setGradeValues(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
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

      {hasCourses && semesterGPA !== null && (
        <div className="p-3 pr-6 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Semester GPA</h2>
              <p className="text-sm text-muted-foreground">
                {totalCredits} credit{totalCredits !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-col items-end  gap-2">
              <div className="text-xl font-bold">
                {semesterGPA.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                {semesterCoreGPA !== null ? semesterCoreGPA.toFixed(2) : "N/A"}
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
            Get started by adding your first course to this grading period.
          </p>
          <Button onClick={() => setIsCourseModalOpen(true)} size="lg">
            Add Course
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {gradingPeriod.courses.map((course, index) => (
            <Link
              key={index}
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
          ))}
        </div>
      )}

      <CreateCourseModal
        open={isCourseModalOpen}
        onOpenChange={setIsCourseModalOpen}
        gradingPeriodId={gradingPeriodId}
      />
    </div>
  );
}


