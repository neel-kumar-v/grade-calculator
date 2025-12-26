"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Calendar, Plus, Pencil } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Button } from "./ui/button";
import { CreateGradingPeriodModal } from "./CreateGradingPeriodModal";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { getScaleByName, calculateGPA, SCALE_NAMES } from "../lib/gpa";
import { useGradingPeriodName } from "../hooks/useGradingPeriodName";

interface GradingPeriodsProps {
  gradingPeriods: Doc<"gradingPeriods">[] | undefined;
}

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

// Calculate overall weighted GPA across all grading periods
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

// Calculate overall weighted core GPA across all grading periods
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

export default function GradingPeriods({ gradingPeriods }: GradingPeriodsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGradingPeriod, setEditingGradingPeriod] = useState<Doc<"gradingPeriods"> | null>(null);
  const settings = useQuery(api.settings.get);
  const gradingPeriodName = useGradingPeriodName();

  const handleEditGradingPeriod = (gradingPeriod: Doc<"gradingPeriods">) => {
    setEditingGradingPeriod(gradingPeriod);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingGradingPeriod(null);
  };

  const scale = useMemo(() => {
    if (!settings || !("gpaScale" in settings)) return getScaleByName("STANDARD_4_0");
    const settingsDoc = settings as any;
    return getScaleByName(settingsDoc.gpaScale, settingsDoc.customScale);
  }, [settings]);

  const isWAM = scale === "WAM";
  const gpaLabel = isWAM ? "WAM" : "GPA";

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
            <div key={gradingPeriod._id} className="group relative">
              <Button
                variant="ghost"
                size="icon"
                title="Edit grading period"
                fakeButton
                className="absolute left-0 -translate-x-10 translate-y-4 self-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEditGradingPeriod(gradingPeriod);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Link
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
            </div>
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
      {gradingPeriods && gradingPeriods.length > 0 && (overallGPA !== null || overallCoreGPA !== null) && (
        <div className="w-full p-6 rounded-lg bg-card border border-border">
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
      {content}
      <CreateGradingPeriodModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        editingGradingPeriod={editingGradingPeriod ?? undefined}
      />
    </div>
  );
}