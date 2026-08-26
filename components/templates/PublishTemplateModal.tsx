"use client";



import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Combobox } from "../ui/combobox";
import { toast } from "sonner";
import type { Doc } from "../../convex/_generated/dataModel";

type GradingPeriod = Doc<"gradingPeriods">;
type Course = GradingPeriod["courses"][number];
type Category = NonNullable<Course["categories"]>[number];

interface PublishTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course;
  gradingPeriodId: Id<"gradingPeriods">;
  courseIndex: number;
  existingTemplate?: (Doc<"templates"> & { isCreator?: boolean }) | null;
  onTemplateSaved?: (templateId: Id<"templates">) => void;
}

async function fetchColleges(query: string, page: number): Promise<{ data: string[]; hasMore: boolean }> {
  const response = await fetch(
    `/api/college_search?query=${encodeURIComponent(query)}&page=${page}&limit=20`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch colleges");
  }
  const result = await response.json();
  return {
    data: result.data || [],
    hasMore: result.pagination?.hasMore || false,
  };
}

export function PublishTemplateModal({
  open,
  onOpenChange,
  course,
  gradingPeriodId,
  courseIndex,
  existingTemplate,
  onTemplateSaved,
}: PublishTemplateModalProps) {
  const createTemplate = useMutation(api.templates.create);
  const updateTemplate = useMutation(api.templates.update);
  const updateCourse = useMutation(api.gradingPeriods.updateCourse);
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);

  const isEditMode = Boolean(existingTemplate);

  const [university, setUniversity] = useState<string>("");
  const [showCustomUniversity, setShowCustomUniversity] = useState(false);
  const [customUniversity, setCustomUniversity] = useState<string>("");
  const [courseCode, setCourseCode] = useState<string>("");
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [instructor, setInstructor] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing template data or user settings when opened
  useEffect(() => {
    if (open) {
      if (existingTemplate) {
        setUniversity(existingTemplate.university || settings?.university || "");
        setCourseCode(existingTemplate.courseCode || "");
        setCourseTitle(existingTemplate.courseTitle || "");
        setInstructor(existingTemplate.instructor || "");
        setShowCustomUniversity(false);
        setCustomUniversity("");
      } else {
        setUniversity(settings?.university || "");
        setCourseCode(course?.name || "");
        setCourseTitle("");
        setInstructor("");
        setShowCustomUniversity(false);
        setCustomUniversity("");
      }
    }
  }, [open, existingTemplate, settings, course]);

  const reset = () => {
    setUniversity(settings?.university || "");
    setShowCustomUniversity(false);
    setCustomUniversity("");
    setCourseCode("");
    setCourseTitle("");
    setInstructor("");
    setIsSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleUniversityChange = (value: string) => {
    setShowCustomUniversity(false);
    setUniversity(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalUniversity = showCustomUniversity ? customUniversity.trim() : university.trim();

    if (!finalUniversity) {
      toast.error("Please select or enter a university");
      return;
    }

    if (!courseCode.trim()) {
      toast.error("Please enter a course code");
      return;
    }

    if (!courseTitle.trim()) {
      toast.error("Please enter a course title");
      return;
    }

    if (!instructor.trim()) {
      toast.error("Please enter an instructor name");
      return;
    }

    if (!course.categories || course.categories.length === 0) {
      toast.error("Course must have at least one category to publish");
      return;
    }

    setIsSubmitting(true);

    try {
      // Update user's university setting if it changed
      if (finalUniversity !== settings?.university) {
        await updateSettings({ university: finalUniversity });
      }

      // Prepare categories for template (remove grade and assignments, keep structure)
      const templateCategories: Category[] = course.categories.map((cat) => {
        const { grade, assignments, ...categoryData } = cat;
        return {
          ...categoryData,
          grade: 0, // Reset grade
          assignments: cat.manual ? undefined : [{ score: 100, max_score: 100 }], // Reset assignments
        } as Category;
      });

      if (isEditMode && existingTemplate) {
        // Update existing template
        await updateTemplate({
          id: existingTemplate._id,
          university: finalUniversity,
          courseCode: courseCode.trim(),
          courseTitle: courseTitle.trim(),
          instructor: instructor.trim(),
          categories: templateCategories,
        });

        // Ensure course is linked to this template
        await updateCourse({
          gradingPeriodId,
          courseIndex,
          course: {
            ...course,
            templateId: existingTemplate._id,
          },
        });

        onTemplateSaved?.(existingTemplate._id);
        toast.success("Template updated successfully!");
      } else {
        // Create new template
        const templateId = await createTemplate({
          university: finalUniversity,
          courseCode: courseCode.trim(),
          courseTitle: courseTitle.trim(),
          instructor: instructor.trim(),
          categories: templateCategories,
        });

        // Link course to newly created template
        await updateCourse({
          gradingPeriodId,
          courseIndex,
          course: {
            ...course,
            templateId,
          },
        });

        onTemplateSaved?.(templateId);
        toast.success("Template published successfully!");
      }

      handleClose();
    } catch (error) {
      console.error(`Failed to ${isEditMode ? "update" : "publish"} template:`, error);
      toast.error(`Failed to ${isEditMode ? "update" : "publish"} template. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (\n    <Dialog open={open} onOpenChange={handleClose}>\n      <DialogContent className=\"max-w-2xl\">\n        <DialogHeader>\n          <DialogTitle>{isEditMode ? \"Edit Template\" : \"Publish Template\"}</DialogTitle>\n          <DialogDescription>\n            {isEditMode\n              ? \"Update your published course template. Changes will be visible to other students.\"\n              : \"Share your course structure with other students. Your template will be searchable by course code, title, and instructor.\"}\n          </DialogDescription>\n        </DialogHeader>\n        <form onSubmit={handleSubmit} className=\"space-y-4\">\n          <div className=\"space-y-2\">\n            <Label htmlFor=\"university\">University *</Label>\n            {!showCustomUniversity ? (\n              <>\n                <Combobox\n                  fetchOptions={fetchColleges}\n                  value={university}\n                  onValueChange={handleUniversityChange}\n                  placeholder=\"Select your university...\"\n                  searchPlaceholder=\"Search universities...\"\n                  emptyText=\"No universities found.\"\n                />\n                <Button\n                  type=\"button\"\n                  variant=\"outline\"\n                  size=\"sm\"\n                  onClick={() => {\n                    setShowCustomUniversity(true);\n                    setUniversity(\"\");\n                  }}\n                  className=\"mt-2\"\n                >\n                  Other\n                </Button>\n              </>\n            ) : (\n              <div className=\"space-y-2\">\n                <Input\n                  id=\"custom-university\"\n                  value={customUniversity}\n                  onChange={(e) => setCustomUniversity(e.target.value)}\n                  placeholder=\"Enter university name...\"\n                  required\n                />\n                <Button\n                  type=\"button\"\n                  variant=\"ghost\"\n                  size=\"sm\"\n                  onClick={() => {\n                    setShowCustomUniversity(false);\n                    setCustomUniversity(\"\");\n                    setUniversity(settings?.university || \"\");\n                  }}\n                >\n                  Use preset list\n                </Button>\n              </div>\n            )}\n          </div>\n\n          <div className=\"space-y-2\">\n            <Label htmlFor=\"course-code\">Course Code *</Label>\n            <Input\n              id=\"course-code\"\n              value={courseCode}\n              onChange={(e) => setCourseCode(e.target.value)}\n              placeholder=\"e.g., CS 101\"\n              required\n            />\n          </div>\n\n          <div className=\"space-y-2\">\n            <Label htmlFor=\"course-title\">Course Title / Description *</Label>\n            <Input\n              id=\"course-title\"\n              value={courseTitle}\n              onChange={(e) => setCourseTitle(e.target.value)}\n              placeholder=\"e.g., Introduction to Computer Science\"\n              required\n            />\n          </div>\n\n          <div className=\"space-y-2\">\n            <Label htmlFor=\"instructor\">Instructor *</Label>\n            <Input\n              id=\"instructor\"\n              value={instructor}\n              onChange={(e) => setInstructor(e.target.value)}\n              placeholder=\"e.g., Dr. Smith\"\n              required\n            />\n          </div>\n\n          <DialogFooter>\n            <Button type=\"button\" variant=\"outline\" onClick={handleClose}>\n              Cancel\n            </Button>\n            <Button type=\"submit\" disabled={isSubmitting}>\n              {isSubmitting\n                ? isEditMode\n                  ? \"Saving...\"\n                  : \"Publishing...\"\n                : isEditMode\n                  ? \"Save Changes\"\n                  : \"Publish Template\"}\n            </Button>\n          </DialogFooter>\n        </form>\n      </DialogContent>\n    </Dialog>\n  );\n}\n