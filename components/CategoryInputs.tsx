"use client";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Plus, Trash } from "lucide-react";

type Assignment = { score: number; max_score: number };
type Category = {
  name: string;
  weight: number;
  evenly_weighted: boolean;
  drop_policy?: {
    drop_count: number;
    drop_with?: number;
  };
  extra_credit: boolean;
  manual: boolean;
  grade: number;
  assignments?: Assignment[];
};

interface CategoryInputsProps {
  category: Category;
  catIndex: number;
  allCategories: Category[];
  inputValues: Record<string, string>;
  setInputValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onUpdateCategory: (catIndex: number, updater: (c: Category) => Category) => void;
  onUpdateAssignment: (
    catIndex: number,
    assignIndex: number,
    updater: (a: Assignment) => Assignment
  ) => void;
  onAddAssignment: (catIndex: number) => void;
  onRemoveAssignment: (catIndex: number, assignIndex: number) => void;
  categoryGrade: (cat: Category, allCategories?: Category[]) => number;
  percentLabel: (val: number) => string;
  whatIf?: boolean;
  normalizedCategories?: Category[];
}

export function CategoryInputs({
  category,
  catIndex,
  allCategories,
  inputValues,
  setInputValues,
  onUpdateCategory,
  onUpdateAssignment,
  onAddAssignment,
  onRemoveAssignment,
  categoryGrade,
  percentLabel,
  whatIf = false,
  normalizedCategories = [],
}: CategoryInputsProps) {
  if (category.manual) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={
              inputValues[`manual-grade-${catIndex}`] ?? String(category.grade)
            }
            onChange={(e) => {
              const value = e.target.value;
              const key = `manual-grade-${catIndex}`;
              if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                setInputValues((prev) => ({ ...prev, [key]: value }));
                if (value !== "" && value !== "." && !value.endsWith(".")) {
                  const numValue = Number(value);
                  if (!isNaN(numValue)) {
                    onUpdateCategory(catIndex, (c) => ({
                      ...c,
                      grade: numValue,
                    }));
                  }
                }
              }
            }}
            onBlur={(e) => {
              const value = e.target.value;
              const key = `manual-grade-${catIndex}`;
              const numValue = value === "" || value === "." ? 0 : Number(value) || 0;
              onUpdateCategory(catIndex, (c) => ({
                ...c,
                grade: numValue,
              }));
              setInputValues((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }}
            className="w-24"
            inputMode="decimal"
          />
          <span>/</span>
          <Input readOnly value={100} className="w-24 bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={category.evenly_weighted}
            onCheckedChange={(v) =>
              onUpdateCategory(catIndex, (c) => ({
                ...c,
                evenly_weighted: v === true,
              }))
            }
          />
          <span className="text-sm">Evenly Weighted</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Drop lowest:</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={category.drop_policy?.drop_count ?? 0}
            onChange={(e) => {
              const dropCount = Math.max(0, Math.floor(Number(e.target.value) || 0));
              onUpdateCategory(catIndex, (c) => ({
                ...c,
                drop_policy: dropCount > 0
                  ? {
                      drop_count: dropCount,
                      drop_with: c.drop_policy?.drop_with,
                    }
                  : undefined,
              }));
            }}
            className="w-16"
            inputMode="numeric"
          />
        </div>
        {(category.drop_policy?.drop_count ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Replace with:</Label>
            <Select
              value={
                category.drop_policy?.drop_with === undefined
                  ? "drop"
                  : category.drop_policy.drop_with.toString()
              }
              onValueChange={(value) => {
                onUpdateCategory(catIndex, (c) => ({
                  ...c,
                  drop_policy: c.drop_policy
                    ? {
                        ...c.drop_policy,
                        drop_with: value === "drop" ? undefined : Number(value),
                      }
                    : undefined,
                }));
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drop">Dropped completely</SelectItem>
                {allCategories
                  .map((cat, idx) => ({ cat, idx }))
                  .filter(({ idx }) => idx !== catIndex)
                  .map(({ cat, idx }) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      Replaced with {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {(category.assignments ?? []).map((assignment, assignIndex) => (
          <div
            key={assignIndex}
            className="flex items-center gap-2 border border-border rounded-md px-3 py-2"
          >
            <Input
              type="text"
              value={
                inputValues[`score-${catIndex}-${assignIndex}`] ??
                String(assignment.score)
              }
              onChange={(e) => {
                const value = e.target.value;
                const key = `score-${catIndex}-${assignIndex}`;
                if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                  setInputValues((prev) => ({ ...prev, [key]: value }));
                  if (value !== "" && value !== "." && !value.endsWith(".")) {
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                      onUpdateAssignment(catIndex, assignIndex, (a) => ({
                        ...a,
                        score: numValue,
                      }));
                    }
                  }
                }
              }}
              onBlur={(e) => {
                const value = e.target.value;
                const key = `score-${catIndex}-${assignIndex}`;
                const numValue = value === "" || value === "." ? 0 : Number(value) || 0;
                onUpdateAssignment(catIndex, assignIndex, (a) => ({
                  ...a,
                  score: numValue,
                }));
                setInputValues((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              }}
              className="w-24"
              inputMode="decimal"
            />
            <span>/</span>
            <Input
              type="text"
              value={
                inputValues[`max_score-${catIndex}-${assignIndex}`] ??
                String(assignment.max_score)
              }
              onChange={(e) => {
                const value = e.target.value;
                const key = `max_score-${catIndex}-${assignIndex}`;
                if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                  setInputValues((prev) => ({ ...prev, [key]: value }));
                  if (value !== "" && value !== "." && !value.endsWith(".")) {
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                      onUpdateAssignment(catIndex, assignIndex, (a) => ({
                        ...a,
                        max_score: Math.max(1, numValue),
                      }));
                    }
                  }
                }
              }}
              onBlur={(e) => {
                const value = e.target.value;
                const key = `max_score-${catIndex}-${assignIndex}`;
                const numValue =
                  value === "" || value === "." ? 1 : Math.max(1, Number(value) || 1);
                onUpdateAssignment(catIndex, assignIndex, (a) => ({
                  ...a,
                  max_score: numValue,
                }));
                setInputValues((prev) => {
                  const next = { ...prev };
                  delete next[key];
                  return next;
                });
              }}
              className="w-24"
              inputMode="decimal"
            />
            <div className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="group"
                onClick={() => onRemoveAssignment(catIndex, assignIndex)}
              >
                <Trash className="size-4 stroke-destructive" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => onAddAssignment(catIndex)}
        >
          <Plus className="size-4" />
          Add assignment
        </Button>
      </div>
    </div>
  );
}

// Helper function to render category grade display
export function renderCategoryGradeDisplay(
  category: Category,
  actualCategory: Category,
  allCategories: Category[],
  normalizedCategories: Category[],
  categoryGrade: (cat: Category, allCategories?: Category[]) => number,
  percentLabel: (val: number) => string,
  whatIfSim?: number | null,
  actualGrade?: number
) {
  const actual = actualGrade !== undefined ? actualGrade : categoryGrade(actualCategory, normalizedCategories);
  const weight = category.weight;
  const actualWeighted = actual * weight;
  
  if (whatIfSim === null || whatIfSim === undefined) {
    return (
      <div className="flex flex-row items-center gap-2">
        <span className="text-sm text-muted-foreground">{percentLabel(actual)}</span>
        <span className="text-lg font-semibold text-foreground">{actualWeighted.toFixed(2).replace(/\.00$/, '')}%</span>
      </div>
    );
  }
  
  const simWeighted = whatIfSim * weight;
  const diff = simWeighted - actualWeighted;
  const color = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-foreground";
  return (
    <div className="flex flex-row items-center gap-2">
      <span className="text-sm text-muted-foreground">{percentLabel(whatIfSim)}</span>
      <span className={`text-lg font-semibold ${color}`}>{simWeighted.toFixed(2).replace(/\.00$/, '')}%</span>
      <span
        className={
          diff > 0
            ? "text-green-600 text-sm"
            : diff < 0
              ? "text-red-600 text-sm"
              : "text-muted-foreground text-sm"
        }
      >
        {Math.abs(diff).toFixed(2).replace(/\.00$/, '')}%
      </span>
    </div>
  );
}

