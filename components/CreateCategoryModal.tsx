"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Trash } from "lucide-react";
import type { Doc } from "../convex/_generated/dataModel";
import {
  CATEGORY_KIND_OPTIONS,
  defaultAssignmentForKind,
  normalizePointsToGoalAssignments,
  resolveCategoryKind,
  type CategoryKind,
} from "../lib/categoryKinds";
import { cn } from "../lib/utils";

type GradingPeriod = Doc<"gradingPeriods">;
type Course = GradingPeriod["courses"][number];
type Category = NonNullable<Course["categories"]>[number];

interface CreateCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (category: Category) => void;
  editingCategory?: Category;
  onSave?: (category: Category) => void;
  onDelete?: () => void;
}

export function CreateCategoryModal({
  open,
  onOpenChange,
  onCreate,
  editingCategory,
  onSave,
  onDelete,
}: CreateCategoryModalProps) {
  const isEditMode = editingCategory !== undefined;
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number>(10);
  const [extraCredit, setExtraCredit] = useState(false);
  const [manual, setManual] = useState(false);
  const [evenlyWeighted, setEvenlyWeighted] = useState(true);
  const [manualScore, setManualScore] = useState<number>(100);
  const [manualScoreInput, setManualScoreInput] = useState<string>("");
  const [dropCount, setDropCount] = useState<number>(0);
  const [kind, setKind] = useState<CategoryKind>("standard");
  const [goalPoints, setGoalPoints] = useState<number>(400);

  const reset = () => {
    setName("");
    setWeight(10);
    setExtraCredit(false);
    setManual(false);
    setEvenlyWeighted(true);
    setManualScore(100);
    setManualScoreInput("");
    setDropCount(0);
    setKind("standard");
    setGoalPoints(400);
  };

  useEffect(() => {
    if (!open) return;

    if (isEditMode && editingCategory) {
      setName(editingCategory.name);
      setWeight(editingCategory.weight);
      setExtraCredit(editingCategory.extra_credit);
      setManual(editingCategory.manual);
      setEvenlyWeighted(editingCategory.evenly_weighted);
      setManualScore(editingCategory.manual ? editingCategory.grade : 100);
      setManualScoreInput("");
      setDropCount(editingCategory.drop_policy?.drop_count ?? 0);
      setKind(resolveCategoryKind(editingCategory.kind));
      setGoalPoints(editingCategory.goal_points ?? 400);
      return;
    }

    reset();
  }, [open, isEditMode, editingCategory]);

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleKindChange = (next: CategoryKind) => {
    setKind(next);
    if (next !== "standard") {
      setManual(false);
      setEvenlyWeighted(next === "attendance");
    }
    if (next === "points_to_goal") {
      setDropCount(0);
    }
  };

  const canSubmit =
    name.trim().length > 0 &&
    weight > 0 &&
    (manual || kind !== "points_to_goal" || goalPoints > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const gradeValue = manual ? manualScore : 0;
    const resolvedKind = manual ? "standard" : kind;
    const previousKind = isEditMode
      ? resolveCategoryKind(editingCategory?.kind)
      : null;
    // Keep scores when kind is unchanged, or when converting standard ↔ points_to_goal
    // (both store earned points in assignment.score).
    const canReuseAssignments =
      isEditMode &&
      !!editingCategory &&
      !manual &&
      (previousKind === resolvedKind ||
        (previousKind === "standard" && resolvedKind === "points_to_goal") ||
        (previousKind === "points_to_goal" && resolvedKind === "standard"));
    const reused = canReuseAssignments
      ? editingCategory.assignments
      : undefined;
    const assignments =
      resolvedKind === "points_to_goal"
        ? normalizePointsToGoalAssignments(
            reused ?? [defaultAssignmentForKind(resolvedKind)]
          )
        : (reused ?? [defaultAssignmentForKind(resolvedKind)]);

    const base: Category = {
      name: name.trim(),
      weight,
      evenly_weighted: manual
        ? false
        : resolvedKind === "attendance"
          ? true
          : resolvedKind === "points_to_goal"
            ? false
            : evenlyWeighted,
      extra_credit: extraCredit,
      manual,
      grade: gradeValue,
      kind: manual ? undefined : resolvedKind === "standard" ? undefined : resolvedKind,
      goal_points:
        !manual && resolvedKind === "points_to_goal" ? goalPoints : undefined,
      // Points-to-goal has no drop policy — only sum toward the finish line.
      drop_policy:
        !manual && resolvedKind !== "points_to_goal" && dropCount > 0
          ? {
              drop_count: dropCount,
              drop_with: isEditMode ? editingCategory?.drop_policy?.drop_with : undefined,
            }
          : undefined,
      ...(manual ? {} : { assignments }),
    };

    if (isEditMode) {
      onSave?.(base);
    } else {
      onCreate(base);
    }

    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const isModifier = e.ctrlKey || e.metaKey;

    if (isModifier && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) {
        e.currentTarget.requestSubmit();
      }
    }

    if (isModifier && (e.key === "Backspace" || e.key === "Delete")) {
      if (isEditMode && onDelete) {
        e.preventDefault();
        onDelete();
        handleClose();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
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

          {!manual && (
            <div className="space-y-2">
              <Label>Category type</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_KIND_OPTIONS.map((option) => {
                  const selected = kind === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleKindChange(option.value)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors",
                        selected
                          ? "border-foreground bg-muted/60"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {kind === "points_to_goal" && !manual && (
            <div className="space-y-2">
              <Label htmlFor="goal-points">Goal points</Label>
              <Input
                id="goal-points"
                type="number"
                min="1"
                step="1"
                value={goalPoints}
                onChange={(e) => setGoalPoints(Math.max(0, Number(e.target.value) || 0))}
                required
              />
            </div>
          )}

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
                onCheckedChange={(v) => {
                  const next = v === true;
                  setManual(next);
                  if (next) setKind("standard");
                }}
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
                    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                      setManualScoreInput(value);
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
              {kind === "standard" && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={evenlyWeighted}
                    onCheckedChange={(v) => setEvenlyWeighted(v === true)}
                  />
                  <span className="text-sm">Assignments are evenly weighted</span>
                </div>
              )}
              {kind !== "points_to_goal" && (
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">
                    {kind === "attendance" ? "Drop lowest classes:" : "Drop lowest:"}
                  </Label>
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
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 flex items-center justify-between">
            {isEditMode && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onDelete();
                  handleClose();
                }}
                className="mr-auto"
              >
                <Trash className="size-4" />
                Delete Category
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {isEditMode ? "Save Edits" : "Create Category"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
