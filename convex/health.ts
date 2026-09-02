import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { resolveUserByToken } from "./ideas";

/**
 * Idea Health Dashboard — derived metrics recomputed from live data.
 * communityInterest <- contribution/human activity, feasibility/impact/resource
 * are heuristic but ALWAYS grounded in real counts (never random).
 */

export const refreshHealth = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");

    const contributions = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .take(200);
    const humans = contributions.filter((c) => c.contributorType === "human").length;
    const agents = contributions.filter((c) => c.contributorType === "agent").length;
    const forks = await ctx.db
      .query("forks")
      .withIndex("by_parent", (q) => q.eq("parentIdeaId", args.ideaId))
      .take(20);
    const humanContributions = Math.max(0, humans - 1); // exclude the seed
    const commentCount = humanContributions;

    const communityInterest = Math.min(
      98,
      Math.round(
        (idea.visibility === "community" ? 40 : 0) +
          commentCount * 8 +
          forks.length * 6 +
          agents * 2
      )
    );
    const feasibility = Math.min(96, Math.round(35 + idea.fitness * 0.3 + agents * 2));
    const impactPotential = Math.min(
      97,
      Math.round(55 + commentCount * 4 + forks.length * 5)
    );
    const resourceAvailability = Math.min(
      90,
      Math.round(30 + commentCount * 6 + idea.fitness * 0.2)
    );

    const gaps: string[] = [];
    if (commentCount === 0) gaps.push("No community feedback yet");
    if (forks.length === 0 && idea.visibility === "community") gaps.push("No branches exploring new angles");
    if (agents === 0) gaps.push("The agents have not worked on this idea yet");
    if (resourceAvailability < 60) gaps.push("Resources / contributors needed");

    const suggestions: string[] = [];
    if (idea.visibility === "personal")
      suggestions.push("Publish to community for momentum");
    if (agents === 0) suggestions.push("Run the agents on this idea");
    if (commentCount === 0) suggestions.push("Ask a direct question to invite feedback");
    if (gaps.length === 0) suggestions.push("Branch into a new direction to keep evolving");

    const existing = await ctx.db
      .query("health")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        communityInterest,
        feasibility,
        impactPotential,
        resourceAvailability,
        gaps,
        suggestions,
      });
    } else {
      await ctx.db.insert("health", {
        ideaId: args.ideaId,
        communityInterest,
        feasibility,
        impactPotential,
        resourceAvailability,
        gaps,
        suggestions,
      });
    }
    return { communityInterest, feasibility, impactPotential, resourceAvailability, gaps, suggestions };
  },
});
