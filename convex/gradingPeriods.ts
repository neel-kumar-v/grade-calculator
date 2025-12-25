import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import schema, { gradingPeriodInput, course } from "./schema";
import { getScaleByName, calculateGPA } from "../lib/gpa";

async function getCurrentUserId(ctx: any) {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

// Get user settings and return the GPA scale
async function getUserGPAScale(ctx: any): Promise<ReturnType<typeof getScaleByName>> {
  try {
    const userId = await getCurrentUserId(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .first();

    if (settings) {
      return getScaleByName(settings.gpaScale, settings.customScale);
    }
  } catch {
    // Fall through to default
  }
  // Default to STANDARD_4_0 if no settings found
  return getScaleByName("STANDARD_4_0");
}

// Convert percentage (0-100) to GPA using user's scale
async function percentageToGPA(ctx: any, percentage: number): Promise<number> {
  const scale = await getUserGPAScale(ctx);
  return calculateGPA(percentage, scale);
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    try {
      const userId = await getCurrentUserId(ctx);
      return await ctx.db
        .query("gradingPeriods")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    } catch {
      return [];
    }
  },
});

export const create = mutation({
  args: gradingPeriodInput,
  handler: async (ctx, args) => {
    // Validate that non-manual courses have categories and non-manual categories have assignments 
    for (const course of args.courses) {
      if (!course.manual && course.categories !== undefined) {
        throw new Error(`Course "${course.name}" requires assignments when manual is false`);
      }
      for (const category of course?.categories ?? []) {
        if (!category.manual && category.assignments === undefined) {
          throw new Error(`Category "${category.name}" requires assignments when manual is false`);
        }
      }
    }
    
    // Calculate and set GPA for all courses
    const coursesWithGPA = await calculateCoursesGPA(ctx, args.courses);
    
    // Calculate initial grades and GPAs
    const grade = calculateGradingPeriodGrade(coursesWithGPA);
    const core_grade = calculateCoreGrade(coursesWithGPA);
    const gpa = await calculateGradingPeriodGPA(ctx, coursesWithGPA);
    const core_gpa = await calculateCoreGPA(ctx, coursesWithGPA);
    
    const userId = await getCurrentUserId(ctx);
    return await ctx.db.insert("gradingPeriods", {
      ...args,
      courses: coursesWithGPA,
      grade,
      core_grade,
      gpa: gpa ?? undefined,
      core_gpa: core_gpa ?? undefined,
      userId,
    });
  },
});

export const getById = query({
  args: {
    id: v.id("gradingPeriods"),
  },
  handler: async (ctx, args) => {
    try {
      const userId = await getCurrentUserId(ctx);
      const gradingPeriod = await ctx.db.get(args.id);

      if (!gradingPeriod) {
        return null;
      }

      if (gradingPeriod.userId !== userId) {
        return null;
      }

      return gradingPeriod;
    } catch {
      return null;
    }
  },
});

export const getCourseById = query({
  args: {
    gradingPeriodId: v.id("gradingPeriods"),
    courseIndex: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const userId = await getCurrentUserId(ctx);
      const gradingPeriod = await ctx.db.get(args.gradingPeriodId);

      if (!gradingPeriod) {
        return null;
      }

      if (gradingPeriod.userId !== userId) {
        return null;
      }

      const index = Math.floor(args.courseIndex);
      if (
        !Number.isFinite(index) ||
        index < 0 ||
        index >= (gradingPeriod.courses?.length ?? 0)
      ) {
        return null;
      }

      const course = gradingPeriod.courses[index];

      return {
        gradingPeriod,
        course,
        courseIndex: index,
      };
    } catch {
      return null;
    }
  },
});

// Calculate weighted average grade for courses
// Using any[] since we're working with runtime data from the database
function calculateGradingPeriodGrade(courses: any[]): number {
  let totalWeightedGrade = 0;
  let totalCredits = 0;

  for (const course of courses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      totalWeightedGrade += course.grade * course.credits;
      totalCredits += course.credits;
    }
  }

  if (totalCredits === 0) return 0;
  return totalWeightedGrade / totalCredits;
}

// Calculate weighted average grade for core courses only
function calculateCoreGrade(courses: any[]): number {
  let totalWeightedGrade = 0;
  let totalCredits = 0;

  for (const course of courses) {
    if (course.part_of_degree && typeof course.grade === "number" && course.grade > 0) {
      totalWeightedGrade += course.grade * course.credits;
      totalCredits += course.credits;
    }
  }

  if (totalCredits === 0) return 0;
  return totalWeightedGrade / totalCredits;
}

// Calculate weighted average GPA for courses
async function calculateGradingPeriodGPA(ctx: any, courses: any[]): Promise<number | null> {
  const scale = await getUserGPAScale(ctx);
  let totalWeightedGPA = 0;
  let totalCredits = 0;

  for (const course of courses) {
    if (typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = calculateGPA(course.grade, scale);
      totalWeightedGPA += courseGPA * course.credits;
      totalCredits += course.credits;
    }
  }

  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate weighted average GPA for core courses only
async function calculateCoreGPA(ctx: any, courses: any[]): Promise<number | null> {
  const scale = await getUserGPAScale(ctx);
  let totalWeightedGPA = 0;
  let totalCredits = 0;

  for (const course of courses) {
    if (course.part_of_degree && typeof course.grade === "number" && course.grade > 0) {
      const courseGPA = calculateGPA(course.grade, scale);
      totalWeightedGPA += courseGPA * course.credits;
      totalCredits += course.credits;
    }
  }

  if (totalCredits === 0) return null;
  return totalWeightedGPA / totalCredits;
}

// Calculate and set GPA for a course
async function calculateCourseGPA(ctx: any, course: any): Promise<any> {
  const scale = await getUserGPAScale(ctx);
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
}

// Calculate and set GPA for all courses in an array
async function calculateCoursesGPA(ctx: any, courses: any[]): Promise<any[]> {
  const results = await Promise.all(courses.map(course => calculateCourseGPA(ctx, course)));
  return results;
}

export const update = mutation({
  args: {
    id: v.id("gradingPeriods"),
    name: v.optional(v.string()),
    isCompleted: v.optional(v.boolean()),
    courses: v.optional(v.array(course)),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const gradingPeriod = await ctx.db.get(args.id);

    if (!gradingPeriod) {
      throw new Error("GradingPeriod not found");
    }

    if (gradingPeriod.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own gradingPeriods");
    }

    const updateData: any = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.isCompleted !== undefined) updateData.isCompleted = args.isCompleted;
    if (args.courses !== undefined) {
      // Calculate and set GPA for all courses
      const coursesWithGPA = await calculateCoursesGPA(ctx, args.courses);
      updateData.courses = coursesWithGPA;
      // Recalculate grades and GPAs when courses are updated
      updateData.grade = calculateGradingPeriodGrade(coursesWithGPA);
      updateData.core_grade = calculateCoreGrade(coursesWithGPA);
      updateData.gpa = await calculateGradingPeriodGPA(ctx, coursesWithGPA);
      updateData.core_gpa = await calculateCoreGPA(ctx, coursesWithGPA);
    }

    await ctx.db.patch(args.id, updateData);
  },
});

export const updateGrades = mutation({
  args: {
    id: v.id("gradingPeriods"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const gradingPeriod = await ctx.db.get(args.id);

    if (!gradingPeriod) {
      throw new Error("GradingPeriod not found");
    }

    if (gradingPeriod.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own gradingPeriods");
    }

    // Recalculate and set GPA for all courses
    const coursesWithGPA = await calculateCoursesGPA(ctx, gradingPeriod.courses);
    const grade = calculateGradingPeriodGrade(coursesWithGPA);
    const core_grade = calculateCoreGrade(coursesWithGPA);
    const gpa = await calculateGradingPeriodGPA(ctx, coursesWithGPA);
    const core_gpa = await calculateCoreGPA(ctx, coursesWithGPA);

    await ctx.db.patch(args.id, { 
      courses: coursesWithGPA,
      grade, 
      core_grade,
      gpa: gpa ?? undefined,
      core_gpa: core_gpa ?? undefined,
    });
  },
});

export const addCourse = mutation({
  args: {
    id: v.id("gradingPeriods"),
    course: course,
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const gradingPeriod = await ctx.db.get(args.id);

    if (!gradingPeriod) {
      throw new Error("GradingPeriod not found");
    }

    if (gradingPeriod.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own gradingPeriods");
    }

    const newIndex = gradingPeriod.courses.length;
    // Calculate and set GPA for the new course
    const courseWithGPA = await calculateCourseGPA(ctx, args.course);
    const updatedCourses = [...gradingPeriod.courses, courseWithGPA];

    // Recalculate grades and GPAs
    const grade = calculateGradingPeriodGrade(updatedCourses);
    const core_grade = calculateCoreGrade(updatedCourses);
    const gpa = await calculateGradingPeriodGPA(ctx, updatedCourses);
    const core_gpa = await calculateCoreGPA(ctx, updatedCourses);

    await ctx.db.patch(args.id, {
      courses: updatedCourses,
      grade,
      core_grade,
      gpa: gpa ?? undefined,
      core_gpa: core_gpa ?? undefined,
    });

    return {
      gradingPeriodId: args.id,
      courseIndex: newIndex,
    };
  },
});

export const updateCourse = mutation({
  args: {
    gradingPeriodId: v.id("gradingPeriods"),
    courseIndex: v.number(),
    course: course,
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const gradingPeriod = await ctx.db.get(args.gradingPeriodId);

    if (!gradingPeriod) {
      throw new Error("GradingPeriod not found");
    }

    if (gradingPeriod.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own gradingPeriods");
    }

    const index = Math.floor(args.courseIndex);
    if (
      !Number.isFinite(index) ||
      index < 0 ||
      index >= (gradingPeriod.courses?.length ?? 0)
    ) {
      throw new Error("Course not found");
    }

    const courses = [...gradingPeriod.courses];
    // Calculate and set GPA for the updated course
    const courseWithGPA = await calculateCourseGPA(ctx, args.course);
    courses[index] = courseWithGPA;

    // Recalculate grades and GPAs
    const grade = calculateGradingPeriodGrade(courses);
    const core_grade = calculateCoreGrade(courses);
    const gpa = await calculateGradingPeriodGPA(ctx, courses);
    const core_gpa = await calculateCoreGPA(ctx, courses);

    await ctx.db.patch(args.gradingPeriodId, { 
      courses, 
      grade, 
      core_grade,
      gpa: gpa ?? undefined,
      core_gpa: core_gpa ?? undefined,
    });
  },
});

export const removeCourse = mutation({
  args: {
    gradingPeriodId: v.id("gradingPeriods"),
    courseIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const gradingPeriod = await ctx.db.get(args.gradingPeriodId);

    if (!gradingPeriod) {
      throw new Error("GradingPeriod not found");
    }

    if (gradingPeriod.userId !== userId) {
      throw new Error("Unauthorized: You can only update your own gradingPeriods");
    }

    const index = Math.floor(args.courseIndex);
    if (
      !Number.isFinite(index) ||
      index < 0 ||
      index >= (gradingPeriod.courses?.length ?? 0)
    ) {
      throw new Error("Course not found");
    }

    const courses = [...gradingPeriod.courses];
    courses.splice(index, 1);

    // Recalculate grades and GPAs
    const grade = calculateGradingPeriodGrade(courses);
    const core_grade = calculateCoreGrade(courses);
    const gpa = await calculateGradingPeriodGPA(ctx, courses);
    const core_gpa = await calculateCoreGPA(ctx, courses);

    await ctx.db.patch(args.gradingPeriodId, {
      courses,
      grade,
      core_grade,
      gpa: gpa ?? undefined,
      core_gpa: core_gpa ?? undefined,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("gradingPeriods"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const gradingPeriod = await ctx.db.get(args.id);

    if (!gradingPeriod) {
      throw new Error("GradingPeriod not found");
    }

    if (gradingPeriod.userId !== userId) {
      throw new Error("Unauthorized: You can only delete your own gradingPeriods");
    }

    await ctx.db.delete(args.id);
  },
});