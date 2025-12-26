import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const assignment = v.object({
  score: v.number(),
  max_score: v.number(),
});

export const category = v.object({
  name: v.string(),
  weight: v.number(),
  evenly_weighted: v.boolean(),
  drop_policy: v.optional(v.object({
    drop_count: v.number(),
    drop_with: v.optional(v.number()), // category index to replace with, or undefined to drop completely
  })),
  extra_credit: v.boolean(),
  manual: v.boolean(),
  grade: v.number(),
  assignments: v.optional(v.array(assignment)),
});

export const course = v.object({
  name: v.string(),
  credits: v.number(),
  manual: v.boolean(),
  grade: v.number(),
  gpa: v.optional(v.number()),
  from_extra_credit: v.number(),
  part_of_degree: v.boolean(),
  categories: v.optional(v.array(category)),
});

export const gradingPeriodInput = v.object({
  name: v.string(),
  isCompleted: v.boolean(),
  courses: v.array(course),
  grade: v.optional(v.number()),
  core_grade: v.optional(v.number()),
  gpa: v.optional(v.number()),
  core_gpa: v.optional(v.number()),
});

const gradingPeriod = {
  name: v.string(),
  isCompleted: v.boolean(),
  courses: v.array(course),
  userId: v.id("users"),
  grade: v.number(),
  core_grade: v.optional(v.number()),
  gpa: v.optional(v.number()),
  core_gpa: v.optional(v.number()),
}

const settings = {
  userId: v.id("users"),
  gradingPeriodName: v.union(v.literal("Semesters"), v.literal("Trimesters"), v.literal("Quarters")),
  gpaScale: v.string(),
  customScale: v.optional(v.array(v.object({ minPercentage: v.number(), gpa: v.number() }))),
  university: v.optional(v.string()),
};

const template = {
  university: v.string(),
  courseCode: v.string(),
  courseTitle: v.string(),
  instructor: v.string(),
  categories: v.array(category),
  public: v.boolean(),
  downloadCount: v.number(),
  createdAt: v.number(),
  createdBy: v.optional(v.id("users")),
};

const schema = defineSchema({
  ...authTables,
  gradingPeriods: defineTable(gradingPeriod).index("by_userId", ["userId"]),
  settings: defineTable(settings).index("by_userId", ["userId"]),
  templates: defineTable(template)
    .index("by_university", ["university"])
    .index("by_public", ["public"])
    .index("by_university_public", ["university", "public"]),
});
 
export default schema;