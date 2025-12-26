"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { NotFound } from "../../../components/NotFound";
import { TemplateSignupCTA } from "../../../components/templates/TemplateSignupCTA";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { CategoryInputs, renderCategoryGradeDisplay } from "../../../components/CategoryInputs";
import type { Doc } from "../../../convex/_generated/dataModel";

type Template = Doc<"templates">;
type Category = Template["categories"][number];
type Assignment = { score: number; max_score: number };

interface PageParams {
  templateId: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

function assignmentPercent(a: Assignment): number {
  if (!a || a.max_score <= 0) return 0;
  return a.score / a.max_score;
}

function categoryGrade(category: Category & { assignments?: Assignment[] }): number {
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

    const toDropIndices = new Set(withIndices.slice(0, dropCount).map(item => item.index));

    if (category.drop_policy.drop_with === undefined) {
      assignments = assignments.filter((_, idx) => !toDropIndices.has(idx));
    } else {
      const replaceCategoryIndex = category.drop_policy.drop_with;
      // For template pages, we'll skip replacement logic as it's complex without all categories
      assignments = assignments.filter((_, idx) => !toDropIndices.has(idx));
    }
  } catch {
    // Skip drop policy processing
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

function finalCourseGrade(categories: Category[]): number {
  if (!categories.length) return 0;

  let numerator = 0;
  let denominator = 0;
  for (const cat of categories) {
    const grade = categoryGrade(cat as Category & { assignments?: Assignment[] });
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

export default function TemplatePage({ params }: PageProps) {
  const { templateId } = use(params);
  const templateIdTyped = templateId as Id<"templates">;
  const template = useQuery(api.templates.getById, { id: templateIdTyped });

  const [localCategories, setLocalCategories] = useState<
    (Category & { assignments?: Assignment[] })[]
  >([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state from template and increment download count
  useEffect(() => {
    if (template) {
      const initialized = template.categories.map((cat) => {
        if (cat.manual) {
          return { ...cat, grade: 100, assignments: undefined };
        } else {
          return {
            ...cat,
            grade: 0,
            assignments: [{ score: 100, max_score: 100 }],
          };
        }
      });
      setLocalCategories(initialized);
      setHasChanges(false);
    }
  }, [template]);

  // Track changes
  useEffect(() => {
    if (template && localCategories.length > 0) {
      // Check if any value has changed from initial state
      const hasAnyChange = localCategories.some((cat, idx) => {
        const original = template.categories[idx];
        if (cat.manual) {
          return cat.grade !== 100;
        } else {
          return cat.assignments?.some(
            (a, aIdx) =>
              a.score !== 100 ||
              a.max_score !== 100 ||
              (original.assignments?.length ?? 0) !== cat.assignments?.length
          );
        }
      });
      setHasChanges(hasAnyChange);

      // Store in sessionStorage when changes detected
      if (hasAnyChange) {
        const courseData = {
          name: `${template.courseCode} - ${template.courseTitle}`,
          credits: 3, // Default, user can change later
          manual: false,
          grade: 0,
          categories: localCategories.map((cat) => ({
            ...cat,
            grade: cat.manual ? cat.grade : categoryGrade(cat) * 100,
          })),
        };
        sessionStorage.setItem("templateCourseData", JSON.stringify(courseData));
        // Also store template metadata for signup flow
        sessionStorage.setItem("templateTemplateData", JSON.stringify({
          university: template.university,
          courseCode: template.courseCode,
          courseTitle: template.courseTitle,
        }));
      }
    }
  }, [localCategories, template]);

  const updateCategory = (
    catIndex: number,
    updater: (c: Category & { assignments?: Assignment[] }) => Category & { assignments?: Assignment[] }
  ) => {
    setLocalCategories((prev) => {
      const updated = [...prev];
      if (updated[catIndex]) {
        updated[catIndex] = updater(updated[catIndex]);
      }
      return updated;
    });
  };

  const updateAssignment = (
    catIndex: number,
    assignIndex: number,
    updater: (a: Assignment) => Assignment
  ) => {
    updateCategory(catIndex, (c) => {
      const assignments = [...(c.assignments ?? [])];
      if (assignments[assignIndex]) {
        assignments[assignIndex] = updater(assignments[assignIndex]);
      }
      return { ...c, assignments };
    });
  };

  const addAssignment = (catIndex: number) => {
    updateCategory(catIndex, (c) => ({
      ...c,
      assignments: [...(c.assignments ?? []), { score: 100, max_score: 100 }],
    }));
  };

  const removeAssignment = (catIndex: number, assignIndex: number) => {
    updateCategory(catIndex, (c) => {
      const assignments = [...(c.assignments ?? [])];
      assignments.splice(assignIndex, 1);
      return { ...c, assignments };
    });
  };

  // Set SEO metadata
  useEffect(() => {
    if (template) {
      const currentYear = new Date().getFullYear();
      document.title = `${template.courseCode} Grade Calculator - ${template.courseTitle}`;
      
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute(
          "content",
          `Easily calculate grades for ${template.courseCode} (${template.instructor}) ${currentYear}! Built by students ❤`
        );
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = `Easily calculate grades for ${template.courseCode} (${template.instructor}) ${currentYear}! Built by students ❤`;
        document.head.appendChild(meta);
      }
    }
  }, [template]);

  if (template === undefined) {
    return (
      <div className="flex flex-col container max-w-3xl mx-auto py-16 gap-4">
        <div>Loading template...</div>
      </div>
    );
  }

  if (template === null) {
    return <NotFound />;
  }

  const courseGrade = finalCourseGrade(localCategories);

  const percentLabel = (val: number) => {
    const num = val * 100;
    return `${num.toFixed(2).replace(/\.00$/, "")}%`;
  };

  const categoryGradeFn = (cat: Category & { assignments?: Assignment[] }, allCats?: Category[]) => {
    return categoryGrade(cat, allCats as (Category & { assignments?: Assignment[] })[]);
  };

  return (
    <div className="container max-w-2xl mx-auto py-12 px-6 flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">
          {template.courseCode} - {template.courseTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {template.instructor} • {template.university}
        </p>
      </div>

      <Accordion type="multiple" className="w-full">
        {localCategories.map((category, catIndex) => (
          <AccordionItem key={catIndex} value={`cat-${catIndex}`}>
            <AccordionTrigger>
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium">{category.name}</span>
                  {category.extra_credit && (
                    <span className="text-xs text-muted-foreground">Extra credit</span>
                  )}
                </div>
                <div className="text-lg font-medium">
                  {renderCategoryGradeDisplay(
                    category,
                    localCategories,
                    categoryGradeFn,
                    percentLabel
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CategoryInputs
                category={category}
                catIndex={catIndex}
                allCategories={localCategories}
                inputValues={inputValues}
                setInputValues={setInputValues}
                onUpdateCategory={updateCategory}
                onUpdateAssignment={updateAssignment}
                onAddAssignment={addAssignment}
                onRemoveAssignment={removeAssignment}
                categoryGrade={categoryGradeFn}
                percentLabel={percentLabel}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="flex flex-row gap-2 items-center justify-between pr-7">
        <span className="text-xl font-semibold">Overall Grade:</span>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold">{percentLabel(courseGrade)}</span>
        </div>
      </div>

      {hasChanges && <TemplateSignupCTA />}
    </div>
  );
}

