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
import { PublishTemplateModal } from "./templates/PublishTemplateModal";
import { ImportTemplateModal } from "./templates/ImportTemplateModal";
import { CategoryInputs, renderCategoryGradeDisplay } from "./CategoryInputs";
import { Plus, Trash, TriangleAlert, Download, Upload } from "lucide-react";

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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  const removeCategory = (catIndex: number) => {
    if (whatIf) {
      setDraftCourse((prev) => {
        if (!prev) return prev;
        const categories = [...(prev.categories ?? [])];
        categories.splice(catIndex, 1);
        return { ...prev, categories };
      });
    } else {
      setLiveCourse((prev) => {
        const categories = [...(prev.categories ?? [])];
        categories.splice(catIndex, 1);
        const next = { ...prev, categories };
        updateLocalAndPersist(next);
        return next;
      });
    }
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

  const incrementDownload = useMutation(api.templates.incrementDownload);

  const handleImportTemplate = async (template: Doc<"templates">) => {
    // Initialize categories from template with grades set to 100
    const importedCategories: Category[] = template.categories.map((cat) => {
      if (cat.manual) {
        return {
          ...cat,
          grade: 100,
          assignments: undefined,
        } as Category;
      } else {
        return {
          ...cat,
          grade: 0,
          assignments: [{ score: 100, max_score: 100 }],
        } as Category;
      }
    });

    const nextCourse = {
      ...liveCourse,
      categories: importedCategories,
    };

    updateLocalAndPersist(nextCourse);

    // Increment download count
    try {
      await incrementDownload({ id: template._id });
    } catch (error) {
      console.error("Failed to increment download count:", error);
    }
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
    const actualNormalized = normalized.categories?.[idx] ?? cat;
    return renderCategoryGradeDisplay(
      cat,
      actualNormalized,
      workingCourse.categories ?? [],
      normalized.categories ?? [],
      categoryGrade,
      percentLabel,
      sim,
      actual
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
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(true)}
              type="button"
            >
              <Plus className="size-4" />
              Add Category
            </Button>
            {(normalized.categories ?? []).length === 0 ? (
              <Button
                variant="default"
                onClick={() => setIsImportModalOpen(true)}
                type="button"
              >
                <Download className="size-4" />
                Import Template
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => setIsPublishModalOpen(true)}
                type="button"
              >
                <Upload className="size-4" />
                Publish Template
              </Button>
            )}
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
            <AccordionTrigger className="group relative">
              <Button
                variant="ghost"
                size="icon"
                title="Remove category"
                fakeButton
                className="absolute left-0 -translate-x-10 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCategory(catIndex);
                }}
              >
                <Trash className="size-4 stroke-destructive" />
              </Button>
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium">{category.name}</span>
                  {category.extra_credit && (
                    <span className="text-xs text-muted-foreground">Extra credit</span>
                  )}
                </div>
                <div className="text-lg font-medium">
                  {renderCategoryGrade(category, catIndex)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CategoryInputs
                category={category}
                catIndex={catIndex}
                allCategories={workingCourse.categories ?? []}
                inputValues={inputValues}
                setInputValues={setInputValues}
                onUpdateCategory={setCategory}
                onUpdateAssignment={updateAssignment}
                onAddAssignment={addAssignment}
                onRemoveAssignment={removeAssignment}
                categoryGrade={categoryGrade}
                percentLabel={percentLabel}
                whatIf={whatIf}
                normalizedCategories={normalized.categories ?? []}
              />
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
                  {Math.abs(simulatedGrade - actualGrade).toFixed(2).replace(/\.00$/, '')}%
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
      <PublishTemplateModal
        open={isPublishModalOpen}
        onOpenChange={setIsPublishModalOpen}
        course={normalized}
      />
      <ImportTemplateModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        onImport={handleImportTemplate}
      />
    </div>
  );
}


