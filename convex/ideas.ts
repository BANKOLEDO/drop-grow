import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { runPipeline, runPipelineWithLLM } from "./agents/engine";
import {
  contentKindValidator,
  visibilityValidator,
  type Doc,
} from "./helpers";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a Convex Blob upload URL for image uploads. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Link an uploaded image to an idea. */
export const saveFileToIdea = mutation({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");

    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Not your idea.");

    await ctx.db.patch(args.ideaId, { imageStorageId: args.storageId });
  },
});

/** Save transcript and image description to an idea. */
export const saveIdeaMetadata = mutation({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
    transcript: v.optional(v.string()),
    imageDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");

    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Not your idea.");

    const patch: Record<string, any> = {};
    if (args.transcript !== undefined) patch.transcript = args.transcript;
    if (args.imageDescription !== undefined) patch.imageDescription = args.imageDescription;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.ideaId, patch);
    }
  },
});

export async function resolveUserByToken(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  token: string
): Promise<Doc<"users"> | null> {
  const hash = await sha256(token);
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", hash))
    .first();
  if (!session) return null;
  return (await ctx.db.get(session.userId)) ?? null;
}

/** Derived stage — capped at "growing"; "building"/"mature" require explicit human actions. */
export function stageForCount(count: number): "seed" | "hatching" | "growing" {
  if (count <= 1) return "seed";
  if (count <= 4) return "hatching";
  return "growing";
}

/**
 * Auto-advance stage from contributions, but NEVER regress a stage that was
 * promoted by an explicit human action ("building" via markAsBuilding, "mature"
 * via finalizeIdea). Otherwise a subsequent agent run or human note would wipe
 * the manual promotion back down to "growing".
 */
export function nextStage(
  current: "seed" | "hatching" | "growing" | "building" | "mature",
  count: number,
) {
  const derived = stageForCount(count);
  const order: Record<string, number> = {
    seed: 0,
    hatching: 1,
    growing: 2,
    building: 3,
    mature: 4,
  };
  return order[derived] > order[current] ? derived : current;
}

/** Activity that moves an idea's stage: only the owner's own human notes plus agent runs. */
function ownerActivityCount(contributions: Doc<"contributions">[], authorId: Id<"users">): number {
  return contributions.filter(
    (c) => c.contributorType === "agent" || c.contributorId === authorId
  ).length;
}

export const getIdea = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const idea = await ctx.db.get(ideaId);
    if (!idea) return null;
    const contributions = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .take(100);
    const health = await ctx.db
      .query("health")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .first();
    return { idea, contributions, health };
  },
});

export const listIdeas = query({
  args: {
    visibility: v.optional(visibilityValidator),
    token: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    if (args.visibility === "community") {
      return ctx.db
        .query("ideas")
        .withIndex("by_fitness", (q) => q.eq("visibility", "community"))
        .order("desc")
        .take(limit);
    }
    if (args.visibility === "personal" && args.token) {
      const user = await resolveUserByToken(ctx, args.token);
      if (!user) return [];
      const mine = await ctx.db
        .query("ideas")
        .withIndex("by_author", (q) => q.eq("authorId", user._id))
        .take(limit);
      return mine.filter((i) => i.visibility === "personal");
    }
    return ctx.db
      .query("ideas")
      .withIndex("by_visibility", (q) => q.eq("visibility", "community"))
      .take(limit);
  },
});

export const listCommunityPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_fitness", (q) => q.eq("visibility", "community"))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const createIdea = mutation({
  args: {
    token: v.string(),
    input: v.string(),
    contentKind: contentKindValidator,
    visibility: visibilityValidator,
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const input = args.input.trim();
    if (!input) throw new Error("Idea cannot be empty.");

    const ideaId = await ctx.db.insert("ideas", {
      input,
      contentKind: args.contentKind,
      authorId: user._id,
      authorHandle: user.handle,
      authorType: "human",
      visibility: args.visibility,
      fitness: 0,
      stage: "seed",
      contributorRoles: [],
      contributionCount: 0,
      forkCount: 0,
    });

    await ctx.db.insert("contributions", {
      ideaId,
      mutationKind: "seed",
      contributorType: "human",
      contributorId: user._id,
      contributorHandle: user.handle,
      agentRole: undefined,
      content: input,
      impact: 10,
    });

    await ctx.db.insert("health", {
      ideaId,
      communityInterest: args.visibility === "community" ? 30 : 0,
      feasibility: 40,
      impactPotential: 60,
      resourceAvailability: 30,
      gaps: ["Community survey", "Founding scope"],
      suggestions: ["Confirm the founding scope", "Run a first survey"],
    });

    return { ideaId };
  },
});

/** Run the full agent pipeline on an idea. */
export const runAgents = mutation({
  args: { token: v.string(), ideaId: v.id("ideas"), motivation: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Not your idea.");

    const existing = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .take(200);
    const prior = existing.map((c) => ({
      agentRole: c.agentRole ?? null,
      contributorHandle: c.contributorHandle,
      content: c.content,
    }));
    const humanCount = existing.filter((c) => c.contributorType === "human").length;
    const agentCount = existing.filter((c) => c.contributorType === "agent").length;

    const outputs = runPipeline({
      ideaId: args.ideaId,
      input: idea.input,
      contentKind: idea.contentKind,
      authorHandle: idea.authorHandle,
      stage: idea.stage,
      visibility: idea.visibility,
      humanContributions: humanCount,
      agentContributions: agentCount,
    }, prior);

    for (const out of outputs) {
      const prev = await ctx.db
        .query("contributions")
        .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
        .filter((q) => q.eq(q.field("agentRole"), out.role as any))
        .first();
      if (prev) await ctx.db.delete(prev._id);
      await ctx.db.insert("contributions", {
        ideaId: args.ideaId,
        mutationKind: out.role,
        contributorType: "agent",
        contributorId: null,
        contributorHandle: out.role,
        agentRole: out.role,
        content: out.content,
        impact: out.impact,
      });
    }

    const fresh = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .take(500);
    const newCount = fresh.length;
    const roles = [...new Set(fresh.map((c) => c.agentRole).filter(Boolean))];
    await ctx.db.patch(args.ideaId, {
      contributionCount: newCount,
      stage: nextStage(idea.stage, ownerActivityCount(fresh, idea.authorId)),
      contributorRoles: roles as never[],
      fitness: Math.min(100, fresh.reduce((a, c) => a + c.impact, 0)),
    });

    return { contributed: outputs.length };
  },
});

/**
 * Run agents with LLM (Groq/Cloudflare) for real, relevant responses.
 * Falls back to deterministic templates if no LLM keys are configured.
 * Handles multimodal: describes images from Blob, uses transcripts.
 */
export const runAgentsLLM = action({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runMutation(api.ideas._runAgentsLLM_auth, {
      token: args.token,
      ideaId: args.ideaId,
    });
    if (!user) throw new Error("Not authenticated.");

    const ideaResult = await ctx.runQuery(api.ideas.getIdea, { ideaId: args.ideaId });
    if (!ideaResult) throw new Error("Idea not found.");
    const idea = ideaResult.idea;
    if (idea.authorId !== user.userId) throw new Error("Not your idea.");

    // Build enriched input — include image description/transcript
    let enrichedInput = idea.input;
    if (idea.imageDescription) enrichedInput += `\n\nImage: ${idea.imageDescription}`;
    if (idea.transcript) enrichedInput += `\n\nTranscript: ${idea.transcript}`;

    const hasCFVision = Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);

    // Enrich based on content kind so agents can understand every input type.
    try {
      const { describeImage } = await import("./agents/llm");

      // --- Images: describe via Cloudflare vision ---
      if (idea.contentKind === "image" && idea.imageStorageId) {
        if (hasCFVision) {
          const blobUrl = await ctx.runQuery(api.ideas._getBlobUrl, {
            storageId: idea.imageStorageId,
          });
          if (blobUrl) {
            const desc = await describeImage(
              process.env.CF_ACCOUNT_ID!,
              process.env.CF_API_TOKEN!,
              blobUrl,
            );
            if (desc) enrichedInput += `\n\nImage description: ${desc}`;
          }
        } else {
          enrichedInput += `\n\n[This idea was shared as an image; add Cloudflare account credentials to generate an AI description.]`;
        }
      }
    } catch (e) {
      console.error("Input enrichment failed:", e);
    }

    const existing = ideaResult.contributions;
    const prior = existing.map((c: any) => ({
      agentRole: c.agentRole ?? null,
      contributorHandle: c.contributorHandle,
      content: c.content,
    }));
    const humanCount = existing.filter((c: any) => c.contributorType === "human").length;
    const agentCount = existing.filter((c: any) => c.contributorType === "agent").length;

    // Pre-compute all LLM results concurrently (one call, not 6)
    const { callAllAgents } = await import("./agents/llm");
    const priorTexts = prior.map((p) => p.content);
    const llmResults = await callAllAgents(enrichedInput, idea.contentKind, priorTexts, {
      groq: process.env.GROQ_API_KEY,
      cfAccountId: process.env.CF_ACCOUNT_ID,
      cfApiToken: process.env.CF_API_TOKEN,
    });

    // LLM caller — looks up pre-computed results
    const llmCaller = async (role: string, _ideaInput: string, _contentKind: string, _priorTexts: string[]) => {
      const result = llmResults.get(role as any);
      return result && result.provider !== "deterministic" ? result.content : null;
    };

    const outputs = await runPipelineWithLLM(
      {
        ideaId: args.ideaId,
        input: enrichedInput,
        contentKind: idea.contentKind,
        authorHandle: idea.authorHandle,
        stage: idea.stage,
        visibility: idea.visibility,
        humanContributions: humanCount,
        agentContributions: agentCount,
      },
      prior,
      llmCaller,
    );

    await ctx.runMutation(api.ideas._runAgentsLLM_save, {
      token: args.token,
      ideaId: args.ideaId,
      outputs: outputs.map((o) => ({
        role: o.role,
        content: o.content,
        impact: o.impact,
      })),
    });

    return { contributed: outputs.length };
  },
});

/** Internal helper: get a signed blob URL for a storage ID. */
export const _getBlobUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/** Internal helper: auth check for runAgentsLLM action. */
export const _runAgentsLLM_auth = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    return user ? { userId: user._id, ok: true } : null;
  },
});

/** Internal helper: save agent outputs for runAgentsLLM action. */
export const _runAgentsLLM_save = mutation({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
    outputs: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        impact: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");

    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Not your idea.");

    for (const out of args.outputs) {
      const prev = await ctx.db
        .query("contributions")
        .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
        .filter((q) => q.eq(q.field("agentRole"), out.role as any))
        .first();
      if (prev) await ctx.db.delete(prev._id);
      await ctx.db.insert("contributions", {
        ideaId: args.ideaId,
        mutationKind: out.role,
        contributorType: "agent",
        contributorId: null,
        contributorHandle: out.role,
        agentRole: out.role as any,
        content: out.content,
        impact: out.impact,
      });
    }

    const fresh = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .take(500);
    const newCount = fresh.length;
    const roles = [...new Set(fresh.map((c) => c.agentRole).filter(Boolean))];

    await ctx.db.patch(args.ideaId, {
      contributionCount: newCount,
      stage: nextStage(idea.stage, ownerActivityCount(fresh, idea.authorId)),
      contributorRoles: roles as never[],
      fitness: Math.min(100, fresh.reduce((a, c) => a + c.impact, 0)),
    });
  },
});

/** A human adds a mutation (contribution) to an idea. */
export const contribute = mutation({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    const content = args.content.trim();
    if (!content) throw new Error("Contribution cannot be empty.");

    await ctx.db.insert("contributions", {
      ideaId: args.ideaId,
      mutationKind: "wisdom",
      contributorType: "human",
      contributorId: user._id,
      contributorHandle: user.handle,
      agentRole: undefined,
      content,
      impact: 8,
    });

    const newCount = idea.contributionCount + 1;
    const all = await ctx.db
      .query("contributions")
      .withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))
      .take(500);
    await ctx.db.patch(args.ideaId, {
      contributionCount: newCount,
      stage: nextStage(idea.stage, ownerActivityCount(all, idea.authorId)),
      fitness: Math.min(100, idea.fitness + 8),
    });

    return { ok: true };
  },
});

export const forkIdea = mutation({
  args: {
    token: v.string(),
    parentIdeaId: v.id("ideas"),
    input: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const parent = await ctx.db.get(args.parentIdeaId);
    if (!parent) throw new Error("Parent idea not found.");
    const input = args.input.trim();
    if (!input) throw new Error("Branch direction cannot be empty.");

    const childId = await ctx.db.insert("ideas", {
      input,
      contentKind: "text",
      authorId: user._id,
      authorHandle: user.handle,
      authorType: "human",
      visibility: parent.visibility,
      fitness: Math.round(parent.fitness * 0.6),
      stage: "seed",
      contributorRoles: [],
      contributionCount: 1,
      forkCount: 0,
    });

    await ctx.db.insert("contributions", {
      ideaId: childId,
      mutationKind: "seed",
      contributorType: "human",
      contributorId: user._id,
      contributorHandle: user.handle,
      agentRole: undefined,
      content: input,
      impact: 10,
    });

    await ctx.db.insert("forks", {
      parentIdeaId: parent._id,
      childIdeaId: childId,
      description: args.description.trim() || "New direction",
      forkedByHandle: user.handle,
    });

    await ctx.db.patch(parent._id, { forkCount: parent.forkCount + 1 });
    return { childIdeaId: childId };
  },
});

export const publishToCommunity = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Only the author can publish.");
    if (idea.visibility === "community") return { visibility: idea.visibility };
    await ctx.db.patch(args.ideaId, { visibility: "community" });
    return { visibility: "community" };
  },
});

/** Unpublish an idea — moves it back to personal (only visible to the author). */
export const makePrivate = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Only the author can do this.");
    if (idea.visibility === "personal") return { visibility: idea.visibility };
    await ctx.db.patch(args.ideaId, { visibility: "personal" });
    await ctx.db.insert("contributions", {
      ideaId: args.ideaId,
      mutationKind: "wisdom",
      contributorType: "human",
      contributorId: user._id,
      contributorHandle: user.handle,
      agentRole: undefined,
      content: "Set back to personal — no longer visible in the community.",
      impact: 5,
    });
    return { visibility: "personal" };
  },
});

/** Delete an idea and everything tied to it (contributions, comments, health, forks, connections). */
export const deleteIdea = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Only the author can delete an idea.");

    const contributions = await ctx.db.query("contributions").withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId)).collect();
    for (const c of contributions) {
      for await (const comment of ctx.db.query("comments").withIndex("by_contribution", (q) => q.eq("contributionId", c._id))) {
        await ctx.db.delete(comment._id);
      }
      await ctx.db.delete(c._id);
    }

    for await (const h of ctx.db.query("health").withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))) {
      await ctx.db.delete(h._id);
    }

    // Remove this idea from other ideas' fork/connection records too.
    for await (const f of ctx.db.query("forks").withIndex("by_child", (q) => q.eq("childIdeaId", args.ideaId))) {
      await ctx.db.delete(f._id);
    }
    for await (const f of ctx.db.query("forks").withIndex("by_parent", (q) => q.eq("parentIdeaId", args.ideaId))) {
      await ctx.db.delete(f._id);
    }
    for await (const c of ctx.db.query("connections").withIndex("by_idea", (q) => q.eq("ideaId", args.ideaId))) {
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(args.ideaId);
    return { deleted: true, ideaId: args.ideaId };
  },
});

/** Edit an idea's input text (owner only). */
export const editIdea = mutation({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
    input: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Only the author can edit.");
    const input = args.input.trim();
    if (!input) throw new Error("Idea cannot be empty.");
    await ctx.db.patch(args.ideaId, { input });
    return { ok: true, ideaId: args.ideaId };
  },
});

export const finalizeIdea = mutation({
  args: {
    token: v.string(),
    ideaId: v.id("ideas"),
    proofType: v.optional(v.string()),
    proofUrl: v.optional(v.string()),
    proofText: v.optional(v.string()),
    proofImageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Only the author can finalize.");

    const patch: Record<string, any> = {
      stage: "mature",
      fitness: 100,
    };
    if (args.proofType) patch.proofType = args.proofType;
    if (args.proofUrl) patch.proofUrl = args.proofUrl;
    if (args.proofText) patch.proofText = args.proofText;
    if (args.proofImageStorageId) patch.proofImageStorageId = args.proofImageStorageId;

    await ctx.db.patch(args.ideaId, patch);

    const proofSummary = args.proofType === "link"
      ? `Idea finalized with proof: ${args.proofUrl}`
      : args.proofType === "photo"
        ? "Idea finalized with a photo."
        : args.proofType === "text"
          ? `Idea finalized. Lesson: ${args.proofText?.slice(0, 100)}`
          : "Idea finalized — ready for next steps.";

    await ctx.db.insert("contributions", {
      ideaId: args.ideaId,
      mutationKind: "synthesis",
      contributorType: "human",
      contributorId: user._id,
      contributorHandle: user.handle,
      agentRole: undefined,
      content: proofSummary,
      impact: 15,
    });

    return { stage: "mature" };
  },
});

/** Mark an idea as building — moves it to the building stage. */
export const markAsBuilding = mutation({
  args: { token: v.string(), ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const user = await resolveUserByToken(ctx, args.token);
    if (!user) throw new Error("Not authenticated.");
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found.");
    if (idea.authorId !== user._id) throw new Error("Only the author can do this.");
    if (idea.stage === "mature") throw new Error("Already finalized.");
    if (idea.stage === "building") throw new Error("Already building.");

    await ctx.db.patch(args.ideaId, { stage: "building" });

    await ctx.db.insert("contributions", {
      ideaId: args.ideaId,
      mutationKind: "wisdom",
      contributorType: "human",
      contributorId: user._id,
      contributorHandle: user.handle,
      agentRole: undefined,
      content: "Marked as building — this idea is now being worked on.",
      impact: 10,
    });

    return { stage: "building" };
  },
});
