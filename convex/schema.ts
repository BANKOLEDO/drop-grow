import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const contentKindValidator = v.union(
  v.literal("text"),
  v.literal("voice"),
  v.literal("image")
);

export const visibilityValidator = v.union(
  v.literal("personal"),
  v.literal("community")
);

export const ideaStageValidator = v.union(
  v.literal("seed"),
  v.literal("hatching"),
  v.literal("growing"),
  v.literal("building"),
  v.literal("mature")
);

export const agentRoleValidator = v.union(
  v.literal("research"),
  v.literal("design"),
  v.literal("content"),
  v.literal("tech"),
  v.literal("strategy"),
  v.literal("budget"),
  v.literal("community")
);

export const contributorTypeValidator = v.union(
  v.literal("human"),
  v.literal("agent")
);

export default defineSchema({
  users: defineTable({
    name: v.string(),
    handle: v.string(),
    interests: v.optional(v.array(v.string())),
    bio: v.optional(v.string()),
    secretHash: v.optional(v.string()),
    joinedAt: v.number(),
  }).index("by_handle", ["handle"]),

  sessions: defineTable({
    tokenHash: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
    ip: v.optional(v.string()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),

  ideas: defineTable({
    input: v.string(),
    contentKind: contentKindValidator,
    authorId: v.id("users"),
    authorHandle: v.string(),
    authorType: contributorTypeValidator,
    visibility: visibilityValidator,
    fitness: v.number(),
    stage: ideaStageValidator,
    contributorRoles: v.array(agentRoleValidator),
    contributionCount: v.number(),
    forkCount: v.number(),
    title: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    transcript: v.optional(v.string()),
    imageDescription: v.optional(v.string()),
    proofType: v.optional(v.string()),
    proofUrl: v.optional(v.string()),
    proofText: v.optional(v.string()),
    proofImageStorageId: v.optional(v.id("_storage")),
  })
    .index("by_visibility", ["visibility"])
    .index("by_author", ["authorId"])
    .index("by_fitness", ["visibility", "fitness"])
    .index("by_stage", ["visibility", "stage"]),

  contributions: defineTable({
    ideaId: v.id("ideas"),
    mutationKind: v.string(),
    contributorType: contributorTypeValidator,
    contributorId: v.union(v.id("users"), v.null()),
    contributorHandle: v.string(),
    agentRole: v.optional(agentRoleValidator),
    content: v.string(),
    impact: v.number(),
  }).index("by_idea", ["ideaId"]),

  forks: defineTable({
    parentIdeaId: v.id("ideas"),
    childIdeaId: v.id("ideas"),
    description: v.string(),
    forkedByHandle: v.string(),
  })
    .index("by_parent", ["parentIdeaId"])
    .index("by_child", ["childIdeaId"]),

  connections: defineTable({
    ideaId: v.id("ideas"),
    relatedIdeaId: v.id("ideas"),
    strength: v.number(),
    reason: v.string(),
  })
    .index("by_idea", ["ideaId"])
    .index("by_idea_strength", ["ideaId", "strength"]),

  health: defineTable({
    ideaId: v.id("ideas"),
    communityInterest: v.number(),
    feasibility: v.number(),
    impactPotential: v.number(),
    resourceAvailability: v.number(),
    gaps: v.array(v.string()),
    suggestions: v.array(v.string()),
  })
    .index("by_idea", ["ideaId"]),

  comments: defineTable({
    contributionId: v.id("contributions"),
    authorId: v.id("users"),
    authorHandle: v.string(),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_contribution", ["contributionId"]),
});
