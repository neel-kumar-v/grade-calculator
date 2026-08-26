import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { category } from "./schema";
import type { Id } from "./_generated/dataModel";

async function getCurrentUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await auth.getUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

export const create = mutation({
  args: {
    university: v.string(),
    courseCode: v.string(),
    courseTitle: v.string(),
    instructor: v.string(),
    categories: v.array(category),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Run moderation on free text fields
    const shouldShadowBan = false;

    // Validate categories
    if (!args.categories || args.categories.length === 0) {
      throw new Error("Template must have at least one category");
    }

    const templateId = await ctx.db.insert("templates", {
      university: args.university,
      courseCode: args.courseCode,
      courseTitle: args.courseTitle,
      instructor: args.instructor,
      categories: args.categories,
      public: !shouldShadowBan, // Shadow ban if moderation fails
      downloadCount: 0,
      createdAt: Date.now(),
      createdBy: userId,
    });

    return templateId;
  },
});

export const update = mutation({
  args: {
    id: v.id("templates"),
    university: v.string(),
    courseCode: v.string(),
    courseTitle: v.string(),
    instructor: v.string(),
    categories: v.array(category),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const template = await ctx.db.get(args.id);

    if (!template) {
      throw new Error("Template not found");
    }

    if (template.createdBy !== userId) {
      throw new Error("Unauthorized: You can only edit templates you created");
    }

    if (!args.categories || args.categories.length === 0) {
      throw new Error("Template must have at least one category");
    }

    await ctx.db.patch(args.id, {
      university: args.university,
      courseCode: args.courseCode,
      courseTitle: args.courseTitle,
      instructor: args.instructor,
      categories: args.categories,
    });

    return args.id;
  },
});

export const search = query({
  args: {
    query: v.optional(v.string()),
    university: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchQuery = args.query?.toLowerCase().trim() || "";
    const university = args.university?.trim();
    const page = args.page || 1;
    const limit = Math.min(args.limit || 20, 100); // Max 100 per page

    let templates = await ctx.db
      .query("templates")
      .withIndex("by_public", (q) => q.eq("public", true))
      .collect();

    // Filter by university if provided
    if (university) {
      templates = templates.filter((t) => 
        t.university.toLowerCase().includes(university.toLowerCase())
      );
    }

    // Search across courseCode, courseTitle, instructor
    if (searchQuery) {
      templates = templates.filter((t) => {
        const codeMatch = t.courseCode.toLowerCase().includes(searchQuery);
        const titleMatch = t.courseTitle.toLowerCase().includes(searchQuery);
        const instructorMatch = t.instructor.toLowerCase().includes(searchQuery);
        return codeMatch || titleMatch || instructorMatch;
      });
    }

    // Sort alphabetically by course code
    templates.sort((a, b) => {
      const codeA = a.courseCode.toLowerCase();
      const codeB = b.courseCode.toLowerCase();
      if (codeA !== codeB) {
        return codeA.localeCompare(codeB);
      }
      // If course codes are the same, sort by title
      return a.courseTitle.toLowerCase().localeCompare(b.courseTitle.toLowerCase());
    });

    // Pagination
    const total = templates.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    const paginatedTemplates = templates.slice(startIndex, endIndex);

    return {
      data: paginatedTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },
});

export const getById = query({
  args: {
    id: v.id("templates"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);

    if (!template) {
      return null;
    }

    let isCreator = false;
    try {
      const userId = await auth.getUserId(ctx);
      if (userId && template.createdBy && userId === template.createdBy) {
        isCreator = true;
      }
    } catch {
      // Unauthenticated
    }

    // Only return public templates unless creator
    if (!template.public && !isCreator) {
      return null;
    }

    return {
      ...template,
      isCreator,
    };
  },
});

export const getTemplateForCourse = query({
  args: {
    templateId: v.optional(v.id("templates")),
    courseName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId: Id<"users"> | null = null;
    try {
      userId = await auth.getUserId(ctx);
    } catch {
      userId = null;
    }

    if (args.templateId) {
      const template = await ctx.db.get(args.templateId);
      if (template) {
        const isCreator = Boolean(userId && template.createdBy && userId === template.createdBy);
        return {
          ...template,
          isCreator,
        };
      }
    }

    // Fallback: If no templateId or template not found, check if current user created a template with matching courseCode/title
    if (userId && args.courseName) {
      const userTemplates = await ctx.db
        .query("templates")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", userId!))
        .collect();

      const normalizedCourseName = args.courseName.trim().toLowerCase();
      const match = userTemplates.find((t) => {
        const code = t.courseCode.trim().toLowerCase();
        const title = t.courseTitle.trim().toLowerCase();
        const combined = `${code} - ${title}`.toLowerCase();
        return (
          code === normalizedCourseName ||
          title === normalizedCourseName ||
          combined === normalizedCourseName ||
          normalizedCourseName.startsWith(code) ||
          code.startsWith(normalizedCourseName)
        );
      });

      if (match) {
        return {
          ...match,
          isCreator: true,
        };
      }
    }

    return null;
  },
});

export const incrementDownload = mutation({
  args: {
    id: v.id("templates"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);

    if (!template) {
      throw new Error("Template not found");
    }

    await ctx.db.patch(args.id, {
      downloadCount: template.downloadCount + 1,
    });

    return template.downloadCount + 1;
  },
});

export const getByUniversity = query({
  args: {
    university: v.string(),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = args.page || 1;
    const limit = Math.min(args.limit || 20, 100);

    const templates = await ctx.db
      .query("templates")
      .withIndex("by_university_public", (q) => 
        q.eq("university", args.university).eq("public", true)
      )
      .collect();

    // Sort alphabetically by course code
    templates.sort((a, b) => {
      const codeA = a.courseCode.toLowerCase();
      const codeB = b.courseCode.toLowerCase();
      if (codeA !== codeB) {
        return codeA.localeCompare(codeB);
      }
      return a.courseTitle.toLowerCase().localeCompare(b.courseTitle.toLowerCase());
    });

    // Pagination
    const total = templates.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    const paginatedTemplates = templates.slice(startIndex, endIndex);

    return {
      data: paginatedTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },
});
