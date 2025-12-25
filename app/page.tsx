"use client";

import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { SignIn } from "../components/auth/SignIn";
import GradingPeriods from "../components/GradingPeriods";
import type { Doc } from "../convex/_generated/dataModel";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { getScaleByName, calculateGPA } from "../lib/gpa";

// Calculate total credits for a grading period
function calculateTotalCredits(gradingPeriod: Doc<"gradingPeriods">): number {
  return gradingPeriod.courses.reduce((sum, course) => sum + course.credits, 0);
}

// Calculate GPA for a grading period (always calculate from courses for accuracy)
function getGradingPeriodGPA(gradingPeriod: Doc<"gradingPeriods">, scale: ReturnType<typeof getScaleByName>): number | null {
  // Always calculate from courses to ensure accuracy, don't trust stored value
  let totalWeightedGPA = 0;
  let totalCredits = 0;
  
  for (const course of gradingPeriod.courses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = calculateGPA(course.grade, scale);
      totalWeightedGPA += courseGPA * course.credits;
      totalCredits += course.credits;
    }
  }
  
  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate core GPA for a grading period (always calculate from courses for accuracy)
function getGradingPeriodCoreGPA(gradingPeriod: Doc<"gradingPeriods">, scale: ReturnType<typeof getScaleByName>): number | null {
  // Always calculate from core courses to ensure accuracy
  const coreCourses = gradingPeriod.courses.filter(course => course.part_of_degree);
  
  let totalWeightedGPA = 0;
  let totalCredits = 0;
  
  for (const course of coreCourses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = calculateGPA(course.grade, scale);
      totalWeightedGPA += courseGPA * course.credits;
      totalCredits += course.credits;
    }
  }
  
  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate overall weighted GPA across all grading periods using stored grading period GPAs
function calculateOverallGPA(gradingPeriods: Doc<"gradingPeriods">[], scale: ReturnType<typeof getScaleByName>): number | null {
  // If there's only one grading period, return its GPA directly
  if (gradingPeriods.length === 1) {
    return getGradingPeriodGPA(gradingPeriods[0], scale);
  }
  
  let totalWeightedGPA = 0;
  let totalCredits = 0;

  for (const gradingPeriod of gradingPeriods) {
    const periodCredits = calculateTotalCredits(gradingPeriod);
    const periodGPA = getGradingPeriodGPA(gradingPeriod, scale);
    
    if (periodCredits > 0 && periodGPA !== null) {
      totalWeightedGPA += periodGPA * periodCredits;
      totalCredits += periodCredits;
    }
  }

  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate overall weighted core GPA across all grading periods using stored core GPAs
function calculateOverallCoreGPA(gradingPeriods: Doc<"gradingPeriods">[], scale: ReturnType<typeof getScaleByName>): number | null {
  // If there's only one grading period, return its core GPA directly
  if (gradingPeriods.length === 1) {
    return getGradingPeriodCoreGPA(gradingPeriods[0], scale);
  }
  
  let totalWeightedCoreGPA = 0;
  let totalCoreCredits = 0;

  for (const gradingPeriod of gradingPeriods) {
    // Calculate core credits for this grading period
    const coreCredits = gradingPeriod.courses
      .filter(course => course.part_of_degree)
      .reduce((sum, course) => sum + course.credits, 0);
    
    const periodCoreGPA = getGradingPeriodCoreGPA(gradingPeriod, scale);
    
    if (coreCredits > 0 && periodCoreGPA !== null) {
      totalWeightedCoreGPA += periodCoreGPA * coreCredits;
      totalCoreCredits += coreCredits;
    }
  }

  if (totalCoreCredits === 0) return null;
  return totalWeightedCoreGPA / totalCoreCredits;
}

function AuthWrapper({ 
  setIsAuthenticated, 
  children 
}: { 
  setIsAuthenticated: (value: boolean) => void; 
  children: ReactNode;
}) {
  useEffect(() => {
    setIsAuthenticated(true);
  }, [setIsAuthenticated]);
  return <>{children}</>;
}

function UnauthWrapper({ 
  setIsAuthenticated, 
  children 
}: { 
  setIsAuthenticated: (value: boolean) => void; 
  children: ReactNode;
}) {
  useEffect(() => {
    setIsAuthenticated(false);
  }, [setIsAuthenticated]);
  return <>{children}</>;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const gradingPeriods = useQuery(api.gradingPeriods.get);
  const settings = useQuery(api.settings.get);

  const scale = useMemo(() => {
    if (!settings) return getScaleByName("STANDARD_4_0");
    return getScaleByName(settings.gpaScale, settings.customScale);
  }, [settings]);

  const isWAM = scale === "WAM";
  const gpaLabel = isWAM ? "WAM" : "GPA";

  useEffect(() => {
    document.title = "Heavyweight";
  }, []);

  const overallGPA = useMemo(() => {
    if (!gradingPeriods || gradingPeriods.length === 0) return null;
    return calculateOverallGPA(gradingPeriods, scale);
  }, [gradingPeriods, scale]);

  const overallCoreGPA = useMemo(() => {
    if (!gradingPeriods || gradingPeriods.length === 0) return null;
    return calculateOverallCoreGPA(gradingPeriods, scale);
  }, [gradingPeriods, scale]);

  const totalCredits = useMemo(() => {
    if (!gradingPeriods) return 0;
    return gradingPeriods.reduce((sum, gp) => sum + calculateTotalCredits(gp), 0);
  }, [gradingPeriods]);

  return (
    <main className={`flex min-h-[90vh] container max-w-3xl  mx-auto flex-col px-6 py-12 bg-background ${isAuthenticated ? 'items-start justify-start' : 'items-center justify-center'}`}>
      <AuthLoading>Loading... </AuthLoading>
      <Unauthenticated>
        <UnauthWrapper setIsAuthenticated={setIsAuthenticated}>
          <SignIn />
        </UnauthWrapper>
      </Unauthenticated>
      <Authenticated>
        <AuthWrapper setIsAuthenticated={setIsAuthenticated}>
          {gradingPeriods && gradingPeriods.length > 0 && (overallGPA !== null || overallCoreGPA !== null) && (
            <div className="w-full mb-8 p-6 rounded-lg bg-black/3 dark:bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Overall {gpaLabel}</h2>
                  <p className="text-sm text-muted-foreground">
                    {totalCredits} total credit{totalCredits !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-px">
                  {overallGPA !== null && (
                    <div className="text-2xl font-bold">
                      {isWAM ? overallGPA.toFixed(2) + "%" : overallGPA.toFixed(2)}
                    </div>
                  )}
                  {overallCoreGPA !== null && (
                    <div className="text-sm text-muted-foreground">
                      {isWAM ? overallCoreGPA.toFixed(2) + "%" : overallCoreGPA.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <GradingPeriods gradingPeriods={gradingPeriods ?? undefined} />
        </AuthWrapper>
      </Authenticated>
    </main>
  );
}