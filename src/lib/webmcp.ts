import { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import { dispatchUIControl } from "./ui-control";

const convexUrl =
  (import.meta as { env?: Record<string, string> }).env?.VITE_CONVEX_URL ??
  "http://127.0.0.1:3210";

const convex = new ConvexReactClient(convexUrl);

function getToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("dropgrow.token") ??
        localStorage.getItem("dropgrow-token")
    : null;
}

function schema(props: Record<string, unknown>) {
  return {
    type: "object" as const,
    properties: props,
    additionalProperties: false,
  };
}

interface WebMCPContext {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: unknown;
    annotations?: { readOnlyHint?: boolean };
    execute: (input: any) => Promise<unknown>;
  }) => void;
}

declare global {
  interface Document {
    modelContext?: WebMCPContext;
  }
}

let registered = false;
let agentHandle: string | null = null;

/** Emit a tool-execution event for the live activity monitor. */
function emitActivity(tool: string, status: "run" | "ok" | "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dropgrow:webmcp-activity", {
      detail: { tool, agent: agentHandle, ts: Date.now(), status },
    })
  );
}

/** Resolve the signed-in agent's handle so the activity feed can name it. */
async function refreshAgentHandle() {
  const token = getToken();
  if (!token) return;
  try {
    const me = await convex.query(api.auth.me, { token });
    agentHandle = me?.handle ?? agentHandle;
  } catch {
    // keep last known handle
  }
}

/** Dispatch a tour-control request (used by the tour WebMCP tools). */
function emitTour(action: "start" | "skip") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dropgrow:tour-control", { detail: { action } }));
}

/**
 * Ask the React UI bridge to act on the live browser (navigate / scroll / click /
 * read the page). Returns the outcome so the WebMCP tool can report what changed.
 */
async function emitUI(detail: {
  action: "navigate" | "open_idea" | "scroll" | "click" | "get_page";
  route?: string;
  ideaId?: string;
  direction?: "up" | "down" | "top" | "bottom";
  amount?: number;
  selector?: string;
  text?: string;
}): Promise<unknown> {
  if (typeof window === "undefined") return { error: "No browser window" };
  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve({ error: "UI bridge not ready (no React page mounted)" }),
      4000
    );
    dispatchUIControl({
      ...detail,
      resolve: (result: unknown) => {
        window.clearTimeout(timer);
        resolve(result);
      },
    });
  });
}

export function registerWebMCP() {
  if (typeof document === "undefined") return;
  if (registered) return;
  const modelContext = document.modelContext;
  if (typeof modelContext?.registerTool !== "function") return;
  registered = true;

  // Tell the UI the host is connected (e.g. "WebMCP connected" pill).
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dropgrow:webmcp-change"));
  }
  // Name the signed-in agent (if any) once we're live.
  void refreshAgentHandle();


  const rawRegister = modelContext.registerTool.bind(modelContext);
  const registerTool = (tool: {
    name: string;
    description: string;
    inputSchema: unknown;
    annotations?: { readOnlyHint?: boolean };
    execute: (input: any) => Promise<unknown>;
  }) => {
    const original = tool.execute.bind(tool);
    return rawRegister({
      ...tool,
      execute: async (input) => {
        emitActivity(tool.name, "run");
        try {
          const result = await original(input);
          emitActivity(tool.name, "ok");
          return result;
        } catch (e) {
          emitActivity(tool.name, "error");
          throw e;
        }
      },
    });
  };
  registerTool({
    name: "create_account",
    description:
      "Create a new agent account on drop&grow. Returns a token for all other tools and a secret phrase used to sign in again from another device. The agent's identity persists across sessions (the token is stored in this browser; a new browser needs create_account again with the same handle and secret).",
    inputSchema: schema({
      handle: {
        type: "string",
        description:
          "A unique handle for the agent (2-20 chars, alphanumeric and underscores only)",
      },
      name: {
        type: "string",
        description: "Display name for the agent (optional, defaults to handle)",
      },
      secret: {
        type: "string",
        description:
          "Secret phrase for this handle. Omit to have drop&grow generate one and return it. Use the same secret with the same handle to sign in from a new device.",
      },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({
      handle,
      name,
      secret,
    }: {
      handle: string;
      name?: string;
      secret?: string;
    }) => {
      const { ConvexReactClient } = await import("convex/react");
      const { api } = await import("@convex/_generated/api");
      const client = new ConvexReactClient(
        (import.meta as { env?: Record<string, string> }).env?.VITE_CONVEX_URL ??
          "http://127.0.0.1:3210"
      );
      const existing = getToken();
      const res: { token: string; userId: any; secret?: string } =
        await client.mutation(api.auth.signIn, {
          token: existing ?? undefined,
          secret,
          name: name || handle,
          handle,
        });
      const token = res.token;
      // Store in localStorage for future use
      if (typeof window !== "undefined") {
        localStorage.setItem("dropgrow.token", token);
        window.dispatchEvent(new CustomEvent("dropgrow:session-changed"));
      }
      agentHandle = handle;
      return {
        handle,
        ...(res.secret ? { secret: res.secret } : {}),
        message: res.secret
          ? `Account ready for @${handle}. Secret phrase (keep private, required to sign in from another device): ${res.secret}`
          : `Signed in as @${handle}. Token stored in this browser.`,
      };
    },
  });

  registerTool({
    name: "sign_in",
    description:
      "Resume the current drop&grow session using the token already stored in this browser. Use this to verify you are signed in as the authenticated user. To start fresh, use create_account first.",
    inputSchema: schema({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      const token = getToken();
      if (!token) return { error: "Not signed in. Run create_account first." };
      const { ConvexReactClient } = await import("convex/react");
      const { api } = await import("@convex/_generated/api");
      const client = new ConvexReactClient(
        (import.meta as { env?: Record<string, string> }).env?.VITE_CONVEX_URL ??
          "http://127.0.0.1:3210"
      );
      const res: any = await client.query(api.auth.me, { token });
      if (!res) return { error: "Invalid stored token. Run create_account to reset." };
      agentHandle = res.handle;
      return {
        handle: res.handle,
        name: res.name,
        message: `Signed in as @${res.handle}.`,
      };
    },
  });

  registerTool({
    name: "get_user",
    description:
      "Get the current user's info (handle, name, interests). Use this to verify you are signed in.",
    inputSchema: schema({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const { ConvexReactClient } = await import("convex/react");
      const { api } = await import("@convex/_generated/api");
      const client = new ConvexReactClient(
        (import.meta as { env?: Record<string, string> }).env?.VITE_CONVEX_URL ??
          "http://127.0.0.1:3210"
      );
      const res: any = await client.query(api.auth.me, { token });
      if (!res) return { error: "Invalid token" };
      return {
        handle: res.handle,
        name: res.name,
        interests: res.interests,
      };
    },
  });

  registerTool({
    name: "list_ideas",
    description:
      "Show the public ideas in the community, best scoring first. Each entry gives the idea text, how finished it is (score), its stage, and how many contributions it has.",
    inputSchema: schema({
      limit: { type: "number", description: "How many ideas to return (default 20)" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ limit = 20 }: { limit?: number }) => {
      const ideas: any[] = await convex.query(api.ideas.listIdeas, {
        visibility: "community",
        limit,
      });
      return {
        ideas: ideas.map((i) => ({
          id: i._id,
          input: i.input,
          score: i.fitness,
          stage: i.stage,
          contributions: i.contributionCount,
          branches: i.forkCount,
        })),
      };
    },
  });

  registerTool({
    name: "get_idea",
    description:
      "Look at one specific idea in detail: its full history (every contribution from people and agents), its health/likely success, and its current score and stage.",
    inputSchema: schema({
      id: { type: "string", description: "The idea's ID" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ id }: { id: string }) => {
      const res: any = await convex.query(api.ideas.getIdea, { ideaId: id as any });
      if (!res) return { error: "Idea not found" };
      const { idea, contributions, health } = res;
      return {
        id: idea._id,
        input: idea.input,
        contentKind: idea.contentKind,
        visibility: idea.visibility,
        stage: idea.stage,
        score: idea.fitness,
        author: idea.authorHandle,
        contributions: contributions.map((c: any) => ({
          type: c.contributorType,
          agent: c.agentRole,
          content: c.content.slice(0, 200),
          impact: c.impact,
        })),
        health: health
          ? {
              communityInterest: health.communityInterest,
              feasibility: health.feasibility,
              impactPotential: health.impactPotential,
              gaps: health.gaps,
              suggestions: health.suggestions,
            }
          : null,
      };
    },
  });

  registerTool({
    name: "list_my_ideas",
    description:
      "Show YOUR OWN ideas, including private ones only you can see. Use this to find ideas you created earlier, or to check on an idea before running agents, contributing, publishing, or finalizing it.",
    inputSchema: schema({
      limit: { type: "number", description: "How many ideas to return (default 20)" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ limit = 20 }: { limit?: number }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const ideas: any[] = await convex.query(api.ideas.listIdeas, {
        visibility: "personal",
        token,
        limit,
      });
      return {
        count: ideas.length,
        ideas: ideas.map((i) => ({
          id: i._id,
          input: i.input,
          score: i.fitness,
          stage: i.stage,
          contributions: i.contributionCount,
          branches: i.forkCount,
        })),
      };
    },
  });

  registerTool({
    name: "search_ideas",
    description:
      "Find public ideas that mention a word or phrase you search for. Returns the matching ideas with their scores.",
    inputSchema: schema({
      query: { type: "string", description: "The word or phrase to search for" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ query }: { query: string }) => {
      const ideas: any[] = await convex.query(api.ideas.listIdeas, {
        visibility: "community",
        limit: 100,
      });
      const q = query.toLowerCase();
      const matches = ideas.filter(
        (i) =>
          i.input.toLowerCase().includes(q) ||
          (i.content && i.content.toLowerCase().includes(q))
      );
      return {
        query,
        count: matches.length,
        ideas: matches.slice(0, 20).map((i) => ({
          id: i._id,
          input: i.input,
          score: i.fitness,
          stage: i.stage,
          contributions: i.contributionCount,
        })),
      };
    },
  });

  registerTool({
    name: "get_related_ideas",
    description:
      "Find other public ideas that are similar to or overlap with a given idea, ranked by how much they share. Useful for finding collaborators or neighbouring projects.",
    inputSchema: schema({
      id: { type: "string", description: "The idea's ID to find related ideas for" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ id }: { id: string }) => {
      const res: any[] = await convex.query(api.connections.listConnections, {
        ideaId: id as any,
      });
      return {
        count: res.length,
        related: res.map((s) => ({
          id: s.related._id,
          input: s.related.input,
          score: s.strength,
          reason: s.reason,
        })),
      };
    },
  });

  registerTool({
    name: "get_health",
    description:
      "Check how likely an idea is to succeed. Returns four scores (community interest, feasibility, impact, resources), plus what's missing and what to do next.",
    inputSchema: schema({
      id: { type: "string", description: "The idea's ID" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ id }: { id: string }) => {
      const res: any = await convex.query(api.ideas.getIdea, { ideaId: id as any });
      if (!res) return { error: "Idea not found" };
      const { health } = res;
      return health
        ? {
            communityInterest: health.communityInterest,
            feasibility: health.feasibility,
            impactPotential: health.impactPotential,
            resourceAvailability: health.resourceAvailability,
            gaps: health.gaps,
            suggestions: health.suggestions,
          }
        : { message: "No health data yet. Run refresh_health first." };
    },
  });

  registerTool({
    name: "create_idea",
    description:
      "Start a new idea in drop&grow. You can add it as plain text, a voice note, or an image. By default it's private; set visibility to 'community' to make it public.",
    inputSchema: schema({
      input: { type: "string", description: "The idea itself (required)" },
      contentKind: {
        type: "string",
        enum: ["text", "voice", "image"],
        description: "How the idea was captured (default text)",
      },
      visibility: {
        type: "string",
        enum: ["community", "personal"],
        description: "Public or private (default community)",
      },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({
      input,
      contentKind = "text",
      visibility = "community",
    }: {
      input: string;
      contentKind?: string;
      visibility?: string;
    }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in. Please sign in first." };
      const res: any = await convex.mutation(api.ideas.createIdea, {
        token,
        input,
        contentKind: contentKind as any,
        visibility: visibility as any,
      });
      return { id: res.ideaId, message: "Idea created and ready for agents" };
    },
  });

  registerTool({
    name: "run_agents",
    description:
      "Run the full agent pipeline on an idea. Six specialized agents (Nova/Research, Palette/Design, Quill/Content, Circuit/Tech, Apex/Strategy, Ledger/Budget) each contribute in sequence, then Planner synthesizes a final summary. Images are AI-enriched (vision description) before the agents process them; text and voice transcripts are used directly.",
    inputSchema: schema({
      id: { type: "string", description: "The idea's ID to work on" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.action(api.ideas.runAgentsLLM, {
        token,
        ideaId: id as any,
      });
      return {
        message: `Agents completed. ${res.contributed} contributions added.`,
        pipeline: [
          "Nova (research)",
          "Palette (design)",
          "Quill (content)",
          "Circuit (tech)",
          "Apex (strategy)",
          "Ledger (budget)",
          "Planner (synthesis)",
        ],
      };
    },
  });

  registerTool({
    name: "contribute",
    description:
      "Add your own human note to an idea. Your experience, a question, or a constraint. The agents read your note and respond to it the next time the idea is worked on.",
    inputSchema: schema({
      id: { type: "string", description: "The idea's ID" },
      content: { type: "string", description: "Your note. What you want to add." },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id, content }: { id: string; content: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      await convex.mutation(api.ideas.contribute, {
        token,
        ideaId: id as any,
        content,
      });
      return { message: "Contribution added" };
    },
  });

  registerTool({
    name: "branch_idea",
    description:
      "Create a branch from an existing idea with a new direction. The branch inherits 60% of the parent's score and grows independently.",
    inputSchema: schema({
      parentId: { type: "string", description: "The parent idea ID" },
      direction: { type: "string", description: "Why this branch? What's the new direction?" },
      input: { type: "string", description: "The new idea text" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({
      parentId,
      direction,
      input,
    }: {
      parentId: string;
      direction: string;
      input: string;
    }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.forkIdea, {
        token,
        parentIdeaId: parentId as any,
        input,
        description: direction,
      });
      return { id: res.childIdeaId, message: "Branch created" };
    },
  });

  registerTool({
    name: "find_connections",
    description:
      "Scan the community for ideas with overlapping vocabulary. Creates connection records with strength scores.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID to find connections for" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      await convex.mutation(api.connections.computeConnections, {
        token,
        ideaId: id as any,
      });
      return { message: "Connection scan complete" };
    },
  });

  registerTool({
    name: "refresh_health",
    description:
      "Recompute health metrics for an idea from live data: community interest, feasibility, impact, resources, gaps, and next steps.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.health.refreshHealth, {
        token,
        ideaId: id as any,
      });
      return {
        communityInterest: res.communityInterest,
        feasibility: res.feasibility,
        impactPotential: res.impactPotential,
        gaps: res.gaps,
        suggestions: res.suggestions,
      };
    },
  });

  registerTool({
    name: "publish_idea",
    description:
      "Publish a private idea to the community. Only the author can publish.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.publishToCommunity, {
        token,
        ideaId: id as any,
      });
      return { visibility: res.visibility, message: "Published to community" };
    },
  });

  registerTool({
    name: "make_idea_private",
    description:
      "Unpublish a community idea â€” move it back to personal so only you can see it. Only the author can do this.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.makePrivate, {
        token,
        ideaId: id as any,
      });
      return { visibility: res.visibility, message: "Idea is now private" };
    },
  });

  registerTool({
    name: "delete_idea",
    description:
      "Permanently delete an idea and its entire history (contributions, comments, health, branches, connections). Only the author can do this. Irreversible.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.deleteIdea, {
        token,
        ideaId: id as any,
      });
      return { deleted: res.deleted, message: "Idea deleted" };
    },
  });

  registerTool({
    name: "edit_idea",
    description:
      "Edit the text of an idea you own: rewrite the idea input itself (e.g. after the agents sharpen it, reflect a new direction). Only the author can edit. To add a note or comment instead, use add_comment.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
      input: { type: "string", description: "The new full text of the idea" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id, input }: { id: string; input: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.editIdea, {
        token,
        ideaId: id as any,
        input,
      });
      return { ok: res.ok, message: "Idea edited" };
    },
  });

  registerTool({
    name: "finalize_idea",
    description:
      "Mark an idea as finalized (mature). Only the author can finalize. Sets stage to mature and fitness to 100. Optionally attach proof of what came out of it: a link (a website, a repo), or a short text (the goal hit, the lesson learned).",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
      proof_type: {
        type: "string",
        enum: ["link", "text"],
        description: "Kind of proof attached (optional)",
      },
      proof_url: {
        type: "string",
        description: "The URL of the finished thing, when proof_type is 'link'",
      },
      proof_text: {
        type: "string",
        description: "The goal reached or lesson learned, when proof_type is 'text'",
      },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({
      id,
      proof_type,
      proof_url,
      proof_text,
    }: {
      id: string;
      proof_type?: string;
      proof_url?: string;
      proof_text?: string;
    }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.finalizeIdea, {
        token,
        ideaId: id as any,
        proofType: proof_type,
        proofUrl: proof_type === "link" ? proof_url : undefined,
        proofText: proof_type === "text" ? proof_text : undefined,
      });
      return { stage: res.stage, message: "Idea finalized" };
    },
  });

  registerTool({
    name: "mark_as_building",
    description:
      "Mark an idea as being built. Only available for ideas in hatching/growing stages. Moves it to building stage.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      const res: any = await convex.mutation(api.ideas.markAsBuilding, {
        token,
        ideaId: id as any,
      });
      return { stage: res.stage, message: "Idea is now being built" };
    },
  });

  registerTool({
    name: "add_comment",
    description:
      "Comment on any contribution (agent or human) in an idea's timeline. React, ask a question, add context, or push back on a point.",
    inputSchema: schema({
      contributionId: { type: "string", description: "The contribution ID to comment on" },
      content: { type: "string", description: "Your comment" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({
      contributionId,
      content,
    }: {
      contributionId: string;
      content: string;
    }) => {
      const token = getToken();
      if (!token) return { error: "Not signed in" };
      await convex.mutation(api.comments.add, {
        token,
        contributionId: contributionId as any,
        content,
      });
      return { message: "Comment added" };
    },
  });

  registerTool({
    name: "list_comments",
    description:
      "Read all comments on a specific contribution. Useful for understanding the discussion around a point.",
    inputSchema: schema({
      contributionId: { type: "string", description: "The contribution ID" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ contributionId }: { contributionId: string }) => {
      const comments: any[] = await convex.query(api.comments.listByContribution, {
        contributionId: contributionId as any,
      });
      return {
        count: comments.length,
        comments: comments.map((c) => ({
          author: c.authorHandle,
          content: c.content,
          time: c.createdAt,
        })),
      };
    },
  });

  registerTool({
    name: "list_idea_comments",
    description:
      "See which contributions on an idea have comments and how many. Returns a map of contribution IDs to comment counts.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ id }: { id: string }) => {
      const counts: Record<string, number> = await convex.query(
        api.comments.listByIdea,
        { ideaId: id as any }
      );
      const entries = Object.entries(counts);
      return {
        total: entries.length,
        contributions: entries.map(([contribId, count]) => ({
          contributionId: contribId,
          commentCount: count,
        })),
      };
    },
  });

  registerTool({
    name: "get_ai_insight",
    description:
      "Get an AI-enhanced insight for an idea using Cloudflare Workers AI (free tier). Returns a domain-specific suggestion.",
    inputSchema: schema({
      id: { type: "string", description: "The idea ID" },
    }),
    annotations: { readOnlyHint: true },
    execute: async ({ id }: { id: string }) => {
      const { enhanceInsight, isAIEnabled } = await import("./cloudflare-ai");
      if (!isAIEnabled()) {
        return {
          error:
            "Cloudflare AI not configured. Add VITE_CF_ACCOUNT_ID and VITE_CF_API_TOKEN to .env.local",
        };
      }
      const res: any = await convex.query(api.ideas.getIdea, { ideaId: id as any });
      if (!res) return { error: "Idea not found" };
      const { idea } = res;
      const insight = await enhanceInsight("community", idea.input);
      return insight
        ? { insight, source: "Cloudflare Workers AI (Llama 3.2-1B)" }
        : { error: "AI unavailable. Try again later." };
    },
  });

  registerTool({
    name: "navigate",
    description:
      "Switch the live browser to another page in drop&grow, exactly as a human clicking the nav would. Routes: 'home' or 'overview' (Landing), 'workspace' or 'my_ideas' (My ideas), 'community' (Community), plus 'terms'/'privacy'. After navigating, call get_page to re-read the new page's sections and clickable elements. Use open_idea to open a specific idea's page.",
    inputSchema: schema({
      route: {
        type: "string",
        description:
          "One of: home, overview, workspace, my_ideas, community, terms, privacy, or a raw path like '/i/<id>'.",
      },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ route }: { route: string }) => {
      return emitUI({ action: "navigate", route });
    },
  });

  registerTool({
    name: "open_idea",
    description:
      "Open a specific idea's detail page in the browser, scrolling to it so a human watching sees the full timeline, contributors, and health.",
    inputSchema: schema({
      id: { type: "string", description: "The idea's ID to open" },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ id }: { id: string }) => {
      return emitUI({ action: "open_idea", ideaId: id });
    },
  });

  registerTool({
    name: "scroll",
    description:
      "Scroll the live browser page. Two ways: (1) move gradually with a direction ('top', 'bottom', 'up', 'down') plus an amount px (default 300); or (2) jump straight to a named section â€” use the exact title from get_page's sections list, e.g. 'Your private ideas', 'step 1 Â· run the agents', 'how healthy is this idea?', or a data-tour name / element id like 'contribute-section'. Prefer a named section target so the browser lands on that exact part of the page for the human watching. After scrolling, call get_page to confirm what is now in view.",
    inputSchema: schema({
      direction: {
        type: "string",
        enum: ["up", "down", "top", "bottom"],
        description: "Which way to scroll (default down).",
      },
      amount: {
        type: "number",
        description: "Pixels to scroll for up/down (default 300).",
      },
      selector: {
        type: "string",
        description:
          "A section title from get_page (e.g. 'Your private ideas'), a data-tour name (e.g. 'composer'), or an element id (e.g. 'contribute-section') to scroll straight to.",
      },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({
      direction,
      amount = 300,
      selector,
    }: {
      direction?: "up" | "down" | "top" | "bottom";
      amount?: number;
      selector?: string;
    }) => {
      if (selector) return emitUI({ action: "scroll", direction, amount, selector });
      return emitUI({ action: "scroll", direction, amount });
    },
  });

  registerTool({
    name: "click",
    description:
      "Click a button, link, or interactive element in the live browser. Pass the button's visible text (e.g. 'Run agents', 'Publish', 'Community') or a stable CSS selector from get_page. Use get_page first to see what's clickable on the current page.",
    inputSchema: schema({
      selector: {
        type: "string",
        description:
          "Visible text of the element to click, or a CSS selector like '[data-tour=\"composer\"]'.",
      },
    }),
    annotations: { readOnlyHint: false },
    execute: async ({ selector }: { selector: string }) => {
      return emitUI({ action: "click", selector });
    },
  });

  registerTool({
    name: "get_page",
    description:
      "Read what the browser is currently showing. Returns the URL, the page's named sections (titles you can pass straight to scroll, e.g. 'Your private ideas'), and every clickable element (buttons, links, inputs) with a selector you can pass to click. Call this after navigate or scroll to stay oriented and to learn what you can click or scroll to. Note: long text shown in the browser is truncated in the UI; read full content with get_idea / list_ideas instead.",
    inputSchema: schema({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      return emitUI({ action: "get_page" });
    },
  });

  registerTool({
    name: "start_tour",
    description:
      "Launch the guided tour of drop&grow in the browser. The tour walks through dropping an idea, the eight input types, the six agents, and the community. Humans and agents can both use it to learn the app. Harmless, read-only guidance.",
    inputSchema: schema({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      emitTour("start");
      return {
        message:
          "Tour started. The browser is now highlighting each part of drop&grow in order; you (or a human) can skip it at any time with the Skip button or Escape.",
      };
    },
  });

  registerTool({
    name: "skip_tour",
    description:
      "Dismiss or skip the guided tour immediately if it is open. Lets an agent avoid walking a human through onboarding when it is not needed.",
    inputSchema: schema({}),
    annotations: { readOnlyHint: false },
    execute: async () => {
      emitTour("skip");
      return { message: "Tour dismissed." };
    },
  });

  // Autonomy manifest: lets any agent discover everything this site lets it do,
  // then drive the full flow itself once the human has enabled it.
  registerTool({
    name: "capabilities",
    description:
      "Read drop&grow's own instruction manual: what this site is, what kinds of actions an agent can take, the exact tools that exist, what each changes, and the recommended end-to-end loop. Call this first when you arrive. It tells you what is possible — not a fixed script — so you can run the flow autonomously once a human has enabled you.",
    inputSchema: schema({}),
    annotations: { readOnlyHint: true },
    execute: async () => {
      return {
        name: "drop&grow",
        what_it_is:
          "An agent-native idea space. Humans and agents create together: you drop an idea (text/voice/image), six specialized agents develop it, humans add real-world notes, and agents react to them. Ideas grow through a lifecycle and can be forked, published, or finalized with proof.",
        agencies: [
          "You can act exactly like a signed-in human: create accounts, sign in, drop ideas, read ideas, run the agent pipeline, contribute notes to any idea (including other people's public ideas), comment, fork, publish, delete, finalize with proof.",
          "You can also drive the browser itself: navigate between pages, open an idea, scroll, and click real buttons — read the current page to know what is on screen before acting.",
        ],
        tools: [
          "identity: create_account, sign_in, get_user",
          "ideas: create_idea, get_idea, list_ideas, list_my_ideas, search_ideas",
          "grow: run_agents, contribute, branch_idea",
          "lifecycle: publish_idea, make_idea_private, delete_idea, finalize_idea, mark_as_building",
          "insight: get_health, refresh_health, find_connections, get_related_ideas, get_ai_insight",
          "browser: navigate, open_idea, scroll, click, get_page",
          "tour: start_tour, skip_tour",
        ],
        recommended_end_to_end_loop:
          "sign_in (or create_account) -> get_user to confirm identity -> create_idea (private) -> run_agents to develop it -> get_idea to read the result -> contribute a human-style note -> run_agents again to show agents reacting -> buse the browser (navigate / open_idea / scroll / click) to move through the UI -> branch_idea to fork a direction -> finalize_idea to close the loop -> get_health for the dashboard -> search_ideas and start_tour to show breadth. Time-box each action; do not retry a call that errors or rate-limits — skip it and continue.",
        guidance:
          "A human has given you permission to act. Proceed autonomously through the flow. Pause briefly after each visible result so a person can read it on screen. Never ask a question or block waiting for input. Never loop on a failed call.",
      };
    },
  });
}
