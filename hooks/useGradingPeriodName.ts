import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export function useGradingPeriodName(): string {
  const settings = useQuery(api.settings.get);
  return settings?.gradingPeriodName || "Semesters";
}


