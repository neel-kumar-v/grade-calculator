"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { CreateCategoryModal } from "./CreateCategoryModal";
import { Plus, Trash, TriangleAlert } from "lucide-react";

type GradingPeriod = Doc<"gradingPeriods">;
type Course = GradingPeriod["courses"][number];
type Assignment = { score: number; max_score: number };
type Category = Omit<NonNullable<Course["categories"]>[number], "assignments" | "grade"> & {
  assignments?: Assignment[];
  grade: number;
};

interface CourseCategoriesProps {
  gradingPeriodId: Id<"gradingPeriods">;
  courseIndex: number;
  course: Course;
}

function normalizeCourse(course: Course): Course {
  const categories: Category[] = (course.categories ?? []).map((cat) => {
    const gradeVal =
      typeof cat.grade === "number"
        ? cat.grade
        : (cat as any)?.grade?.max_score
          ? ((cat as any).grade.score / (cat as any).grade.max_score) * 100
          : 0;
    return {
      ...(cat as Category),
      assignments: (cat.assignments ?? []) as Assignment[],
      grade: gradeVal,
    };
  });
  const courseGrade =
    typeof course.grade === "number"
      ? course.grade
      : (course as any)?.grade?.max_score
        ? ((course as any).grade.score / (course as any).grade.max_score) * 100
        : 0;
  return {
    ...course,
    grade: courseGrade,
    categories,
  };
}

function assignmentPercent(a: Assignment): number {
  if (!a || a.max_score <= 0) return 0;
  return a.score / a.max_score;
}

function categoryGrade(category: Category, allCategories?: Category[]): number {
  if (!category) return 0;
  if (category.manual) {
    return category.grade / 100;
  }
  let assignments = [...(category.assignments ?? [])];
  if (!assignments.length) return 0;

  // Apply drop policy if configured
  try {
    if (!category.drop_policy) throw new Error();
    const dropCount = category.drop_policy.drop_count;
    if (dropCount <= 0 || assignments.length <= dropCount) throw new Error();
    
    const withIndices = assignments.map((a, idx) => ({ 
      assignment: a, 
      index: idx 
    }));
    withIndices.sort((a, b) => {
      const percentA = assignmentPercent(a.assignment);
      const percentB = assignmentPercent(b.assignment);
      return percentA - percentB;
    });

    // Get the lowest N assignment indices to drop/replace
    const toDropIndices = new Set(withIndices.slice(0, dropCount).map(item => item.index));

    if (category.drop_policy.drop_with === undefined) assignments = assignments.filter((_, idx) => !toDropIndices.has(idx));
    else {
      const replaceCategoryIndex = category.drop_policy.drop_with;
      if (!allCategories || !allCategories[replaceCategoryIndex]) throw new Error();

      const replaceCategory = allCategories[replaceCategoryIndex];
      const replaceGrade = categoryGrade(replaceCategory, allCategories);


      assignments = assignments.map((assignment, idx) => {
        if (!toDropIndices.has(idx)) return assignment;
        return {
          score: replaceGrade * assignment.max_score,
          max_score: assignment.max_score,
        };
      });
    }
  } catch {
    // Skip drop policy processing used as a continue
  }

  if (category.evenly_weighted) {
    const avg =
      assignments.reduce((sum, a) => sum + assignmentPercent(a), 0) /
      assignments.length;
    return avg;
  }
  const sumScore = assignments.reduce((s, a) => s + a.score, 0);
  const sumMax = assignments.reduce((s, a) => s + a.max_score, 0);
  return sumMax > 0 ? sumScore / sumMax : 0;
}

function finalCourseGrade(course: Course): number {
  const categories = course.categories ?? [];
  if (!categories.length) return 0;

  let numerator = 0;
  let denominator = 0;
  for (const cat of categories) {
    const grade = categoryGrade(cat, categories);
    if (cat.extra_credit) {
      numerator += cat.weight * grade;
    } else {
      numerator += cat.weight * grade;
      denominator += cat.weight;
    }
  }
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export function CourseCategories({
  gradingPeriodId,
  courseIndex,
  course,
}: CourseCategoriesProps) {
  const updateCourse = useMutation(api.gradingPeriods.updateCourse);

  const [whatIf, setWhatIf] = useState(false);
  const [draftCourse, setDraftCourse] = useState<Course | null>(null);
  const [liveCourse, setLiveCourse] = useState<Course>(() => normalizeCourse(course));
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  // Track input string values for decimal inputs
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const normalized = useMemo(() => normalizeCourse(course), [course]);
  useEffect(() => {
    if (!whatIf) {
      setLiveCourse(normalized);
    }
  }, [normalized, whatIf]);

  const workingCourse = whatIf && draftCourse ? draftCourse : liveCourse;

  const actualGrade = useMemo(() => {
    if (normalized.manual) {
      return normalized.grade / 100;
    }
    return finalCourseGrade(normalized);
  }, [normalized]);
  const simulatedGrade = useMemo(
    () => {
      if (whatIf && draftCourse) {
        if (draftCourse.manual) {
          return draftCourse.grade / 100;
        }
        return finalCourseGrade(draftCourse);
      }
      return null;
    },
    [whatIf, draftCourse]
  );

  const normalizeForSave = (c: Course): Course => {
  const categories: Category[] = (c.categories ?? []).map((cat) => {
      const gradeNumber = categoryGrade(cat, c.categories ?? []) * 100;
      return {
        ...cat,
        grade: gradeNumber,
      };
    });
    const courseGrade = finalCourseGrade({ ...c, categories }) * 100;
    return {
      ...c,
      categories,
      grade: courseGrade,
    };
  };

  const updateLocalAndPersist = (next: Course) => {
    setLiveCourse(next);
    void updateCourse({
      gradingPeriodId,
      courseIndex,
      course: normalizeForSave(next),
    });
  };

  const setCategory = (index: number, updater: (c: Category) => Category) => {
    if (whatIf) {
      setDraftCourse((prev) => {
        if (!prev) return prev;
        const categories = [...(prev.categories ?? [])];
        if (!categories[index]) return prev;
        categories[index] = updater(categories[index]);
        return { ...prev, categories };
      });
    } else {
      setLiveCourse((prev) => {
        const categories = [...(prev.categories ?? [])];
        if (!categories[index]) return prev;
        categories[index] = updater(categories[index]);
        const next = { ...prev, categories };
        updateLocalAndPersist(next);
        return next;
      });
    }
  };

  const addAssignment = (catIndex: number) => {
    setCategory(catIndex, (c) => ({
      ...c,
      assignments: [...(c.assignments ?? []), { score: 0, max_score: 100 }],
      grade: categoryGrade({
        ...c,
        assignments: [...(c.assignments ?? []), { score: 0, max_score: 100 }],
      }, workingCourse.categories ?? []) * 100,
    }));
  };

  const updateAssignment = (
    catIndex: number,
    assignIndex: number,
    updater: (a: Assignment) => Assignment
  ) => {
    setCategory(catIndex, (c) => {
      const assignments = [...((c.assignments ?? []) as Assignment[])];
      if (!assignments[assignIndex]) return c;
      assignments[assignIndex] = updater(assignments[assignIndex]);
      const nextCat: Category = { ...(c as Category), assignments };
      return { ...nextCat, grade: categoryGrade(nextCat, workingCourse.categories ?? []) * 100 };
    });
  };

  const removeAssignment = (catIndex: number, assignIndex: number) => {
    setCategory(catIndex, (c) => {
      const assignments = [...((c.assignments ?? []) as Assignment[])];
      assignments.splice(assignIndex, 1);
      const nextCat: Category = { ...(c as Category), assignments };
      return { ...nextCat, grade: categoryGrade(nextCat, workingCourse.categories ?? []) * 100 };
    });
  };

  const handleAddCategory = (category: Category) => {
    const target = whatIf && draftCourse ? draftCourse : liveCourse;
    const nextCategories = [...(target.categories ?? []), category];
    const nextCourse = {
      ...target,
      categories: nextCategories,
    };

    if (whatIf) {
      setDraftCourse(nextCourse);
    } else {
      updateLocalAndPersist(nextCourse);
    }
  };

  const handleSave = async () => {
    if (!draftCourse) return;
    const normalizedCourse = normalizeForSave(draftCourse);
    await updateCourse({
      gradingPeriodId,
      courseIndex,
      course: normalizedCourse,
    });
    setWhatIf(false);
    setDraftCourse(null);
  };

  const handleCancel = () => {
    setWhatIf(false);
    setDraftCourse(null);
  };

  const toggleWhatIf = () => {
    if (!whatIf) {
      setDraftCourse(normalizeCourse(course));
      setWhatIf(true);
    } else {
      setWhatIf(false);
      setDraftCourse(null);
    }
  };

  const renderCategoryGrade = (cat: Category, idx: number) => {
    const actual = categoryGrade(normalized.categories?.[idx] ?? cat, normalized.categories ?? []);
    const sim = whatIf && draftCourse ? categoryGrade(cat, draftCourse.categories ?? []) : null;
    const percent = (val: number) => {
      const num = val * 100;
      // Remove .00 but keep other decimals like .50
      return `${num.toFixed(2).replace(/\.00$/, '')}%`;
    };
    const weight = cat.weight;
    const actualWeighted = actual * weight / 100;
    const simWeighted = sim !== null ? sim * weight / 100 : null;
    
    if (sim === null) {
      return (
        <div className="flex flex-row items-center gap-2">
          <span className="text-sm text-muted-foreground">{percent(actual)}</span>
          <span>{percent(actualWeighted)}</span>
        </div>
      );
    }
    
    const diff = simWeighted! - actualWeighted;
    const color = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground";
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{percent(actual)}</span>
          <span className="text-sm text-muted-foreground">{percent(sim)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{percent(actualWeighted)}</span>
          <span className={color}>{percent(simWeighted!)}</span>
        </div>
      </div>
    );
  };

  const percentLabel = (val: number) => {
    const num = val * 100;
    // Remove .00 but keep other decimals like .50
    return `${num.toFixed(2).replace(/\.00$/, '')}%`;
  };

  return (
    <div className="container max-w-2xl  mx-auto py-12 px-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{normalized.name}</h1>
          <p className="text-sm text-muted-foreground">
            {normalized.credits} credit{normalized.credits !== 1 ? "s" : ""}
          </p>
        </div>
        {!normalized.manual && (
          <div className="flex items-center gap-2">
            {!whatIf && <label className="flex items-center gap-2 text-sm">
              <Button
                variant={whatIf ? "default" : "outline"}
                onClick={toggleWhatIf}
                type="button"
              >
                What-if mode
              </Button>
            </label>}
            {whatIf && (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={handleSave}>Save changes</Button>
              </>
            )}
            <Button variant="outline" className="ml-2" onClick={() => setIsCategoryModalOpen(true)}>
              <Plus className="size-4" />
              Add Category
            </Button>
          </div>
        )}
      </div>

      {normalized.manual && (
        <div className="p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Overall grade is set directly and does not depend on categories or assignments.
          </p>
        </div>
      )}
      {!normalized.manual && (() => {
        const totalWeight = (normalized.categories ?? [])
          .filter(cat => !cat.extra_credit)
          .reduce((sum, cat) => sum + cat.weight, 0);
        const weightsAddUp = Math.abs(totalWeight - 100) < 0.01; // Allow small floating point differences
        if (!weightsAddUp) {
          return (
            <div className="p-4 rounded-lg bg-destructive/10">
              <p className="text-sm text-destructive/75 flex flex-row gap-2 items-center">
                <TriangleAlert className="size-4" />
                Category weights do not add up to 100% (currently {totalWeight.toFixed(2)}%).
              </p>
            </div>
          );
        }
        return null;
      })()}

      {!normalized.manual && (
        <Accordion type="multiple" className="w-full">
        {(workingCourse.categories ?? []).map((category, catIndex) => (
          <AccordionItem key={catIndex} value={`cat-${catIndex}`}>
            <AccordionTrigger>
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium">{category.name}</span>
                  {category.extra_credit && (
                    <span className="text-xs text-muted-foreground">Extra credit</span>
                  )}
                </div>
                <div className="text-lg  font-medium">
                  {renderCategoryGrade(category, catIndex)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {category.manual ? (
                <div className="space-y-3">
                  {/* <Label className="text-sm">Manual grade (fraction)</Label> */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={inputValues[`manual-grade-${catIndex}`] ?? String((category.grade / 100) * 100)}
                      onChange={(e) => {
                        const value = e.target.value;
                        const key = `manual-grade-${catIndex}`;
                        // Allow empty, numbers, and decimal point
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          // Store the string value for display
                          setInputValues(prev => ({ ...prev, [key]: value }));
                          // Update the actual value if it's a complete number
                          if (value !== "" && value !== "." && !value.endsWith(".")) {
                            const numValue = Number(value);
                            if (!isNaN(numValue)) {
                              setCategory(catIndex, (c) => ({
                                ...c,
                                grade: numValue,
                              }));
                            }
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const key = `manual-grade-${catIndex}`;
                        const numValue = value === "" || value === "." ? 0 : Number(value) || 0;
                        setCategory(catIndex, (c) => ({
                          ...c,
                          grade: numValue,
                        }));
                        setInputValues(prev => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                      className="w-24"
                      inputMode="decimal"
                      disabled={false}
                    />
                    <span>/</span>
                    <Input readOnly value={100} className="w-24 bg-muted" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={category.evenly_weighted}
                        onCheckedChange={(v) =>
                          setCategory(catIndex, (c) => ({
                            ...c,
                            evenly_weighted: v === true,
                          }))
                        }
                      //   disabled={!whatIf}
                      />
                      <span className="text-sm">Evenly Weighted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">Drop lowest:</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={category.drop_policy?.drop_count ?? 0}
                        onChange={(e) => {
                          const dropCount = Math.max(0, Math.floor(Number(e.target.value) || 0));
                          setCategory(catIndex, (c) => ({
                            ...c,
                            drop_policy: dropCount > 0
                              ? {
                                  drop_count: dropCount,
                                  drop_with: c.drop_policy?.drop_with,
                                }
                              : undefined,
                          }));
                        }}
                        className="w-16"
                        inputMode="numeric"
                      />
                    </div>
                    {(category.drop_policy?.drop_count ?? 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm whitespace-nowrap">Replace with:</Label>
                        <Select
                          value={
                            category.drop_policy?.drop_with === undefined
                              ? "drop"
                              : category.drop_policy.drop_with.toString()
                          }
                          onValueChange={(value) => {
                            setCategory(catIndex, (c) => ({
                              ...c,
                              drop_policy: c.drop_policy
                                ? {
                                    ...c.drop_policy,
                                    drop_with: value === "drop" ? undefined : Number(value),
                                  }
                                : undefined,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="drop">Dropped completely</SelectItem>
                            {(workingCourse.categories ?? [])
                              .map((cat, idx) => ({ cat, idx }))
                              .filter(({ idx }) => idx !== catIndex)
                              .map(({ cat, idx }) => (
                                <SelectItem key={idx} value={idx.toString()}>
                                  Replaced with {cat.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {(category.assignments ?? []).map((assignment, assignIndex) => (
                      <div
                        key={assignIndex}
                        className="flex items-center gap-2 border border-border rounded-md px-3 py-2"
                      >
                        <Input
                          type="text"
                          value={inputValues[`score-${catIndex}-${assignIndex}`] ?? String(assignment.score)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const key = `score-${catIndex}-${assignIndex}`;
                            // Allow empty, numbers, and decimal point
                            if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                              // Store the string value for display
                              setInputValues(prev => ({ ...prev, [key]: value }));
                              // Update the actual value if it's a complete number
                              if (value !== "" && value !== "." && !value.endsWith(".")) {
                                const numValue = Number(value);
                                if (!isNaN(numValue)) {
                                  updateAssignment(catIndex, assignIndex, (a) => ({
                                    ...a,
                                    score: numValue,
                                  }));
                                }
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            const key = `score-${catIndex}-${assignIndex}`;
                            // On blur, ensure we have a valid number and clear the input value cache
                            const numValue = value === "" || value === "." ? 0 : Number(value) || 0;
                            updateAssignment(catIndex, assignIndex, (a) => ({
                              ...a,
                              score: numValue,
                            }));
                            setInputValues(prev => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                          }}
                          className="w-24"
                          inputMode="decimal"
                        />
                        <span>/</span>
                        <Input
                          type="text"
                          value={inputValues[`max_score-${catIndex}-${assignIndex}`] ?? String(assignment.max_score)}
                          onChange={(e) => {
                            const value = e.target.value;
                            const key = `max_score-${catIndex}-${assignIndex}`;
                            // Allow empty, numbers, and decimal point
                            if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                              // Store the string value for display
                              setInputValues(prev => ({ ...prev, [key]: value }));
                              // Update the actual value if it's a complete number
                              if (value !== "" && value !== "." && !value.endsWith(".")) {
                                const numValue = Number(value);
                                if (!isNaN(numValue)) {
                                  updateAssignment(catIndex, assignIndex, (a) => ({
                                    ...a,
                                    max_score: Math.max(1, numValue),
                                  }));
                                }
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value;
                            const key = `max_score-${catIndex}-${assignIndex}`;
                            const numValue = value === "" || value === "." ? 1 : Math.max(1, Number(value) || 1);
                            updateAssignment(catIndex, assignIndex, (a) => ({
                              ...a,
                              max_score: numValue,
                            }));
                            setInputValues(prev => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                          }}
                          className="w-24"
                          inputMode="decimal"
                        />
                        <div className="ml-auto">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="group"
                            onClick={() => removeAssignment(catIndex, assignIndex)}
                            // disabled={!whatIf}
                          >
                            <Trash className="size-4 stroke-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addAssignment(catIndex)}
                    //   disabled={!whatIf}
                    >
                      <Plus className="size-4" />
                      Add assignment
                    </Button>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
        </Accordion>
      )}

      <div className="flex flex-row gap-2 items-center justify-between pr-7">
        <span className="text-xl font-semibold">Overall Grade:</span>
        {normalized.manual ? (
          !whatIf ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={inputValues[`overall-grade-${courseIndex}`] ?? workingCourse.grade.toFixed(2)}
                onChange={(e) => {
                  const value = e.target.value;
                  const key = `overall-grade-${courseIndex}`;
                  // Allow empty, numbers, and decimal point
                  if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                    // Store the string value for display
                    setInputValues(prev => ({ ...prev, [key]: value }));
                    // Update the actual value if it's a complete number
                    if (value !== "" && value !== "." && !value.endsWith(".")) {
                      const newGrade = Number(value) || 0;
                      if (newGrade >= 0 && newGrade <= 100) {
                        const updatedCourse = { ...workingCourse, grade: newGrade };
                        if (whatIf) {
                          setDraftCourse(updatedCourse);
                        } else {
                          updateLocalAndPersist(updatedCourse);
                        }
                      }
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  const key = `overall-grade-${courseIndex}`;
                  const newGrade = value === "" || value === "." ? 0 : Number(value) || 0;
                  if (newGrade >= 0 && newGrade <= 100) {
                    const updatedCourse = { ...workingCourse, grade: newGrade };
                    if (whatIf) {
                      setDraftCourse(updatedCourse);
                    } else {
                      updateLocalAndPersist(updatedCourse);
                    }
                  }
                  setInputValues(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
                className="w-24 text-xl font-semibold"
                inputMode="decimal"
              />
              <span className="text-xl font-semibold">%</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={inputValues[`overall-grade-whatif-${courseIndex}`] ?? workingCourse.grade.toFixed(2)}
                onChange={(e) => {
                  const value = e.target.value;
                  const key = `overall-grade-whatif-${courseIndex}`;
                  // Allow empty, numbers, and decimal point
                  if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                    // Store the string value for display
                    setInputValues(prev => ({ ...prev, [key]: value }));
                    // Update the actual value if it's a complete number
                    if (value !== "" && value !== "." && !value.endsWith(".")) {
                      const newGrade = Number(value) || 0;
                      if (newGrade >= 0 && newGrade <= 100) {
                        setDraftCourse({ ...workingCourse, grade: newGrade });
                      }
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  const key = `overall-grade-whatif-${courseIndex}`;
                  const newGrade = value === "" || value === "." ? 0 : Number(value) || 0;
                  if (newGrade >= 0 && newGrade <= 100) {
                    setDraftCourse({ ...workingCourse, grade: newGrade });
                  }
                  setInputValues(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
                className="w-24 text-xl font-semibold"
                inputMode="decimal"
              />
              <span className="text-xl font-semibold">%</span>
            </div>
          )
        ) : (
          <>
            {!whatIf && <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">{percentLabel(actualGrade)}</span>
            </div>}
            {whatIf && simulatedGrade !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold">{percentLabel(simulatedGrade)}</span>
                <span
                  className={
                    simulatedGrade - actualGrade > 0
                      ? "text-green-600"
                      : simulatedGrade - actualGrade < 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                  }
                >
                  ({(simulatedGrade - actualGrade >= 0 ? "+" : "") +
                    ((simulatedGrade - actualGrade) * 100).toFixed(2) +
                    "%"})
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <CreateCategoryModal
        open={isCategoryModalOpen}
        onOpenChange={setIsCategoryModalOpen}
        onCreate={handleAddCategory}
      />
    </div>
  );
}


