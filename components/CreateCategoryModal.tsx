"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import type { Doc } from "../convex/_generated/dataModel";

type GradingPeriod = Doc<"gradingPeriods">;
type Course = GradingPeriod["courses"][number];
type Category = NonNullable<Course["categories"]>[number];

interface CreateCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (category: Category) => void;
}

export function CreateCategoryModal({
  open,
  onOpenChange,
  onCreate,
}: CreateCategoryModalProps) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number>(10);
  const [extraCredit, setExtraCredit] = useState(false);
  const [manual, setManual] = useState(false);
  const [evenlyWeighted, setEvenlyWeighted] = useState(true);
  const [manualScore, setManualScore] = useState<number>(100);

  const reset = () => {
    setName("");
    setWeight(10);
    setExtraCredit(false);
    setManual(false);
    setEvenlyWeighted(true);
    setManualScore(100);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (weight <= 0) return;

    const gradeValue = manual ? (manualScore / 100) * 100 : 0; // store as 0-100 number

    const base: Category = {
      name: name.trim(),
      weight,
      evenly_weighted: !manual && evenlyWeighted,
      extra_credit: extraCredit,
      manual,
      grade: gradeValue,
      // for manual categories we omit assignments; for auto we seed with one assignment
      ...(manual
        ? {}
        : {
            assignments: [
              {
                score: 0,
                max_score: 100,
              },
            ],
          }),
    };

    onCreate(base);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Category</DialogTitle>
          <DialogDescription>
            Define how this category contributes to your course grade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Exams"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-weight">Weight</Label>
            <Input
              id="category-weight"
              type="number"
              min="0"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value) || 0)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={extraCredit}
                onCheckedChange={(v) => setExtraCredit(v === true)}
              />
              <span className="text-sm">Extra credit category</span>
            </label>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={manual}
                onCheckedChange={(v) => setManual(v === true)}
              />
              <span className="text-sm">Manually set category grade</span>
            </label>
          </div>

          {manual ? (
            <div className="space-y-2">
              <Label>Category grade</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={manualScore}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isNaN(v)) {
                      setManualScore(0);
                    } else {
                      setManualScore(Math.max(0, Math.min(100, v)));
                    }
                  }}
                  className="w-20"
                />
                <span>/</span>
                <Input value={100} readOnly className="w-20 bg-muted" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={evenlyWeighted}
                onCheckedChange={(v) => setEvenlyWeighted(v === true)}
              />
              <span className="text-sm">Assignments are evenly weighted</span>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Create Category</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


