"use client";

import { use, useEffect, useState } from "react";
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
import {
  loadTemplateDraft,
  migrateLegacyTemplateSessionDraft,
  saveTemplateDraft,
} from "../../../lib/templateDraft";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  categoryGrade as sharedCategoryGrade,
  finalCourseGrade as sharedFinalCourseGrade,
} from "../../../lib/gradeCalculations";
import {
  defaultAssignmentForKind,
  templateSeedAssignmentForKind,
} from "../../../lib/categoryKinds";

type Template = Doc<"templates">;
type Category = Template["categories"][number];
type Assignment = { score: number; max_score: number };

interface PageParams {
  templateId: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

function categoryGrade(
  category: Category & { assignments?: Assignment[] },
  allCategories?: (Category & { assignments?: Assignment[] })[]
): number {
  return sharedCategoryGrade(category as never, allCategories as never);
}

function finalCourseGrade(categories: Category[]): number {
  return sharedFinalCourseGrade(categories as never);
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
      const migratedDraft = migrateLegacyTemplateSessionDraft(templateId, {
        university: template.university,
        courseCode: template.courseCode,
        courseTitle: template.courseTitle,
        instructor: template.instructor,
      });
      const localDraft = loadTemplateDraft(templateId) ?? migratedDraft;

      const initialized = template.categories.map((cat) => {
        if (cat.manual) {
          return { ...cat, grade: 100, assignments: undefined };
        } else {
          return {
            ...cat,
            grade: 0,
            assignments: [templateSeedAssignmentForKind(cat.kind)],
          };
        }
      });

      if (
        localDraft?.course?.categories &&
        localDraft.course.categories.length === template.categories.length
      ) {
        setLocalCategories(localDraft.course.categories as (Category & { assignments?: Assignment[] })[]);
      } else {
        setLocalCategories(initialized);
      }
      setHasChanges(false);
    }
  }, [template, templateId]);

  // Track changes
  useEffect(() => {
    if (template && localCategories.length > 0) {
      // Check if any value has changed from initial state
      const hasAnyChange = localCategories.some((cat, idx) => {
        const original = template.categories[idx];
        if (cat.manual) {
          return cat.grade !== 100;
        } else {
          const seed = templateSeedAssignmentForKind(cat.kind);
          return (
            (cat.assignments?.length ?? 0) !== (original.assignments?.length ?? 0) ||
            Boolean(
              cat.assignments?.some(
                (a) => a.score !== seed.score || a.max_score !== seed.max_score
              )
            )
          );
        }
      });
      setHasChanges(hasAnyChange);

      const categoriesWithComputedGrades = localCategories.map((cat) => ({
        ...cat,
        grade: cat.manual ? cat.grade : categoryGrade(cat, localCategories) * 100,
      }));
      saveTemplateDraft({
        templateId,
        university: template.university,
        courseCode: template.courseCode,
        courseTitle: template.courseTitle,
        instructor: template.instructor,
        course: {
          name: `${template.courseCode} - ${template.courseTitle}`,
          credits: 3,
          manual: false,
          grade: finalCourseGrade(categoriesWithComputedGrades) * 100,
          from_extra_credit: 0,
          part_of_degree: false,
          categories: categoriesWithComputedGrades,
        },
        updatedAt: Date.now(),
      });
    }
  }, [localCategories, template, templateId]);

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
      assignments: [...(c.assignments ?? []), defaultAssignmentForKind(c.kind)],
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
      <div className="flex flex-col container max-w-2xl mx-auto py-16 gap-4">
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

  const categoryGradeFn = (
    cat: Category & { assignments?: Assignment[] },
    allCats?: (Category & { assignments?: Assignment[] })[]
  ) => {
    return categoryGrade(cat, allCats ?? localCategories);
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
                    category,
                    localCategories,
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

      {hasChanges && <TemplateSignupCTA templateId={template._id} />}
    </div>
  );
}
