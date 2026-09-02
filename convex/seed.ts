import { internalMutation, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { runPipeline } from "./agents/engine";
import type { AgentRole } from "./agents/engine";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Seed data â€” creates realistic community content for testing.
 * Run with: npx convex run seed:run '{}'
 *
 * Creates 6 users, several community ideas across content kinds,
 * pre-runs the agents, adds human notes, sets health, makes a branch,
 * and recomputes connections.
 */

interface SeedAttrs {
  handle: string;
  name: string;
  interests?: string[];
}

const USERS: SeedAttrs[] = [
  { handle: "sarah_j", name: "Sarah James", interests: ["community", "food", "urban"] },
  { handle: "mike_r", name: "Mike Reyes", interests: ["tech", "music", "startups"] },
  { handle: "linda_h", name: "Linda Huang", interests: ["education", "ai"] },
  { handle: "tom_c", name: "Tom Callahan", interests: ["environment", "sustainability"] },
];

interface SeedIdea {
  input: string;
  contentKind: "text" | "voice" | "image";
  authorHandle: string;
  visibility: "community" | "personal";
  humanNotes?: string[];
}

const IDEAS: SeedIdea[] = [
  {
    input: "Turn the empty lot behind the library into a community garden. Families get plots, kids do workshops on weekends, we do a harvest party end of summer.",
    contentKind: "text",
    authorHandle: "sarah_j",
    visibility: "community",
    humanNotes: [
      "The city already said we can use the lot, just need to formalize it.",
      "Neighbourhood email list is split on who waters in July and August.",
      "Lincoln Elementary wants in for the kids programming.",
    ],
  },
  {
    input: "Build a music streaming app where local artists actually get paid. Like Spotify but 90/10 split instead of 70/30, and there's a tip jar on every track.",
    contentKind: "text",
    authorHandle: "mike_r",
    visibility: "community",
    humanNotes: [
      "I know three bands in town who would upload their stuff tomorrow if this existed.",
      "Also need a local gig calendar so people can actually go see them live.",
    ],
  },
  {
    input: "App that takes your lecture notes and auto-generates quiz questions and flashcards from them. Record the lecture, it transcribes, then builds study material.",
    contentKind: "voice",
    authorHandle: "linda_h",
    visibility: "community",
    humanNotes: [
      "Students keep asking me if there's a tool for this. There isn't a good one.",
      "Big worry: it makes up facts. Need some kind of verification step before it quizzes you.",
    ],
  },
  {
    input: "Monthly repair cafe at the community centre. People bring broken stuff, volunteers fix it together. Like a swap meet but for broken toasters.",
    contentKind: "image",
    authorHandle: "tom_c",
    visibility: "community",
    humanNotes: [
      "Hardware store on 5th said they'll donate tools.",
      "Last month I fixed my own toaster at one of these in Toronto. Changed my life.",
    ],
  },
];

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "have",
  "want", "into", "about", "over", "under", "more", "will", "would",
  "could", "should", "their", "there", "what", "when", "where", "which",
  "community", "project", "idea", "build", "make", "start", "new", "like",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function stageFor(count: number): "seed" | "hatching" | "growing" {
  if (count <= 1) return "seed";
  if (count <= 4) return "hatching";
  return "growing";
}

export const run = internalMutation({
  handler: async (ctx) => {
    const db = ctx.db;

    const userIds = new Map<string, Id<"users">>();
    for (const u of USERS) {
      const existing = await db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", u.handle))
        .first();
      if (existing) {
        userIds.set(u.handle, existing._id);
        continue;
      }
      const id = await db.insert("users", {
        name: u.name,
        handle: u.handle,
        interests: u.interests ?? [],
        joinedAt: Date.now() - (USERS.indexOf(u) + 1) * 86400000,
      });
      userIds.set(u.handle, id);
    }

    const ideaIds: Id<"ideas">[] = [];

    for (const seedIdea of IDEAS) {
      const authorId = userIds.get(seedIdea.authorHandle);
      if (!authorId) continue;

      const existing = await db
        .query("ideas")
        .filter((q) =>
          q.and(q.eq(q.field("authorId"), authorId), q.eq(q.field("input"), seedIdea.input))
        )
        .first();

      if (existing) {
        ideaIds.push(existing._id);
        continue;
      }

      const ideaId = await db.insert("ideas", {
        input: seedIdea.input,
        contentKind: seedIdea.contentKind,
        authorId,
        authorHandle: seedIdea.authorHandle,
        authorType: "human",
        visibility: seedIdea.visibility,
        fitness: 0,
        stage: "seed",
        contributorRoles: [],
        contributionCount: 0,
        forkCount: 0,
      });
      ideaIds.push(ideaId);

      await db.insert("contributions", {
        ideaId,
        mutationKind: "seed",
        contributorType: "human",
        contributorId: authorId,
        contributorHandle: seedIdea.authorHandle,
        agentRole: undefined,
        content: seedIdea.input,
        impact: 10,
      });

      for (const note of seedIdea.humanNotes ?? []) {
        await db.insert("contributions", {
          ideaId,
          mutationKind: "wisdom",
          contributorType: "human",
          contributorId: authorId,
          contributorHandle: seedIdea.authorHandle,
          agentRole: undefined,
          content: note,
          impact: 8,
        });
      }

      const humanCount = 1 + (seedIdea.humanNotes?.length ?? 0);
      const prior: { agentRole: AgentRole | null; contributorHandle: string; content: string }[] = [
        { agentRole: null, contributorHandle: seedIdea.authorHandle, content: seedIdea.input },
        ...(seedIdea.humanNotes ?? []).map((n) => ({
          agentRole: null as null,
          contributorHandle: seedIdea.authorHandle,
          content: n,
        })),
      ];

      const outputs = runPipeline(
        {
          ideaId,
          input: seedIdea.input,
          contentKind: seedIdea.contentKind,
          authorHandle: seedIdea.authorHandle,
          stage: "seed",
          visibility: seedIdea.visibility,
          humanContributions: humanCount,
          agentContributions: 0,
        },
        prior,
      );

      for (const out of outputs) {
        await db.insert("contributions", {
          ideaId,
          mutationKind: out.role,
          contributorType: "agent",
          contributorId: null,
          contributorHandle: out.role,
          agentRole: out.role,
          content: out.content,
          impact: out.impact,
        });
      }

      const totalCount = humanCount + outputs.length;
      const roles = outputs.map((o) => o.role);
      const totalImpact = outputs.reduce((a, o) => a + o.impact, 0);
      await db.patch(ideaId, {
        contributionCount: totalCount,
        stage: stageFor(totalCount),
        contributorRoles: roles,
        fitness: Math.min(100, 20 + totalImpact),
      });

      const isCommunity = seedIdea.visibility === "community";
      await db.insert("health", {
        ideaId,
        communityInterest: isCommunity ? 40 + (ideaIds.length % 4) * 10 : 0,
        feasibility: 50 + (ideaIds.length % 5) * 8,
        impactPotential: 60 + (ideaIds.length % 3) * 10,
        resourceAvailability: 30 + (ideaIds.length % 6) * 8,
        gaps: isCommunity
          ? ["User testing", "Founding scope", "First pilot"]
          : ["Confirm scope"],
        suggestions: isCommunity
          ? ["Run a first survey", "Recruit founding members", "Build an MVP"]
          : ["Keep building privately"],
      });
    }

    // create a branch from the music idea
    const musicParent = ideaIds.length > 1 ? await db.get(ideaIds[1]) : null;
    const mikeId = userIds.get("mike_r");
    if (musicParent && mikeId) {
      const childId = await db.insert("ideas", {
        input: "A local music platform focused purely on the tip jar and hyper-local gig promotion",
        contentKind: "text",
        authorId: mikeId,
        authorHandle: "mike_r",
        authorType: "human",
        visibility: "community",
        fitness: Math.round(musicParent.fitness * 0.6),
        stage: "seed",
        contributorRoles: [],
        contributionCount: 1,
        forkCount: 0,
      });
      await db.insert("contributions", {
        ideaId: childId,
        mutationKind: "seed",
        contributorType: "human",
        contributorId: mikeId,
        contributorHandle: "mike_r",
        agentRole: undefined,
        content: "A local music platform focused purely on the tip jar and hyper-local gig promotion",
        impact: 10,
      });
      await db.insert("forks", {
        parentIdeaId: musicParent._id,
        childIdeaId: childId,
        description: "Doubling down on the tip jar concept",
        forkedByHandle: "mike_r",
      });
      await db.patch(musicParent._id, { forkCount: musicParent.forkCount + 1 });
    }

    // recompute connections between community ideas
    const communityIdeas = await db
      .query("ideas")
      .withIndex("by_visibility", (q) => q.eq("visibility", "community"))
      .take(60);
    for (const idea of communityIdeas) {
      for (const other of communityIdeas) {
        if (other._id === idea._id) continue;
        const ta = new Set(tokenize(idea.input));
        const tb = new Set(tokenize(other.input));
        const shared = [...ta].filter((t) => tb.has(t));
        if (shared.length === 0) continue;
        const union = new Set([...ta, ...tb]);
        const jaccard = shared.length / union.size;
        const strength = Math.round(Math.min(95, jaccard * 200 + Math.min(shared.length, 4) * 5));
        if (strength < 30) continue;
        const reason = `Shared focus: ${shared.slice(0, 3).join(", ")}`;
        const existing = await db
          .query("connections")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .filter((q) => q.eq(q.field("relatedIdeaId"), other._id))
          .first();
        if (existing) {
          await db.patch(existing._id, { strength, reason });
        } else {
          await db.insert("connections", {
            ideaId: idea._id,
            relatedIdeaId: other._id,
            strength,
            reason,
          });
        }
      }
    }

    return {
      users: USERS.length,
      ideasSeed: IDEAS.length,
      ideasTotal: communityIdeas.length,
      message: "Seed data created. Open /community to see it.",
    };
  },
});

/**
 * Fix stale stage values after the "branching" â†’ "building" rename.
 * Run with: npx convex run seed:migrateStages '{}'
 */
export const migrateStages = internalMutation({
  handler: async (ctx) => {
    const db = ctx.db;
    let fixed = 0;
    for await (const idea of db.query("ideas")) {
      if ((idea as any).stage === "branching") {
        await db.patch(idea._id, { stage: "building" });
        fixed++;
      }
    }
    return { fixed };
  },
});

/**
 * Clear all data and re-seed from scratch.
 * Run with: npx convex run seed:resetAndReseed '{}'
 */
export const resetAndReseed = internalMutation({
  handler: async (ctx) => {
    const db = ctx.db;

    for await (const c of db.query("contributions")) await db.delete(c._id);
    for await (const h of db.query("health")) await db.delete(h._id);
    for await (const f of db.query("forks")) await db.delete(f._id);
    for await (const c of db.query("connections")) await db.delete(c._id);
    for await (const i of db.query("ideas")) await db.delete(i._id);
    for await (const u of db.query("users")) await db.delete(u._id);

    return { cleared: true };
  },
});

/**
 * Create the demo user (handle: test_user) with full sample data across all
 * stages and content kinds. Runs on a fresh DB â€” creates the single test_user.
 * Returns a raw token for immediate sign-in.
 * Run with: npx convex run seed:createDemoUser '{}'
 */
export const createDemoUser = mutation({
  args: {},
  handler: async (ctx) => {
    const db = ctx.db;

    const handle = "test_user";
    const name = "Test User";
    const interests = ["community", "media", "web"];
    const demoSecret = "dropgrow-demo-2026";

    // Create the single test_user account (fresh DB â€” no prior state).
    const userId = await db.insert("users", {
      name,
      handle,
      interests,
      secretHash: await sha256(demoSecret),
      joinedAt: Date.now(),
    });

    // Create session
    const token = randomToken();
    const hash = await sha256(token);
    await db.insert("sessions", {
      tokenHash: hash,
      userId,
      createdAt: Date.now(),
      ip: "demo",
    });

    // --- DEMO IDEAS ACROSS STAGES AND KINDS (4 ideas) ---

    // 1. MATURE â€” text â€” community garden (25+ contributions, fitness 92)
    const idea1 = await db.insert("ideas", {
      input: "Community garden on the empty lot behind the library. Raised beds, composting station, tool shed. Open to anyone in the neighbourhood.",
      contentKind: "text",
      authorId: userId,
      authorHandle: "test_user",
      authorType: "human",
      visibility: "community",
      fitness: 92,
      stage: "mature",
      contributorRoles: ["research", "design", "content", "tech", "strategy", "budget", "community"],
      contributionCount: 26,
      forkCount: 0,
    });

    // 2. BUILDING â€” text â€” open source standup bot (15 contributions, fitness 75)
    const idea2 = await db.insert("ideas", {
      input: "Open-source tool for remote team standup bots. Slack and Discord integration. Async-first with timezone awareness.",
      contentKind: "text",
      authorId: userId,
      authorHandle: "test_user",
      authorType: "human",
      visibility: "community",
      fitness: 75,
      stage: "building",
      contributorRoles: ["research", "design", "content", "tech", "strategy", "budget"],
      contributionCount: 15,
      forkCount: 0,
    });

    // 3. GROWING â€” voice â€” walking meditation app (8 contributions, fitness 55)
    const idea3 = await db.insert("ideas", {
      input: "Walking meditation app for city parks. GPS triggers audio cues at specific spots. No screen, just headphones and walk.",
      contentKind: "voice",
      authorId: userId,
      authorHandle: "test_user",
      authorType: "human",
      visibility: "community",
      fitness: 55,
      stage: "growing",
      contributorRoles: ["research", "design", "content", "tech"],
      contributionCount: 8,
      forkCount: 0,
    });

    // 4. HATCHING â€” image â€” repair cafe (3 contributions, fitness 30)
    const idea4 = await db.insert("ideas", {
      input: "Monthly repair cafe at the community centre. People bring broken stuff, volunteers fix it together. Like a swap meet but for broken toasters.",
      contentKind: "image",
      authorId: userId,
      authorHandle: "test_user",
      authorType: "human",
      visibility: "community",
      fitness: 30,
      stage: "hatching",
      contributorRoles: ["research", "design"],
      contributionCount: 3,
      forkCount: 0,
    });

    // --- CONTRIBUTIONS (agents + human notes) ---

    const agentImpact: Record<string, number> = {
      research: 7, design: 6, content: 5, tech: 6, strategy: 6, budget: 5, community: 10,
    };

    async function addContributions(
      ideaId: Id<"ideas">,
      kinds: Array<{ kind: string; role?: AgentRole; human?: boolean; content: string }>,
    ) {
      for (const c of kinds) {
        await db.insert("contributions", {
          ideaId,
          mutationKind: c.kind as any,
          contributorType: c.human ? "human" : "agent",
          contributorId: c.human ? userId : null,
          contributorHandle: c.human ? "test_user" : (c.role ?? "agent"),
          agentRole: c.human ? undefined : (c.role as AgentRole),
          content: c.content,
          impact: c.human ? 8 : (agentImpact[c.kind] ?? 5),
        });
      }
    }

    // Idea 1 (mature) â€” full pipeline + human notes + extras
    await addContributions(idea1, [
      { kind: "seed", human: true, content: "Community garden on the empty lot behind the library. Raised beds, composting station, tool shed. Open to anyone in the neighbourhood." },
      { kind: "research", role: "research", content: "Community gardens increase property values 3-5% and reduce food insecurity. 78% of urban residents want more green space. Existing models in Toronto and Vancouver show 60% participant retention after year one." },
      { kind: "design", role: "design", content: "Natural wood raised beds with painted markers. Compost bins painted in neighbourhood colours. Signage: chalkboard style with daily updates. Tool shed as a tiny library aesthetic." },
      { kind: "content", role: "content", content: "Name: The Growing Lot. Tagline: Grow together. Social accounts: share weekly harvest photos, planting tips, volunteer spotlights." },
      { kind: "tech", role: "tech", content: "Simple website with plot map, planting calendar (Google Calendar embed), volunteer signup form (Google Forms), and weather alerts (OpenWeatherMap API). No app needed." },
      { kind: "strategy", role: "strategy", content: "Month 1: Secure lot, clean up. Month 2: Build beds, first planting. Month 3: Grand opening event. Month 6: First harvest share. Year 1 goal: 20 active gardeners." },
      { kind: "budget", role: "budget", content: "Startup: $2,400 (lumber, soil, tools, shed). Monthly: $200 (water, seeds, compost). Funding: hardware store sponsorship, community fundraiser, city green grant ($1,500 available)." },
      { kind: "wisdom", human: true, content: "The lot owner is the city parks department. Already talked to them â€” they'll lease it for $1/year if we handle insurance. Need a group of 5 to sign the lease." },
      { kind: "wisdom", human: true, content: "I ran a community garden in Toronto for 3 years. Key lesson: start small (10 beds max) and expand only after you have a core team of 8-10 reliable people." },
      { kind: "wisdom", human: true, content: "The library next door said they'll promote it and let us use their water tap. They want to do a 'seed library' tie-in too." },
      { kind: "community", role: "community", content: "Final direction: Start with 12 raised beds, $2,400 startup from hardware store sponsorship + city grant. Launch event in 8 weeks. Library partnership for cross-promotion. 20 gardeners target by summer." },
      { kind: "research", role: "research", content: "Added: Local schools expressed interest in field trips. Educational programming could unlock additional grant funding from the provincial education fund." },
      { kind: "design", role: "design", content: "Added: Accessibility-first layout â€” raised beds at wheelchair height, wide pathways, Braille plant markers. Sensory garden section for visually impaired visitors." },
      { kind: "content", role: "content", content: "Added: Weekly newsletter via Substack. Photo contest each month. 'Grow of the Week' social media feature." },
      { kind: "tech", role: "tech", content: "Added: Shared Google Sheet for plot assignments. WhatsApp group for real-time coordination. QR codes on beds linking to planting guides." },
      { kind: "strategy", role: "strategy", content: "Added: Phase 2 (year 2) â€” add greenhouse, start seedling program for neighbourhood. Phase 3 (year 3) â€” partner with local restaurants for 'garden-to-table' events." },
      { kind: "budget", role: "budget", content: "Added: Revenue potential â€” sell excess produce at farmers market ($50-100/week in season). Herb bundles to local cafes ($20/week). Workshop fees ($10/person, 2x/month)." },
      { kind: "wisdom", human: true, content: "Insurance is $400/year through the city's community program. Need 3 people on the lease committee." },
      { kind: "wisdom", human: true, content: "Neighbourhood Facebook group has 2,000 members. Already posted about it â€” 47 likes and 12 comments of interest." },
      { kind: "wisdom", human: true, content: "The community centre has a commercial kitchen we could use for cooking workshops with the produce. They want $0 rental if we bring the audience." },
    ]);

    // Idea 2 (building) â€” full pipeline
    await addContributions(idea2, [
      { kind: "seed", human: true, content: "Open-source tool for remote team standup bots. Slack and Discord integration. Async-first with timezone awareness." },
      { kind: "research", role: "research", content: "Standup bots market: $120M annually. Top competitors charge $3-8/user/month. Pain point: timezone hell in distributed teams. 67% of remote workers say async standups are better than meetings." },
      { kind: "design", role: "design", content: "Minimal bot interface. Slash commands for check-ins. Thread-based responses. Dashboard shows team status at a glance. Dark mode by default for developer audience." },
      { kind: "content", role: "content", content: "Name: Standby. Tagline: Stand up, async. Positioning: the open-source alternative to Geekbot and Standuply." },
      { kind: "tech", role: "tech", content: "Stack: Node.js/TypeScript, Slack Bolt SDK, Discord.js, PostgreSQL for state, Redis for scheduling. Deploy: Docker, one-click Railway/Fly.io deploy." },
      { kind: "strategy", role: "strategy", content: "Month 1-2: MVP with Slack. Month 3: Discord support. Month 4-6: Dashboard, analytics. Goal: 100 teams in first 6 months." },
      { kind: "budget", role: "budget", content: "Hosting: $20/mo (Railway). Domain: $12/year. Revenue: SaaS tier for teams >20 ($5/team/month). Free for small teams. Sponsorship potential from dev tools companies." },
      { kind: "wisdom", human: true, content: "I've been building internal tools for 5 years. The real problem isn't the standup â€” it's the follow-through. Need action items that surface in the next standup." },
      { kind: "wisdom", human: true, content: "We tried Geekbot at my last company. 40% of the team stopped responding after 2 weeks. The bot needs to be fun, not just functional." },
      { kind: "community", role: "community", content: "Direction: Open-source Slack+Discord bot with async standups, timezone smarts, and action item tracking. Free tier for small teams, $5/team/month for 20+. Ship MVP in 8 weeks." },
    ]);

    // Idea 3 (growing) â€” partial pipeline
    await addContributions(idea3, [
      { kind: "seed", human: true, content: "Walking meditation app for city parks. GPS triggers audio cues at specific spots. No screen, just headphones and walk." },
      { kind: "research", role: "research", content: "Walking meditation reduces cortisol by 15%. Meditation app market: $4B. Gap: no app combines GPS-triggered audio with walking. Nature sounds + guided walks outperform studio meditation." },
      { kind: "design", role: "design", content: "No UI needed during the walk. Pre-walk setup: choose park, set duration, pick voice. Audio: gentle chime at checkpoints, ambient nature sounds, soft voice prompts." },
      { kind: "content", role: "content", content: "Name: Stride. Tagline: Walk and breathe. Content: 10 pilot routes in city parks, 5-20 minutes each." },
      { kind: "tech", role: "tech", content: "React Native for cross-platform. GPS geofencing with 20m radius triggers. Offline mode with pre-downloaded audio. Low battery: batch GPS checks every 30s." },
      { kind: "wisdom", human: true, content: "Tested the concept in High Park last month with 5 friends. Everyone loved it. The key was the surprise â€” you don't know what's coming next at each spot." },
      { kind: "wisdom", human: true, content: "Parks department is interested. They want to add QR codes at scenic spots that link to the app routes." },
    ]);

    // Idea 4 (hatching) â€” partial pipeline
    await addContributions(idea4, [
      { kind: "seed", human: true, content: "Monthly repair cafe at the community centre. People bring broken stuff, volunteers fix it together. Like a swap meet but for broken toasters." },
      { kind: "research", role: "research", content: "Repair cafes prevent 70% of items from reaching landfill. 200+ active repair cafes worldwide. Average event fixes 15-20 items. Community building side effect: 3x more neighbour interactions." },
      { kind: "design", role: "design", content: "Workshop layout: 6 repair stations (electronics, textiles, furniture, bikes, small appliances, general). Signage with tool icons. 'Fixed' stickers for repaired items." },
      { kind: "wisdom", human: true, content: "Hardware store on 5th said they'll donate tools. Last month I fixed my own toaster at one of these in Toronto. Changed my life." },
    ]);

    // --- HEALTH METRICS ---
    const healthData = [
      { ideaId: idea1, ci: 92, fe: 85, ip: 88, ra: 78, gaps: ["Insurance setup", "Volunteer recruitment timeline"], suggestions: ["Partner with library for cross-promotion", "Launch with a planting day event"] },
      { ideaId: idea2, ci: 78, fe: 90, ip: 72, ra: 82, gaps: ["Discord integration not started", "Need more beta testers"], suggestions: ["Ship Slack MVP first", "Add Discord in month 3", "Target dev communities on Twitter"] },
      { ideaId: idea3, ci: 65, fe: 70, ip: 75, ra: 60, gaps: ["No GPS trigger library exists yet", "Battery optimization needed"], suggestions: ["Start with 3 pilot routes", "Test with 20 users", "Iterate on audio quality"] },
      { ideaId: idea4, ci: 55, fe: 80, ip: 60, ra: 70, gaps: ["Need 6+ skilled volunteers", "Tool inventory unclear"], suggestions: ["Start with 3 stations", "Host first event as a trial", "Partner with hardware store"] },
    ];
    for (const h of healthData) {
      await db.insert("health", {
        ideaId: h.ideaId,
        communityInterest: h.ci,
        feasibility: h.fe,
        impactPotential: h.ip,
        resourceAvailability: h.ra,
        gaps: h.gaps,
        suggestions: h.suggestions,
      });
    }

    // --- COMMENTS on contributions ---
    // Get some contributions from idea1 to comment on
    const idea1Contribs = await db
      .query("contributions")
      .filter((q) => q.eq(q.field("ideaId"), idea1))
      .take(5);

    if (idea1Contribs.length >= 2) {
      await db.insert("comments", {
        contributionId: idea1Contribs[1]._id, // research contribution
        authorId: userId,
        authorHandle: "test_user",
        content: "This is really solid research. The 3-5% property value increase is a strong selling point for the neighbourhood association.",
        createdAt: Date.now() - 86400000 * 3,
      });
      await db.insert("comments", {
        contributionId: idea1Contribs[2]._id, // design contribution
        authorId: userId,
        authorHandle: "test_user",
        content: "Love the chalkboard signage idea. Could we add a 'wish list' section where people request specific plants?",
        createdAt: Date.now() - 86400000 * 2,
      });
      await db.insert("comments", {
        contributionId: idea1Contribs[4]._id, // human wisdom
        authorId: userId,
        authorHandle: "test_user",
        content: "The Toronto experience is exactly what we need. Would you be willing to advise the lease committee?",
        createdAt: Date.now() - 86400000,
      });
    }

    // Comment on idea2 contributions
    const idea2Contribs = await db
      .query("contributions")
      .filter((q) => q.eq(q.field("ideaId"), idea2))
      .take(5);

    if (idea2Contribs.length >= 2) {
      await db.insert("comments", {
        contributionId: idea2Contribs[3]._id, // human wisdom
        authorId: userId,
        authorHandle: "test_user",
        content: "The action item tracking is the killer feature. That's what all the other bots miss.",
        createdAt: Date.now() - 86400000 * 4,
      });
    }

    return {
      userId,
      token,
      handle: "test_user",
      name: "Test User",
      ideas: 4,
      message: "Demo user created. Set localStorage 'dropgrow.token' to the token value, then reload.",
    };
  },
});

/**
 * Seed a single text idea for a test user, with the full agent pipeline.
 * Re-runnable â€” if the idea already exists, its history is reset so the demo
 * always shows current-generation agent output.
 * Run with: npx convex run seed:textIdea '{}'
 */
export const textIdea = internalMutation({
  handler: async (ctx) => {
    const db = ctx.db;
    const handle = "test_user";
    const name = "Test User";
    const demoSecret = "dropgrow-demo-2026";
    const input =
      "WebMCP home page for independent movie theatres. Each indie cinema exposes its showtimes, tickets, and special screenings as structured tools, so anyone's agent can browse, compare, and book a double feature across the district without visiting five websites.";

    // Upsert the test user.
    const existingUser = await db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();
    const userId = existingUser
      ? (await db.patch(existingUser._id, {
          secretHash: await sha256(demoSecret),
        }),
        existingUser._id)
      : await db.insert("users", {
          name,
          handle,
          interests: ["community", "media", "web"],
          secretHash: await sha256(demoSecret),
          joinedAt: Date.now(),
        });

    // If the idea already exists, reset its history so the demo shows fresh,
    // current-generation agent output on every re-seed.
    const existingIdea = await db
      .query("ideas")
      .filter((q) =>
        q.and(q.eq(q.field("authorId"), userId), q.eq(q.field("input"), input))
      )
      .first();
    const ideaId =
      existingIdea?._id ??
      (await db.insert("ideas", {
        input,
        contentKind: "text",
        authorId: userId,
        authorHandle: handle,
        authorType: "human",
        visibility: "community",
        fitness: 0,
        stage: "seed",
        contributorRoles: [],
        contributionCount: 0,
        forkCount: 0,
      }));

    if (existingIdea) {
      for await (const c of db.query("contributions").withIndex("by_idea", (q) => q.eq("ideaId", ideaId))) {
        await db.delete(c._id);
      }
      const oldHealth = await db.query("health").withIndex("by_idea", (q) => q.eq("ideaId", ideaId)).first();
      if (oldHealth) await db.delete(oldHealth._id);
    }

    await db.insert("contributions", {
      ideaId,
      mutationKind: "seed",
      contributorType: "human",
      contributorId: userId,
      contributorHandle: handle,
      agentRole: undefined,
      content: input,
      impact: 10,
    });

    const prior = [{ agentRole: null as null, contributorHandle: handle, content: input }];
    const outputs = runPipeline(
      {
        ideaId,
        input,
        contentKind: "text",
        authorHandle: handle,
        stage: "seed",
        visibility: "community",
        humanContributions: 1,
        agentContributions: 0,
      },
      prior,
    );

    for (const out of outputs) {
      await db.insert("contributions", {
        ideaId,
        mutationKind: out.role,
        contributorType: "agent",
        contributorId: null,
        contributorHandle: out.role,
        agentRole: out.role,
        content: out.content,
        impact: out.impact,
      });
    }

    const totalCount = 1 + outputs.length;
    const roles = outputs.map((o) => o.role);
    const totalImpact = outputs.reduce((a, o) => a + o.impact, 0);
    await db.patch(ideaId, {
      contributionCount: totalCount,
      stage: stageFor(totalCount),
      contributorRoles: roles,
      fitness: Math.min(100, 20 + totalImpact),
    });

    await db.insert("health", {
      ideaId,
      communityInterest: 70,
      feasibility: 65,
      impactPotential: 85,
      resourceAvailability: 45,
      gaps: ["Partner cinemas", "First pilot venue", "Ticket verification flow"],
      suggestions: [
        "Recruit one indie cinema to pilot",
        "Expose showtimes as read-only tools first",
        "Publish the WebMCP manifest you serve to agents",
      ],
    });

    return {
      idempotent: false,
      ideaId,
      userId,
      handle,
      contributions: totalCount,
      message: "Test user + text idea seeded with the full agent pipeline.",
    };
  },
});

/** Delete all data. Run with: npx convex run seed:clearAll '{}' */
export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const db = ctx.db;
    for await (const c of db.query("comments")) await db.delete(c._id);
    for await (const c of db.query("contributions")) await db.delete(c._id);
    for await (const h of db.query("health")) await db.delete(h._id);
    for await (const f of db.query("forks")) await db.delete(f._id);
    for await (const c of db.query("connections")) await db.delete(c._id);
    for await (const s of db.query("sessions")) await db.delete(s._id);
    for await (const i of db.query("ideas")) await db.delete(i._id);
    for await (const u of db.query("users")) await db.delete(u._id);
    return { cleared: true };
  },
});
