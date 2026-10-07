import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

type Category = NonNullable<
  Doc<"gradingPeriods">["courses"][number]["categories"]
>[number];

function normalizeCategory(category: Category): {
  category: Category;
  changed: boolean;
} {
  if (category.kind !== "points_to_goal") {
    return { category, changed: false };
  }

  let changed = false;
  const assignments = (category.assignments ?? []).map((a) => {
    if (a.max_score === 1) return a;
    changed = true;
    return { score: a.score, max_score: 1 };
  });

  let drop_policy = category.drop_policy;
  if (drop_policy !== undefined) {
    drop_policy = undefined;
    changed = true;
  }

  if (!changed) {
    return { category, changed: false };
  }

  return {
    category: {
      ...category,
      assignments,
      drop_policy,
    },
    changed: true,
  };
}

/**
 * Neutralize unused denominators on points_to_goal categories.
 * Keeps assignment.score; sets max_score to 1; clears drop_policy.
 * target: run on prod (brainy-mockingbird-507) after deploy.
 */
export const stripPointsToGoalDenominators = internalMutation({
  args: {},
  returns: v.object({
    gradingPeriodsScanned: v.number(),
    gradingPeriodsUpdated: v.number(),
    templatesScanned: v.number(),
    templatesUpdated: v.number(),
    categoriesTouched: v.number(),
    assignmentsNormalized: v.number(),
  }),
  handler: async (ctx) => {
    let gradingPeriodsScanned = 0;
    let gradingPeriodsUpdated = 0;
    let templatesScanned = 0;
    let templatesUpdated = 0;
    let categoriesTouched = 0;
    let assignmentsNormalized = 0;

    const periods = await ctx.db.query("gradingPeriods").collect();
    for (const period of periods) {
      gradingPeriodsScanned += 1;
      let periodChanged = false;
      const courses = period.courses.map((course) => {
        if (!course.categories?.length) return course;
        let courseChanged = false;
        const categories = course.categories.map((category) => {
          const beforeMax = (category.assignments ?? []).filter(
            (a) => a.max_score !== 1
          ).length;
          const { category: next, changed } = normalizeCategory(category);
          if (changed) {
            courseChanged = true;
            categoriesTouched += 1;
            assignmentsNormalized += beforeMax;
          }
          return next;
        });
        if (!courseChanged) return course;
        periodChanged = true;
        return { ...course, categories };
      });

      if (periodChanged) {
        gradingPeriodsUpdated += 1;
        await ctx.db.patch(period._id, { courses });
      }
    }

    const templates = await ctx.db.query("templates").collect();
    for (const template of templates) {
      templatesScanned += 1;
      let templateChanged = false;
      const categories = template.categories.map((category) => {
        const beforeMax = (category.assignments ?? []).filter(
          (a) => a.max_score !== 1
        ).length;
        const { category: next, changed } = normalizeCategory(category);
        if (changed) {
          templateChanged = true;
          categoriesTouched += 1;
          assignmentsNormalized += beforeMax;
        }
        return next;
      });
      if (templateChanged) {
        templatesUpdated += 1;
        await ctx.db.patch(template._id, { categories });
      }
    }

    return {
      gradingPeriodsScanned,
      gradingPeriodsUpdated,
      templatesScanned,
      templatesUpdated,
      categoriesTouched,
      assignmentsNormalized,
    };
  },
});
