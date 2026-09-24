// Shared grade calculation logic
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
};

function assignmentPercent(a: Assignment): number {
  if (!a || a.max_score <= 0) return 0;
  return a.score / a.max_score;
}

/**
 * Compute category grade (0-1) honoring drop_policy.
 * - drop_count drops the lowest `dropCount` assignments by percent
 * - if drop_with is undefined, those assignments are removed
 * - if drop_with is a category index, dropped assignments are replaced with that category's grade
 * - if dropping completely leaves 0 assignments, grade is 1 (100%) – the category is considered exempt/perfect
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

  const dropPolicy = category.drop_policy;
  if (dropPolicy && typeof dropPolicy.drop_count === "number" && dropPolicy.drop_count > 0) {
    const rawDrop = Math.floor(dropPolicy.drop_count);
    if (rawDrop > 0 && assignments.length > 0) {
      // Clamp to available assignments for "replace" case; for "drop completely"
      // we allow dropping all, which yields 100% (exempt).
      const effectiveDrop = Math.min(rawDrop, assignments.length);
      if (effectiveDrop > 0) {
        const withIndices = assignments.map((a, idx) => ({ assignment: a, index: idx }));
        withIndices.sort((a, b) => assignmentPercent(a.assignment) - assignmentPercent(b.assignment));
        const toDropIndices = new Set(withIndices.slice(0, effectiveDrop).map((item) => item.index));

        if (dropPolicy.drop_with === undefined) {
          assignments = assignments.filter((_, idx) => !toDropIndices.has(idx));
          if (assignments.length === 0) {
            // All assignments dropped – treat as perfect / exempt so overall grade
            // isn't dragged down when e.g. dropCount >= assignments.length
            // and remaining would otherwise be 0%.
            return 1;
          }
        } else {
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
            assignments = assignments.map((assignment, idx) => {
              if (!toDropIndices.has(idx)) return assignment;
              return {
                score: replaceGrade * assignment.max_score,
                max_score: assignment.max_score,
              };
            });
          } else {
            // Invalid replace target – fall back to dropping completely
            assignments = assignments.filter((_, idx) => !toDropIndices.has(idx));
            if (assignments.length === 0) return 1;
          }
        }
      }
    }
  }

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
