// Shared grade calculation logic
import {
  resolveCategoryKind,
  type CategoryKind,
} from "./categoryKinds";

export type Assignment = { score: number; max_score: number };
export type DropPolicy = { drop_count: number; drop_with?: number };
export type CategoryForGrade = {
  name?: string;
  weight: number;
  evenly_weighted: boolean;
  drop_policy?: DropPolicy;
  extra_credit: boolean;
  manual: boolean;
  grade: number;
  assignments?: Assignment[];
  kind?: CategoryKind;
  goal_points?: number;
};

function assignmentPercent(a: Assignment): number {
  if (!a || a.max_score <= 0) return 0;
  return a.score / a.max_score;
}

function applyDropPolicy(
  category: CategoryForGrade,
  assignments: Assignment[],
  allCategories: CategoryForGrade[] | undefined,
  visited: Set<number>
): Assignment[] | "exempt" {
  const dropPolicy = category.drop_policy;
  if (!dropPolicy || typeof dropPolicy.drop_count !== "number" || dropPolicy.drop_count <= 0) {
    return assignments;
  }

  const rawDrop = Math.floor(dropPolicy.drop_count);
  if (rawDrop <= 0 || assignments.length === 0) return assignments;

  // Clamp to available assignments for "replace" case; for "drop completely"
  // we allow dropping all, which yields 100% (exempt).
  const effectiveDrop = Math.min(rawDrop, assignments.length);
  if (effectiveDrop <= 0) return assignments;

  const withIndices = assignments.map((a, idx) => ({ assignment: a, index: idx }));
  withIndices.sort((a, b) => assignmentPercent(a.assignment) - assignmentPercent(b.assignment));
  const toDropIndices = new Set(withIndices.slice(0, effectiveDrop).map((item) => item.index));

  if (dropPolicy.drop_with === undefined) {
    const kept = assignments.filter((_, idx) => !toDropIndices.has(idx));
    if (kept.length === 0) return "exempt";
    return kept;
  }

  const replaceCategoryIndex = dropPolicy.drop_with;
  const replaceCategory = allCategories?.[replaceCategoryIndex];
  // Avoid self-reference and cycles
  if (
    replaceCategory &&
    !visited.has(replaceCategoryIndex) &&
    replaceCategory !== category
  ) {
    visited.add(replaceCategoryIndex);
    const replaceGrade = categoryGrade(replaceCategory, allCategories, visited);
    return assignments.map((assignment, idx) => {
      if (!toDropIndices.has(idx)) return assignment;
      return {
        score: replaceGrade * assignment.max_score,
        max_score: assignment.max_score,
      };
    });
  }

  // Invalid replace target – fall back to dropping completely
  const kept = assignments.filter((_, idx) => !toDropIndices.has(idx));
  if (kept.length === 0) return "exempt";
  return kept;
}

/**
 * Points-to-goal: sum earned points toward a finish line.
 * Grade = min(sum(scores), goal) / goal. Individual max_scores are display-only.
 * Drop policy drops the lowest-scoring entries by absolute score before summing.
 */
function pointsToGoalGrade(
  category: CategoryForGrade,
  assignments: Assignment[]
): number {
  const goal = category.goal_points ?? 0;
  if (goal <= 0) return 0;

  let working = [...assignments];
  const dropCount = Math.floor(category.drop_policy?.drop_count ?? 0);
  if (dropCount > 0 && working.length > 0) {
    const effectiveDrop = Math.min(dropCount, working.length);
    // Never drop every entry — that would falsely treat progress as 100%.
    working = [...working]
      .sort((a, b) => a.score - b.score)
      .slice(Math.min(effectiveDrop, working.length - 1));
  }

  const earned = working.reduce((sum, a) => sum + Math.max(0, a.score), 0);
  return Math.min(1, earned / goal);
}

/**
 * Attendance: each assignment is present (1) or absent (0) out of 1.
 * Grade = present / total after optional drop of lowest sessions.
 */
function attendanceGrade(
  category: CategoryForGrade,
  assignments: Assignment[],
  allCategories: CategoryForGrade[] | undefined,
  visited: Set<number>
): number {
  const afterDrop = applyDropPolicy(category, assignments, allCategories, visited);
  if (afterDrop === "exempt") return 1;
  if (!afterDrop.length) return 0;
  const present = afterDrop.reduce((sum, a) => sum + (a.score > 0 ? 1 : 0), 0);
  return present / afterDrop.length;
}

/**
 * Compute category grade (0-1) honoring drop_policy.
 * - drop_count drops the lowest `dropCount` assignments by percent
 * - if drop_with is undefined, those assignments are removed
 * - if drop_with is a category index, dropped assignments are replaced with that category's grade
 * - if dropping completely leaves 0 assignments, grade is 1 (100%) – the category is considered exempt/perfect
 * - points_to_goal: min(sum(scores), goal) / goal
 * - attendance: present sessions / total sessions
 */
export function categoryGrade(
  category: CategoryForGrade,
  allCategories?: CategoryForGrade[],
  visited: Set<number> = new Set()
): number {
  if (!category) return 0;
  if (category.manual) {
    return category.grade / 100;
  }
  let assignments = [...(category.assignments ?? [])];
  if (!assignments.length) return 0;

  const kind = resolveCategoryKind(category.kind);

  if (kind === "points_to_goal") {
    return pointsToGoalGrade(category, assignments);
  }

  if (kind === "attendance") {
    return attendanceGrade(category, assignments, allCategories, visited);
  }

  const afterDrop = applyDropPolicy(category, assignments, allCategories, visited);
  if (afterDrop === "exempt") return 1;
  assignments = afterDrop;
  if (!assignments.length) return 0;

  if (category.evenly_weighted) {
    const avg = assignments.reduce((sum, a) => sum + assignmentPercent(a), 0) / assignments.length;
    return avg;
  }
  const sumScore = assignments.reduce((s, a) => s + a.score, 0);
  const sumMax = assignments.reduce((s, a) => s + a.max_score, 0);
  return sumMax > 0 ? sumScore / sumMax : 0;
}

export function finalCourseGrade(categories: CategoryForGrade[]): number {
  if (!categories.length) return 0;
  let numerator = 0;
  let denominator = 0;
  for (const cat of categories) {
    const grade = categoryGrade(cat, categories);
    if (cat.extra_credit) {
      numerator += cat.weight * grade;
    } else {
      numerator += cat.weight * grade;
      denominator += cat.weight;
    }
  }
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

/** Earned points toward a points-to-goal finish line (after drops). */
export function pointsToGoalProgress(category: CategoryForGrade): {
  earned: number;
  goal: number;
} {
  const goal = category.goal_points ?? 0;
  let working = [...(category.assignments ?? [])];
  const dropCount = Math.floor(category.drop_policy?.drop_count ?? 0);
  if (dropCount > 0 && working.length > 0) {
    const effectiveDrop = Math.min(dropCount, working.length);
    working = [...working]
      .sort((a, b) => a.score - b.score)
      .slice(effectiveDrop);
  }
  const earned = working.reduce((sum, a) => sum + Math.max(0, a.score), 0);
  return { earned, goal };
}
