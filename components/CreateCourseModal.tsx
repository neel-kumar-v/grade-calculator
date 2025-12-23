"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
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
interface CreateCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gradingPeriodId: Id<"gradingPeriods">;
}

export function CreateCourseModal({
  open,
  onOpenChange,
  gradingPeriodId,
}: CreateCourseModalProps) {
  const router = useRouter();
  const addCourse = useMutation(api.gradingPeriods.addCourse);
  const [name, setName] = useState("");
  const [credits, setCredits] = useState<number>(3);
  const [manual, setManual] = useState(false);
  const [partOfDegree, setPartOfDegree] = useState(false);
  const [gradeNumerator, setGradeNumerator] = useState<string>("0");
  const [gradeDenominator, setGradeDenominator] = useState<string>("100");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          alert("Enter a valid numerator and denominator > 0.");
          setIsSubmitting(false);
          return;
        }
        finalGrade = (num / den) * 100;
      }

      const result = await addCourse({
        id: gradingPeriodId,
        course: {
          name: name.trim(),
          credits,
          manual,
          grade: finalGrade,
          from_extra_credit: fromExtraCredit,
          part_of_degree: partOfDegree,
          categories: undefined,
        },
      });

      // Navigate to the newly created course page using its index
      if (result && typeof result.courseIndex === "number" && !manual) {
        router.push(`/${gradingPeriodId}/${result.courseIndex}`);
      }

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create course:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCredits(3);
    setManual(false);
    setPartOfDegree(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>
            Add a new course to this grading period.
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
                onCheckedChange={(checked) => setManual(checked === true)}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
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
              {isSubmitting ? "Adding..." : "Add Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

