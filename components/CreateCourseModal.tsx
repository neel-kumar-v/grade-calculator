"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id, Doc } from "../convex/_generated/dataModel";
import { toast } from "sonner";
import { Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";

type Course = Doc<"gradingPeriods">["courses"][number];

interface CreateCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradingPeriodId: Id<"gradingPeriods">;
  editingCourse?: Course;
  courseIndex?: number;
}

export function CreateCourseModal({
  open,
  onOpenChange,
  gradingPeriodId,
  editingCourse,
  courseIndex,
}: CreateCourseModalProps) {
  const router = useRouter();
  const addCourse = useMutation(api.gradingPeriods.addCourse);
  const updateCourse = useMutation(api.gradingPeriods.updateCourse);
  const updateGrades = useMutation(api.gradingPeriods.updateGrades);
  const removeCourse = useMutation(api.gradingPeriods.removeCourse);
  const isEditMode = editingCourse !== undefined && courseIndex !== undefined;
  const [name, setName] = useState("");
  const [credits, setCredits] = useState<number>(3);
  const [manual, setManual] = useState(false);
  const [originalManual, setOriginalManual] = useState(false);
  const [originalPartOfDegree, setOriginalPartOfDegree] = useState(false);
  const [partOfDegree, setPartOfDegree] = useState(false);
  const [gradeNumerator, setGradeNumerator] = useState<string>("0");
  const [gradeDenominator, setGradeDenominator] = useState<string>("100");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && editingCourse) {
      setName(editingCourse.name);
      setCredits(editingCourse.credits);
      setManual(editingCourse.manual);
      setOriginalManual(editingCourse.manual);
      setPartOfDegree(editingCourse.part_of_degree);
      setOriginalPartOfDegree(editingCourse.part_of_degree);
      if (editingCourse.manual && typeof editingCourse.grade === "number") {
        // Convert percentage to fraction for display
        const gradeValue = editingCourse.grade;
        setGradeNumerator(gradeValue.toFixed(2));
        setGradeDenominator("100");
      } else {
        setGradeNumerator("0");
        setGradeDenominator("100");
      }
    } else {
      resetForm();
    }
  }, [isEditMode, editingCourse, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (manual && (!gradeNumerator.trim() || !gradeDenominator.trim())) return;

    setIsSubmitting(true);
    try {
      let finalGrade = 0;
      let fromExtraCredit = 0;

      if (manual) {
        const num = parseFloat(gradeNumerator);
        const den = parseFloat(gradeDenominator);
        if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
          toast.error("Enter a valid numerator and denominator > 0.");
          setIsSubmitting(false);
          return;
        }
        finalGrade = (num / den) * 100;
      } else if (isEditMode && editingCourse && typeof editingCourse.grade === "number") {
        // For non-manual courses, preserve the existing grade (it's calculated from categories)
        finalGrade = editingCourse.grade;
      }

      const courseData = {
        name: name.trim(),
        credits,
        manual,
        grade: finalGrade,
        from_extra_credit: fromExtraCredit,
        part_of_degree: partOfDegree,
        // If switching to manual, clear categories. Otherwise preserve existing categories when editing.
        categories: manual 
          ? undefined 
          : (isEditMode ? editingCourse?.categories : undefined),
      };

      if (isEditMode) {
        // Update existing course
        await updateCourse({
          gradingPeriodId,
          courseIndex: courseIndex!,
          course: courseData,
        });
        // Only trigger GPA refresh if manual state or part_of_degree changed
        // (these affect GPA calculations, other changes are handled by updateCourse)
        const manualChanged = originalManual !== manual;
        const partOfDegreeChanged = originalPartOfDegree !== partOfDegree;
        if (manualChanged || partOfDegreeChanged) {
          await updateGrades({ id: gradingPeriodId });
        }
        toast.success("Course updated successfully");
      } else {
        // Create new course
        const result = await addCourse({
          id: gradingPeriodId,
          course: courseData,
        });

        // Navigate to the newly created course page using its index
        if (result && typeof result.courseIndex === "number" && !manual) {
          router.push(`/${gradingPeriodId}/${result.courseIndex}`);
        }
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} course:`, error);
      toast.error(`Failed to ${isEditMode ? "update" : "create"} course. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCredits(3);
    setManual(false);
    setOriginalManual(false);
    setPartOfDegree(false);
    setOriginalPartOfDegree(false);
    setGradeNumerator("0");
    setGradeDenominator("100");
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleGradeChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setGradeNumerator(value);
    }
  };

  const handleDenominatorChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setGradeDenominator(value);
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || courseIndex === undefined) return;

    setIsSubmitting(true);
    try {
      await removeCourse({
        gradingPeriodId,
        courseIndex: courseIndex,
      });
      // Trigger GPA refresh after deletion
      await updateGrades({ id: gradingPeriodId });
      toast.success("Course deleted successfully");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Failed to delete course:", error);
      toast.error("Failed to delete course. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Course" : "Add Course"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Edit the course details." : "Add a new course to this grading period."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course-name">Course Name</Label>
              <Input
                id="course-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Introduction to Computer Science"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits">Credits</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                step="0.5"
                value={credits}
                onChange={(e) => setCredits(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="manual"
                checked={manual}
                onCheckedChange={(checked) => {
                  const newManual = checked === true;
                  // Show warning when switching from auto-graded to manual-graded
                  if (isEditMode && !originalManual && newManual && editingCourse && !editingCourse.manual) {
                    toast.warning("Changing the course to manually graded will permanently erase the grades you previously input.");
                  }
                  setManual(newManual);
                }}
              />
              <Label htmlFor="manual" className="font-normal cursor-pointer">
                Manually input grade
              </Label>
            </div>
            {manual && (
              <div className="space-y-2">
                <Label>Grade (fraction)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={gradeNumerator}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    required
                    className="flex-1"
                    inputMode="decimal"
                  />
                  <span>/</span>
                  <Input
                    value={gradeDenominator}
                    onChange={(e) => handleDenominatorChange(e.target.value)}
                    required
                    className="flex-1"
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="part-of-degree"
                checked={partOfDegree}
                onCheckedChange={(checked) => setPartOfDegree(checked === true)}
              />
              <Label htmlFor="part-of-degree" className="font-normal cursor-pointer">
                Part of core curriculum
              </Label>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="mr-auto"
              >
                <Trash className="size-4" />
                Delete Course
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !name.trim() ||
                  (manual && (!gradeNumerator.trim() || !gradeDenominator.trim()))
                }
              >
                {isSubmitting 
                  ? (isEditMode ? "Saving..." : "Adding...") 
                  : (isEditMode ? "Save Edits" : "Add Course")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

