import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { api } from "./_generated/api";
import { getScaleByName, calculateGPA } from "../lib/gpa";

async function getCurrentUserId(ctx: any) {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    try {
      const userId = await getCurrentUserId(ctx);
      const settings = await ctx.db
        .query("settings")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId))
        .first();

      return settings || null;
    } catch {
      // Return null if unauthenticated
      return null;
    }
  },
});

export const update = mutation({
  args: {
    gradingPeriodName: v.optional(v.union(v.literal("Semesters"), v.literal("Trimesters"), v.literal("Quarters"))),
    gpaScale: v.optional(v.string()),
    customScale: v.optional(v.array(v.object({ minPercentage: v.number(), gpa: v.number() }))),
    university: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId: any;
    try {
      userId = await getCurrentUserId(ctx);
    } catch (error) {
      // If user is not authenticated or user record doesn't exist yet, return null
      return null;
    }
    
    // Verify user exists in database
    const user = await ctx.db.get(userId);
    if (!user) {
      // User doesn't exist yet, return null
      return null;
    }
    
    const existingSettings = await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const updateData: any = {};
    if (args.gradingPeriodName !== undefined) updateData.gradingPeriodName = args.gradingPeriodName;
    if (args.gpaScale !== undefined) updateData.gpaScale = args.gpaScale;
    if (args.customScale !== undefined) updateData.customScale = args.customScale;
    if (args.university !== undefined) updateData.university = args.university;

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, updateData);
      return existingSettings._id;
    } else {
      // Create new settings with defaults
      const newSettings = {
        userId,
        gradingPeriodName: args.gradingPeriodName || ("Semesters" as const),
        gpaScale: args.gpaScale || "STANDARD_4_0",
        customScale: args.customScale,
        university: args.university,
      };
      return await ctx.db.insert("settings", newSettings);
    }
  },
});

export const recalculateAllGPAs = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    
    // Get user settings
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!settings) {
      return; // No settings, nothing to recalculate
    }

    // Get all grading periods for this user
    const gradingPeriods = await ctx.db
      .query("gradingPeriods")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Recalculate GPAs for all grading periods
    for (const gradingPeriod of gradingPeriods) {
      const scale = getScaleByName(settings.gpaScale, settings.customScale);
      
      // Recalculate GPA for all courses
      const coursesWithGPA = gradingPeriod.courses.map((course: any) => {
        if (typeof course.grade === "number" && course.grade > 0) {
          return {
            ...course,
            gpa: calculateGPA(course.grade, scale),
          };
        }
        return {
          ...course,
          gpa: undefined,
        };
      });

      // Recalculate grading period GPA
      let totalWeightedGPA = 0;
      let totalCredits = 0;
      for (const course of coursesWithGPA) {
        if (typeof course.grade === "number" && course.grade > 0 && course.gpa !== undefined) {
          totalWeightedGPA += course.gpa * course.credits;
          totalCredits += course.credits;
        }
      }
      const gpa = totalCredits > 0 ? totalWeightedGPA / totalCredits : null;

      // Recalculate core GPA
      let totalWeightedCoreGPA = 0;
      let totalCoreCredits = 0;
      for (const course of coursesWithGPA) {
        if (course.part_of_degree && typeof course.grade === "number" && course.grade > 0 && course.gpa !== undefined) {
          totalWeightedCoreGPA += course.gpa * course.credits;
          totalCoreCredits += course.credits;
        }
      }
      const core_gpa = totalCoreCredits > 0 ? totalWeightedCoreGPA / totalCoreCredits : null;

      // Update the grading period
      await ctx.db.patch(gradingPeriod._id, {
        courses: coursesWithGPA,
        gpa: gpa ?? undefined,
        core_gpa: core_gpa ?? undefined,
      });
    }
  },
});


