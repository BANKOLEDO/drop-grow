import { v } from "convex/values";
import { internalMutation, query, mutation } from "./_generated/server";
import { resolveUserByToken } from "./ideas";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "have",
  "want", "into", "about", "over", "under", "more", "will", "would",
  "could", "should", "their", "there", "what", "when", "where", "which",
  "community", "project", "idea", "build", "make", "start", "new", "like",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Compute cross-pollination strength between two ideas via shared vocabulary.
 * Pure + deterministic: overlapping distinctive tokens => connection strength.
 * Extension point: swap for real embeddings later — same output contract.
 */
export function connectionStrength(a: string, b: string): { strength: number; reason: string } {
  const ta = tokens(a);
  const tb = tokens(b);
  const shared = [...ta].filter((t) => tb.has(t));
  if (shared.length === 0) return { strength: 0, reason: "No shared vocabulary" };
  const union = new Set([...ta, ...tb]);
  const jaccard = shared.length / union.size;
  const strength = Math.round(Math.min(95, jaccard * 200 + Math.min(shared.length, 4) * 5));
  return {
    strength,
    reason: `Shared focus: ${shared.slice(0, 3).join(", ")}`,
  };
}

/** Recompute connections for an idea against other community ideas. */
export const computeConnections = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");

    const others = await ctx.db
      .query("ideas")
      .withIndex("by_visibility", (q) => q.eq("visibility", "community"))
      .take(60);

    for (const other of others) {
      if (other._id === idea._id) continue;
      const { strength, reason } = connectionStrength(idea.input, other.input);
      if (strength < 30) continue;
      const existing = await ctx.db
        .query("connections")
        .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
        .filter((q) => q.eq(q.field("relatedIdeaId"), other._id))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { strength, reason });
      } else if (idea._id && other._id) {
        await ctx.db.insert("connections", {
          ideaId: idea._id,
          relatedIdeaId: other._id,
          strength,
          reason,
        });
      }
    }
    return { ok: true };
  },
});

/** Internal recompute used by the seeding path (no auth needed internally). */
export const recomputeAllConnections = internalMutation({
  handler: async (ctx) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_visibility", (q) => q.eq("visibility", "community"))
      .take(60);
    for (const idea of ideas) {
      for (const other of ideas) {
        if (other._id === idea._id) continue;
      const { strength, reason } = connectionStrength(idea.input, other.input);
        if (strength < 30) continue;
        const existing = await ctx.db
          .query("connections")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .filter((q) => q.eq(q.field("relatedIdeaId"), other._id))
          .first();
        if (existing) {
          await ctx.db.patch(existing._id, { strength, reason });
        } else {
          await ctx.db.insert("connections", {
            ideaId: idea._id,
            relatedIdeaId: other._id,
            strength,
            reason,
          });
        }
      }
    }
  },
});

export const listConnections = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const conns = await ctx.db
      .query("connections")
      .withIndex("by_idea_strength", (q) => q.eq("ideaId", ideaId))
      .order("desc")
      .take(20);
    const withIdeas = await Promise.all(
      conns.map(async (c) => {
        const related = await ctx.db.get(c.relatedIdeaId);
        return related ? { ...c, related } : null;
      })
    );
    return withIdeas.filter(Boolean);
  },
});
