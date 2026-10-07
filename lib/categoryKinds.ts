export type CategoryKind = "standard" | "attendance" | "points_to_goal";

export type Assignment = { score: number; max_score: number };

export const CATEGORY_KIND_OPTIONS: {
  value: CategoryKind;
  label: string;
}[] = [
  { value: "standard", label: "Standard" },
  { value: "attendance", label: "Attendance" },
  { value: "points_to_goal", label: "Points to goal" },
];

export function resolveCategoryKind(
  kind: CategoryKind | undefined | null
): CategoryKind {
  return kind ?? "standard";
}

export function defaultAssignmentForKind(kind: CategoryKind | undefined | null): Assignment {
  switch (resolveCategoryKind(kind)) {
    case "attendance":
      return { score: 1, max_score: 1 };
    case "points_to_goal":
      // max_score is unused for this kind; keep schema-valid placeholder only.
      return { score: 0, max_score: 1 };
    default:
      return { score: 100, max_score: 100 };
  }
}

export function templateSeedAssignmentForKind(
  kind: CategoryKind | undefined | null
): Assignment {
  switch (resolveCategoryKind(kind)) {
    case "attendance":
      return { score: 1, max_score: 1 };
    case "points_to_goal":
      return { score: 20, max_score: 1 };
    default:
      return { score: 100, max_score: 100 };
  }
}

/** Keep earned scores; neutralize unused denominators for points-to-goal. */
export function normalizePointsToGoalAssignments(
  assignments: Assignment[] | undefined
): Assignment[] | undefined {
  if (!assignments) return undefined;
  return assignments.map((a) => ({
    score: a.score,
    max_score: 1,
  }));
}
