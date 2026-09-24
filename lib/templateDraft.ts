import type { Doc } from "../convex/_generated/dataModel";

type Template = Doc<"templates">;
type Category = Template["categories"][number];

export interface TemplateDraftCourse {
  name: string;
  credits: number;
  manual: false;
  grade: number;
  from_extra_credit: number;
  part_of_degree: boolean;
  categories: Category[];
}

export interface TemplateDraft {
  templateId: string;
  university: string;
  courseCode: string;
  courseTitle: string;
  instructor: string;
  course: TemplateDraftCourse;
  updatedAt: number;
}

const TEMPLATE_DRAFT_PREFIX = "templateDraft:";
const LEGACY_COURSE_KEY = "templateCourseData";
const LEGACY_TEMPLATE_KEY = "templateTemplateData";

function isBrowser() {
  return typeof window !== "undefined";
}

function getDraftKey(templateId: string) {
  return `${TEMPLATE_DRAFT_PREFIX}${templateId}`;
}

export function loadTemplateDraft(templateId: string): TemplateDraft | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(getDraftKey(templateId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TemplateDraft;
  } catch (error) {
    console.error("Failed to parse template draft from localStorage:", error);
    return null;
  }
}

export function saveTemplateDraft(draft: TemplateDraft): void {
  if (!isBrowser()) return;
  localStorage.setItem(getDraftKey(draft.templateId), JSON.stringify(draft));
}

export function clearTemplateDraft(templateId: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(getDraftKey(templateId));
}

export function migrateLegacyTemplateSessionDraft(
  templateId: string,
  fallbackMeta: Pick<TemplateDraft, "university" | "courseCode" | "courseTitle" | "instructor">
): TemplateDraft | null {
  if (!isBrowser()) return null;
  const existing = loadTemplateDraft(templateId);
  if (existing) return existing;

  const rawCourse = sessionStorage.getItem(LEGACY_COURSE_KEY);
  const rawTemplate = sessionStorage.getItem(LEGACY_TEMPLATE_KEY);
  if (!rawCourse || !rawTemplate) return null;

  try {
    const parsedCourse = JSON.parse(rawCourse) as {
      name?: string;
      credits?: number;
      grade?: number;
      categories?: Category[];
    };
    const parsedTemplate = JSON.parse(rawTemplate) as {
      university?: string;
      courseCode?: string;
      courseTitle?: string;
      instructor?: string;
    };

    if (!parsedCourse.categories || !Array.isArray(parsedCourse.categories)) {
      return null;
    }

    const migrated: TemplateDraft = {
      templateId,
      university: parsedTemplate.university ?? fallbackMeta.university,
      courseCode: parsedTemplate.courseCode ?? fallbackMeta.courseCode,
      courseTitle: parsedTemplate.courseTitle ?? fallbackMeta.courseTitle,
      instructor: parsedTemplate.instructor ?? fallbackMeta.instructor,
      course: {
        name:
          parsedCourse.name ??
          `${parsedTemplate.courseCode ?? fallbackMeta.courseCode} - ${
            parsedTemplate.courseTitle ?? fallbackMeta.courseTitle
          }`,
        credits: parsedCourse.credits ?? 3,
        manual: false,
        grade: parsedCourse.grade ?? 0,
        from_extra_credit: 0,
        part_of_degree: false,
        categories: parsedCourse.categories,
      },
      updatedAt: Date.now(),
    };
    saveTemplateDraft(migrated);
    sessionStorage.removeItem(LEGACY_COURSE_KEY);
    sessionStorage.removeItem(LEGACY_TEMPLATE_KEY);
    return migrated;
  } catch (error) {
    console.error("Failed to migrate legacy template draft:", error);
    return null;
  }
}

