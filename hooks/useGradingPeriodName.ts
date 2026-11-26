import { useConvexQuery } from "./use-convex-query";
import { api } from "../convex/_generated/api";

export function useGradingPeriodName(): string {
  const settings = useConvexQuery(api.settings.get);
  return settings?.gradingPeriodName || "Semesters";
}
