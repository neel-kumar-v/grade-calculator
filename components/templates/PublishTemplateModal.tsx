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
}: PublishTemplateModalProps) {
  const createTemplate = useMutation(api.templates.create);
  const settings = useQuery(api.settings.get);
  const updateSettings = useMutation(api.settings.update);

  const [university, setUniversity] = useState<string>("");
  const [showCustomUniversity, setShowCustomUniversity] = useState(false);
  const [customUniversity, setCustomUniversity] = useState<string>("");
  const [courseCode, setCourseCode] = useState<string>("");
  const [courseTitle, setCourseTitle] = useState<string>("");
  const [instructor, setInstructor] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user's university from settings
  useEffect(() => {
    if (settings?.university) {
      setUniversity(settings.university);
    }
  }, [settings]);

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
          assignments: cat.manual ? undefined : [{ score: 0, max_score: 100 }], // Reset assignments
        } as Category;
      });

      await createTemplate({
        university: finalUniversity,
        courseCode: courseCode.trim(),
        courseTitle: courseTitle.trim(),
        instructor: instructor.trim(),
        categories: templateCategories,
      });

      toast.success("Template published successfully!");
      handleClose();
    } catch (error) {
      console.error("Failed to publish template:", error);
      toast.error("Failed to publish template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Publish Template</DialogTitle>
          <DialogDescription>
            Share your course structure with other students. Your template will be searchable by course code, title, and instructor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="university">University *</Label>
            {!showCustomUniversity ? (
              <>
                <Combobox
                  fetchOptions={fetchColleges}
                  value={university}
                  onValueChange={handleUniversityChange}
                  placeholder="Select your university..."
                  searchPlaceholder="Search universities..."
                  emptyText="No universities found."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCustomUniversity(true);
                    setUniversity("");
                  }}
                  className="mt-2"
                >
                  Other
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Input
                  id="custom-university"
                  value={customUniversity}
                  onChange={(e) => setCustomUniversity(e.target.value)}
                  placeholder="Enter university name..."
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCustomUniversity(false);
                    setCustomUniversity("");
                    setUniversity(settings?.university || "");
                  }}
                >
                  Use preset list
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-code">Course Code *</Label>
            <Input
              id="course-code"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g., CS 101"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-title">Course Title / Description *</Label>
            <Input
              id="course-title"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="e.g., Introduction to Computer Science"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructor">Instructor *</Label>
            <Input
              id="instructor"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="e.g., Dr. Smith"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Publishing..." : "Publish Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

