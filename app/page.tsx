"use client";

import Image from "next/image";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { SignIn } from "../components/auth/SignIn";
import { SignOut } from "../components/auth/SignOut";
import GradingPeriods from "../components/GradingPeriods";
import type { Doc } from "../convex/_generated/dataModel";
import { useMemo } from "react";

// Convert percentage (0-100) to GPA (0-4.0) using standard 4.0 scale
function percentageToGPA(percentage: number): number {
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

// Calculate GPA for a grading period (always calculate from courses for accuracy)
function getGradingPeriodGPA(gradingPeriod: Doc<"gradingPeriods">): number | null {
  // Always calculate from courses to ensure accuracy, don't trust stored value
  let totalWeightedGPA = 0;
  let totalCredits = 0;
  
  for (const course of gradingPeriod.courses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = percentageToGPA(course.grade);
      totalWeightedGPA += courseGPA * course.credits;
      totalCredits += course.credits;
    }
  }
  
  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate core GPA for a grading period (always calculate from courses for accuracy)
function getGradingPeriodCoreGPA(gradingPeriod: Doc<"gradingPeriods">): number | null {
  // Always calculate from core courses to ensure accuracy
  const coreCourses = gradingPeriod.courses.filter(course => course.part_of_degree);
  
  let totalWeightedGPA = 0;
  let totalCredits = 0;
  
  for (const course of coreCourses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = percentageToGPA(course.grade);
      totalWeightedGPA += courseGPA * course.credits;
      totalCredits += course.credits;
    }
  }
  
  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate overall weighted GPA across all grading periods using stored semester GPAs
function calculateOverallGPA(gradingPeriods: Doc<"gradingPeriods">[]): number | null {
  // If there's only one grading period, return its GPA directly
  if (gradingPeriods.length === 1) {
    return getGradingPeriodGPA(gradingPeriods[0]);
  }
  
  let totalWeightedGPA = 0;
  let totalCredits = 0;

  for (const gradingPeriod of gradingPeriods) {
    const periodCredits = calculateTotalCredits(gradingPeriod);
    const periodGPA = getGradingPeriodGPA(gradingPeriod);
    
    if (periodCredits > 0 && periodGPA !== null) {
      totalWeightedGPA += periodGPA * periodCredits;
      totalCredits += periodCredits;
    }
  }

  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate overall weighted core GPA across all grading periods using stored core GPAs
function calculateOverallCoreGPA(gradingPeriods: Doc<"gradingPeriods">[]): number | null {
  // If there's only one grading period, return its core GPA directly
  if (gradingPeriods.length === 1) {
    return getGradingPeriodCoreGPA(gradingPeriods[0]);
  }
  
  let totalWeightedCoreGPA = 0;
  let totalCoreCredits = 0;

  for (const gradingPeriod of gradingPeriods) {
    // Calculate core credits for this grading period
    const coreCredits = gradingPeriod.courses
      .filter(course => course.part_of_degree)
      .reduce((sum, course) => sum + course.credits, 0);
    
    const periodCoreGPA = getGradingPeriodCoreGPA(gradingPeriod);
    
    if (coreCredits > 0 && periodCoreGPA !== null) {
      totalWeightedCoreGPA += periodCoreGPA * coreCredits;
      totalCoreCredits += coreCredits;
    }
  }

  if (totalCoreCredits === 0) return null;
  return totalWeightedCoreGPA / totalCoreCredits;
}

export default function Home() {
  const gradingPeriods = useQuery(api.gradingPeriods.get);

  const overallGPA = useMemo(() => {
    if (!gradingPeriods || gradingPeriods.length === 0) return null;
    return calculateOverallGPA(gradingPeriods);
  }, [gradingPeriods]);

  const overallCoreGPA = useMemo(() => {
    if (!gradingPeriods || gradingPeriods.length === 0) return null;
    return calculateOverallCoreGPA(gradingPeriods);
  }, [gradingPeriods]);

  const totalCredits = useMemo(() => {
    if (!gradingPeriods) return 0;
    return gradingPeriods.reduce((sum, gp) => sum + calculateTotalCredits(gp), 0);
  }, [gradingPeriods]);

  return (
    <main className="flex min-h-screen container max-w-3xl  mx-auto flex-col items-start justify-start px-6 py-12 bg-background">
      <AuthLoading>Loading... </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        {gradingPeriods && gradingPeriods.length > 0 && (overallGPA !== null || overallCoreGPA !== null) && (
          <div className="w-full mb-8 p-6 rounded-lg bg-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Overall GPA</h2>
                <p className="text-sm text-muted-foreground">
                  {totalCredits} total credit{totalCredits !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-px">
                {overallGPA !== null && (
                  <div className="text-2xl font-bold">
                    {overallGPA.toFixed(2)}
                  </div>
                )}
                {overallCoreGPA !== null && (
                  <div className="text-sm text-muted-foreground">
                    {overallCoreGPA.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <GradingPeriods gradingPeriods={gradingPeriods ?? undefined} />
      </Authenticated>
    </main>
  );
}