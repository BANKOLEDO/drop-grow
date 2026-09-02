import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByContribution = query({
  args: { contributionId: v.id("contributions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_contribution", (q) => q.eq("contributionId", args.contributionId))
      .order("asc")
      .collect();
  },
});

export const listByIdea = query({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const contributions = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .collect();

    const commentCounts = new Map<string, number>();
    for (const c of contributions) {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_contribution", (q) => q.eq("contributionId", c._id))
        .collect();
      if (comments.length > 0) {
        commentCounts.set(c._id, comments.length);
      }
    }

    return Object.fromEntries(commentCounts);
  },
});

export const add = mutation({
  args: {
    token: v.string(),
    contributionId: v.id("contributions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { resolveUserByToken } = await import("./ideas");
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");

    const trimmed = args.content.trim();
    if (!trimmed) throw new Error("Comment cannot be empty.");
    if (trimmed.length > 1000) throw new Error("Comment too long (max 1000 characters).");

    const id = await ctx.db.insert("comments", {
      contributionId: args.contributionId,
      authorId: user._id,
      authorHandle: user.handle,
      content: trimmed,
      createdAt: Date.now(),
    });

    return { id };
  },
});

export const remove = mutation({
  args: {
    token: v.string(),
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const { resolveUserByToken } = await import("./ideas");
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found.");
    if (comment.authorId !== user._id) throw new Error("You can only delete your own comments.");

    await ctx.db.delete(args.commentId);
    return { deleted: true };
  },
});
