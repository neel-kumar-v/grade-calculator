export type CategoryKind = "standard" | "attendance" | "points_to_goal";

export type Assignment = { score: number; max_score: number };

export const CATEGORY_KIND_OPTIONS: {
  value: CategoryKind;
  label: string;
  description: string;
}[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Score each assignment out of a max; average or point-weight them.",
  },
  {
    value: "attendance",
    label: "Attendance",
    description: "Check off each session. Grade is present ÷ total sessions.",
  },
  {
    value: "points_to_goal",
    label: "Points to goal",
    description:
      "Sum points toward a finish line (e.g. 400). Missed quizzes don’t dilute—just earn less toward the goal.",
  },
];

export function resolveCategoryKind(
  kind: CategoryKind | undefined | null
): CategoryKind {
  return kind ?? "standard";
}

export function categoryKindLabel(kind: CategoryKind | undefined | null): string | null {
  switch (resolveCategoryKind(kind)) {
    case "attendance":
      return "Attendance";
    case "points_to_goal":
      return "Points to goal";
    default:
      return null;
  }
}

export function defaultAssignmentForKind(kind: CategoryKind | undefined | null): Assignment {
  switch (resolveCategoryKind(kind)) {
    case "attendance":
      return { score: 1, max_score: 1 };
    case "points_to_goal":
      return { score: 0, max_score: 20 };
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
      return { score: 20, max_score: 20 };
    default:
      return { score: 100, max_score: 100 };
  }
}
