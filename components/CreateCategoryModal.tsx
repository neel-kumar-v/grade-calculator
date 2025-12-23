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
  const [manualScoreInput, setManualScoreInput] = useState<string>("");
  const [dropCount, setDropCount] = useState<number>(0);

  const reset = () => {
    setName("");
    setWeight(10);
    setExtraCredit(false);
    setManual(false);
    setEvenlyWeighted(true);
    setManualScore(100);
    setManualScoreInput("");
    setDropCount(0);
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
      drop_policy: dropCount > 0
        ? {
            drop_count: dropCount,
            drop_with: undefined, // Will be set later when editing if needed
          }
        : undefined,
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
                  type="text"
                  value={manualScoreInput || String(manualScore)}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, and decimal point
                    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                      // Store the string value for display
                      setManualScoreInput(value);
                      // Update the actual value if it's a complete number
                      if (value !== "" && value !== "." && !value.endsWith(".")) {
                        const numValue = Number(value);
                        if (!isNaN(numValue) && numValue >= 0) {
                          setManualScore(numValue);
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    const numValue = value === "" || value === "." ? 0 : Number(value) || 0;
                    if (numValue >= 0) {
                      setManualScore(numValue);
                    }
                    setManualScoreInput("");
                  }}
                  className="w-20"
                  inputMode="decimal"
                />
                <span>/</span>
                <Input value={100} readOnly className="w-20 bg-muted" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={evenlyWeighted}
                  onCheckedChange={(v) => setEvenlyWeighted(v === true)}
                />
                <span className="text-sm">Assignments are evenly weighted</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Drop lowest:</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={dropCount}
                  onChange={(e) => {
                    const value = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    setDropCount(value);
                  }}
                  className="w-16"
                  inputMode="numeric"
                />
                {dropCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    (Will drop completely; can change replacement policy when editing)
                  </span>
                )}
              </div>
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


