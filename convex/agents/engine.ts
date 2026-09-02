type AgentRole =
  | "research"
  | "design"
  | "content"
  | "tech"
  | "strategy"
  | "budget"
  | "community";

export type { AgentRole };

type IdeaStage = "seed" | "hatching" | "growing" | "building" | "mature";

/**
 * Agent engine — pure, deterministic contribution generator.
 * Six specialized agents process an idea, read existing contributions,
 * and build on them. Then the Planner compiles everything into one direction.
 *
 * Each agent has multiple response patterns and picks based on:
 * - The idea's content (keyword extraction)
 * - The idea's stage
 * - Prior contributions (agent-to-agent awareness)
 * - Whether humans have contributed
 *
 * Extension point: swap the content generators for real LLM calls later —
 * the orchestration (order, reaction, synthesis) stays identical.
 */

export interface ContributionCtx {
  ideaId: string;
  input: string;
  contentKind: string;
  authorHandle: string;
  stage: IdeaStage;
  visibility: "personal" | "community";
  prior: {
    agentRole: AgentRole | null;
    contributorHandle: string;
    content: string;
  }[];
  humanContributions: number;
  agentContributions: number;
}

export interface AgentOutput {
  role: AgentRole;
  content: string;
  impact: number;
}

export const AGENT_NAMES: Record<AgentRole, string> = {
  research: "Nova",
  design: "Palette",
  content: "Quill",
  tech: "Circuit",
  strategy: "Apex",
  budget: "Ledger",
  community: "Planner",
};

const TITLES: Record<AgentRole, string> = {
  research: "Research scan",
  design: "Design direction",
  content: "Content plan",
  tech: "Tech approach",
  strategy: "Action plan",
  budget: "Budget breakdown",
  community: "Overall plan",
};

function heading(role: AgentRole) {
  return `${AGENT_NAMES[role]} / ${TITLES[role]}`;
}

function snippet(input: string, max = 80): string {
  const clean = input.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

/** A short, natural topic phrase derived from the idea's own words. */
function topicPhrase(input: string): string {
  const keywords = extractKeywords(input);
  if (keywords.length === 0) return "this idea";
  const filler = keywords.length > 2 ? ", " : " and ";
  return keywords.slice(0, 3).join(filler);
}

/** Extract meaningful keywords from idea text, filtering common words. */
function extractKeywords(text: string): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "your", "have",
    "want", "into", "about", "over", "under", "more", "will", "would",
    "could", "should", "their", "there", "what", "when", "where", "which",
    "how", "can", "use", "make", "build", "create", "need", "like", "just",
    "also", "very", "some", "than", "them", "then", "these", "those",
    "not", "but", "are", "was", "were", "been", "being", "does", "did",
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w))
    .slice(0, 8);
}

/** Detect the idea's domain/category from keywords. */
function detectDomain(keywords: string[]): string {
  const tech = ["app", "software", "platform", "website", "api", "code", "data", "ai", "ml", "blockchain", "saas", "tool"];
  const creative = ["art", "design", "music", "video", "photo", "content", "story", "creative", "visual", "brand"];
  const event = ["event", "party", "potluck", "gathering", "meetup", "festival", "workshop", "cafe", "repair", "night", "weekly", "monthly", "annual", "celebration"];
  const food = ["food", "grocery", "garden", "cook", "recipe", "restaurant", "cafe", "organic", "waste", "compost", "vegetable", "harvest", "kitchen", "meal", "delivery"];
  const local = ["neighbourhood", "neighborhood", "community", "local", "park", "library", "centre", "center", "street", "block", "area", "district", "ville", "town"];
  const hobby = ["hobby", "sport", "game", "play", "craft", "walk", "meditation", "yoga", "bike", "run", "fitness", "wellness", "health", "outdoor", "nature"];
  const business = ["business", "market", "customer", "revenue", "price", "sell", "product", "service", "company"];
  const health = ["health", "wellness", "fitness", "mental", "medical", "care", "therapy", "mind"];
  const education = ["learn", "teach", "education", "school", "student", "course", "training", "skill"];
  const environment = ["environment", "climate", "sustain", "green", "eco", "renewable", "energy", "waste"];

  const domains = [
    { name: "tech", keywords: tech },
    { name: "creative", keywords: creative },
    { name: "event", keywords: event },
    { name: "food", keywords: food },
    { name: "local", keywords: local },
    { name: "hobby", keywords: hobby },
    { name: "business", keywords: business },
    { name: "health", keywords: health },
    { name: "education", keywords: education },
    { name: "environment", keywords: environment },
  ];
  const scores = Object.fromEntries(
    domains.map((d) => [
      d.name,
      keywords.filter((k) => d.keywords.some((t) => k.includes(t))).length,
    ])
  );

  const max = Math.max(...Object.values(scores));
  if (max === 0) return "general";
  return Object.entries(scores).find(([, v]) => v === max)?.[0] ?? "general";
}

function hasHumanWisdom(ctx: ContributionCtx) {
  return ctx.prior.some((p) => p.agentRole === null);
}

function priorHasRole(ctx: ContributionCtx, role: AgentRole): boolean {
  return ctx.prior.some((p) => p.agentRole === role);
}

function getHumanInput(ctx: ContributionCtx): string | null {
  return [...ctx.prior].reverse().find((p) => p.agentRole === null)?.content ?? null;
}

/* ------------------------- Research ------------------------ */

function research(ctx: ContributionCtx): string {
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);
  const reacted = priorHasRole(ctx, "research");

  const domainInsights: Record<string, string[]> = {
    tech: [
      "The developer tools space is crowded but the vertical-specific niches are underserved. Look at how Linear succeeded by going deep on issue tracking rather wide.",
      "Open-source alternatives exist for most tech products, but the managed/service layer is where willingness-to-pay clusters. Consider the Vercel vs self-hosted Next.js dynamic.",
      "Developer adoption follows a bottom-up motion: individual devs first, then team adoption, then procurement. Design for the single-player experience first.",
    ],
    creative: [
      "The creator economy is bifurcating: platforms that take 30% fees vs tools that creators own outright. The winning move is being the tool, not the marketplace.",
      "Visual identity fatigue is real — most brands look the same after a while. The opportunity is in systems that help creators maintain coherence without sameness.",
      "Content that educates outperforms content that entertains for sustained engagement. The 'teach while you sell' model works across verticals.",
    ],
    community: [
      "Online communities succeed when they solve a specific coordination problem, not just 'connect people.' Discord won gaming coordination, Slack won work coordination.",
      "The cold-start problem is the #1 killer. Seed with 10-15 highly engaged members before opening publicly. Quality at launch determines long-term health.",
      "Communities that produce artifacts (projects, documents, outcomes) retain members better than those that only produce discussions.",
    ],
    business: [
      "B2B SaaS metrics: aim for <12 month payback, >120% net revenue retention, <2% monthly churn. These are the benchmarks investors use.",
      "The 'land and expand' model works: start with a narrow use case, prove value, then expand horizontally. Salesforce started with contacts, not the full CRM.",
      "Pricing is the most underrated growth lever. Most startups undercharge. The willingness-to-pay research is always worth doing before launch.",
    ],
    health: [
      "Digital health products face regulatory complexity. Start with wellness (no FDA clearance) before moving to clinical. Headspace started as meditation, not therapy.",
      "Adherence is the main challenge in health apps. The 'hook model' (routine → variable reward → investment) works differently here — consistency beats novelty.",
      "Health data is sensitive. Building trust through transparency and HIPAA-compliance early is cheaper than retrofitting later.",
    ],
    education: [
      "EdTech winners focus on outcomes, not content. Course Hero won by organizing existing materials, not creating new ones.",
      "The biggest competitor in education is apathy, not other products. Design for motivation first, content second.",
      "Micro-learning (5-15 minute sessions) outperforms long-form for skill acquisition. Spaced repetition is the most evidence-backed learning technique.",
    ],
    environment: [
      "Climate tech follows a 'policy + technology' curve. The Inflation Reduction Act created massive tailwinds for US-based clean energy startups.",
      "Carbon credits are controversial but voluntary markets are growing. The verification layer (MRV) is where the real value sits.",
      "Consumer-facing sustainability products need to be cheaper OR better, not just greener. The 'green premium' must be zero or negative.",
    ],
    event: [
      "Events succeed when they solve a coordination problem, not just a social one. People show up for value (learning, fixing, trading), not just chit-chat.",
      "The biggest risk is low turnout, not low quality. Start with a group of 15-20 committed people rather than advertising to hundreds. Word of mouth compounds.",
      "Recurring events (weekly, monthly) build habit. One-off events require re-marketing every time. Consistency is the cheapest growth lever.",
    ],
    food: [
      "Community food projects succeed when they reduce friction. Door-to-door delivery beats 'come pick it up' for adoption. The container return rate depends on convenience.",
      "Food waste is a $1 trillion problem. The highest-impact interventions are at the retail and household level. Gleaning, composting, and redistribution all have proven models.",
      "Local food systems work when they connect producers directly to consumers. Middlemen add cost and reduce freshness. Farmers markets are the proof of concept.",
    ],
    local: [
      "Neighbourhood projects succeed when they solve a visible, daily problem. Potholes, park maintenance, and safety get more engagement than abstract 'community building'.",
      "The 100-household rule: if you can get 100 households engaged, you have critical mass. Before that, every person matters. Focus on personal invitations, not flyers.",
      "Local government partnerships unlock resources most people don't know exist. Community gardens, tool libraries, and repair cafes often qualify for city grants.",
    ],
    hobby: [
      "Hobby-based communities retain members better than interest-based ones. Doing together beats talking about doing. Shared activity is the粘合剂.",
      "The beginner experience determines retention. If the first session is frustrating, people don't come back. Design for the 'I did it!' moment in the first 20 minutes.",
      "Weekend timing is critical for hobby activities. weekday events get 30-40% lower turnout. Sunday mornings have the highest attendance for community activities.",
    ],
    general: [
      "The best validation is someone paying you before the product exists. A landing page + Stripe checkout can validate demand in a weekend.",
      "Competition is validation. No competition means either no market or no one cares yet. Both are warning signs.",
      "The '10x better' rule: incremental improvements don't change behavior. You need to be 10x faster, cheaper, or easier to win against incumbents.",
    ],
  };

  const insights = domainInsights[domain] ?? domainInsights.general;
  const insight = insights[Math.floor(pseudoRandom(ctx.input + "research") * insights.length)];
  const topic = topicPhrase(ctx.input);

  const opener = reacted
    ? `Dug deeper on ${topic} — the first scan was worth it, but here's the sharper read. ${insight}`
    : `Read through the ${topic} angle and checked who's already in this space. ${insight}`;

  return `${heading("research")}\n${opener}\n\nBefore anything else, name the 2–3 closest existing projects and what they get wrong — the gap they leave open is your real entry point. That single paragraph becomes your positioning statement.`;
}

/* ------------------------- Design ------------------------ */

function design(ctx: ContributionCtx): string {
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);
  const humanWisdom = hasHumanWisdom(ctx);

  const designSystems: Record<string, { identity: string[]; palette: string[]; motif: string[] }> = {
    tech: {
      identity: ["geometric precision with human warmth", "monospace headers + humanist body", "code-inspired grid with breathing room"],
      palette: ["deep navy + electric blue + warm gray", "charcoal + teal + cream", "slate + lime accent + paper white"],
      motif: ["terminal cursor blink", "component tree branching", "API endpoint arrows"],
    },
    creative: {
      identity: ["editorial balance between structure and flow", "generous whitespace with bold type", "hand-drawn accents on clean grid"],
      palette: ["warm black + saffron + linen", "ink + coral + mist", "forest + gold + cream"],
      motif: ["brush stroke underline", "overlapping paper layers", "film strip progression"],
    },
    community: {
      identity: ["friendly geometry with rounded corners", "conversation-first layout", "member faces as visual texture"],
      palette: ["sage + warm white + terracotta", "sky + cream + clay", "moss + paper + rust"],
      motif: ["speech bubble contours", "network node clusters", "avatar grid pattern"],
    },
    business: {
      identity: ["clean hierarchy with data-forward layout", "tabular alignment with subtle borders", "professional without being sterile"],
      palette: ["navy + white + gold accent", "charcoal + blue + light gray", "slate + emerald + paper"],
      motif: ["chart line as decorative element", "grid-based dashboard feel", "minimal bar separators"],
    },
    general: {
      identity: ["one strong typeface + one supporting", "hierarchy through size, not color overload", "restrained palette, expressive layout"],
      palette: ["ink + paper + verdant accent", "charcoal + cream + terracotta", "slate + warm white + amber"],
      motif: ["dot pattern for texture", "ruled lines for structure", "geometric badges for categories"],
    },
    event: {
      identity: ["warm, inviting typography with handmade feel", "bifold card aesthetic with clear sections", "playful but organized with event-day energy"],
      palette: ["burnt orange + cream + charcoal", "terracotta + sage + warm white", "mustard + forest + paper"],
      motif: ["calendar date as visual anchor", "ticket stub texture", "speech bubble for schedule items"],
    },
    food: {
      identity: ["organic shapes with farm-fresh warmth", "chalkboard and kraft paper texture", "hand-drawn produce illustrations"],
      palette: ["olive green + terracotta + cream", "herb green + warm brown + linen", "tomato red + sage + paper"],
      motif: ["leaf or seed as recurring element", "market stall awning stripe", "mason jar silhouette"],
    },
    local: {
      identity: ["neighbourhood map aesthetic with street-level detail", "community bulletin board feel", "friendly sans-serif with local pride"],
      palette: ["sky blue + warm white + clay", "moss green + sand + rust", "slate + terracotta + cream"],
      motif: ["pin on a map", "house silhouette cluster", "street sign typography"],
    },
    hobby: {
      identity: ["active, energetic layout with movement", "tool or equipment as visual motif", "casual but purposeful with craft energy"],
      palette: ["sport blue + white + warm gray", "forest + orange + cream", "charcoal + teal + paper"],
      motif: ["action shot silhouette", "circular badge for skill level", "gear or tool outline"],
    },
  };

  const system = designSystems[domain] ?? designSystems.general;
  const identity = system.identity[Math.floor(pseudoRandom(ctx.input + "design-id") * system.identity.length)];
  const palette = system.palette[Math.floor(pseudoRandom(ctx.input + "design-pal") * system.palette.length)];
  const motif = system.motif[Math.floor(pseudoRandom(ctx.input + "design-mot") * system.motif.length)];
  const topic = topicPhrase(ctx.input);

  const core = `For ${topic}, I'd anchor the identity in ${identity}. Colours: ${palette}. The signature motif: ${motif}.`;

  if (humanWisdom) {
    return `${heading("design")}\n${core} The notes you added point this at a real neighbourhood, so I kept it approachable — warm but never cartoonish, no gradients, and it has to hold up in dark mode on a phone. One strong visual anchor, two supporting details, done.`;
  }
  return `${heading("design")}\n${core} Keep the first version to three colours and one display typeface — enough to feel intentional without locking you in. You can tighten it later once the copy and budget land.`;
}

/* ------------------------- Content ------------------------ */

function content(ctx: ContributionCtx): string {
  const human = getHumanInput(ctx);
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);

  const messaging: Record<string, string[]> = {
    tech: [
      "Lead with the pain point, not the technology. 'Stop wasting 3 hours on X' beats 'AI-powered Y platform' every time.",
      "The founding message should fit in a Slack message. If you can't explain it in 2 sentences, it's not clear enough yet.",
    ],
    creative: [
      "The best creative brands are opinionated. Pick a stance: 'Design should be free' or 'Tools should disappear.' Neutrality is invisible.",
      "Content cadence: 1 founding manifesto, then weekly 'build in public' updates. Show the work, not just the result.",
    ],
    community: [
      "The founding message should answer: 'Why should I care?' in 5 words or fewer. Community is built on shared purpose, not shared tools.",
      "Welcome sequences matter more than launch announcements. The first 48 hours of a new member's experience determines retention.",
    ],
    business: [
      "Position against the status quo, not competitors. 'Instead of spreadsheets' is more powerful than 'better than Excel.'",
      "Social proof starts small: 3 testimonials from people you actually know are worth more than 30 from strangers.",
    ],
    general: [
      "A 30-day content sprint: Week 1 = founding story, Week 2 = problem deep-dive, Week 3 = solution in action, Week 4 = invitation to join.",
      "One measurable goal per week: signups, replies, shares, or waitlist additions. Vanity metrics don't pay rent.",
    ],
    event: [
      "The invitation should answer: who, what, when, where, and why bother — in 3 sentences or fewer. People decide in 5 seconds.",
      "Social proof for events: '30 people are coming' beats 'everyone is welcome.' Scarcity and specificity drive RSVPs.",
    ],
    food: [
      "Food content works best when it's sensory. Describe the smell, the crunch, the colour. People eat with their eyes first.",
      "The founding message for food projects: 'Fresh, local, and yours.' Simple beats clever. People want to know where their food comes from.",
    ],
    local: [
      "Local content works best when it's personal. 'Your neighbour Sarah started this' beats 'a new community initiative.' Faces beat institutions.",
      "The first post should be a story, not an announcement. 'Why I started this' is more compelling than 'Come to our event.'",
    ],
    hobby: [
      "Hobby content works best when it shows the journey. Before/after photos, skill progression, and 'I did it!' moments drive engagement.",
      "The founding message: 'Come as you are, leave knowing something.' Beginner-friendliness is the #1 differentiator for hobby communities.",
    ],
  };

  const tips = messaging[domain] ?? messaging.general;
  const tip = tips[Math.floor(pseudoRandom(ctx.input + "content") * tips.length)];

  if (human) {
    return `${heading("content")}\nI built the message around what you told us — "${human.slice(0, 80)}". ${tip} Run a 30-day cadence: one founding note, then a weekly update that shows a real snippet of progress. One measurable goal each week — signups, replies, or shares — and you'll know within a month whether the message lands.`;
  }
  return `${heading("content")}\n${tip} Draft the founding message as a one-paragraph manifesto: what exists, why it's wrong, and what you're building instead. Keep it short enough to forward — if it needs an elevator, it isn't the founding message yet.`;
}

/* ------------------------- Tech ------------------------ */

function tech(ctx: ContributionCtx): string {
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);

  const stacks: Record<string, { stack: string; cost: string; speed: string }> = {
    tech: {
      stack: "Jamstack front end (Next.js/Astro), serverless API (Vercel/Cloudflare Workers), managed database (Supabase/Planetscale).",
      cost: "Free tier covers the first 10K users. Database: $0-25/mo, hosting: $0-20/mo, auth: $0 (Clerk/Supabase).",
      speed: "MVP in 1-2 weeks. The stack is chosen for speed-to-ship, not scale. You can always migrate later.",
    },
    creative: {
      stack: "Static site (Astro/11ty), headless CMS (Sanity free tier), image CDN (Cloudinary free tier).",
      cost: "Under $10/mo for the first 5K visitors. CMS is free up to 100K API calls. CDN handles the heavy lifting.",
      speed: "Portfolio-quality site in 3-5 days. CMS setup is the longest pole — start there.",
    },
    community: {
      stack: "Next.js + Supabase (auth + database + realtime), Vercel hosting, Resend for email.",
      cost: "Free tier covers: 50K monthly active users (Supabase), unlimited bandwidth (Vercel), 100 emails/day (Resend).",
      speed: "Core community features in 1 week. Auth + realtime + database in one afternoon with Supabase.",
    },
    business: {
      stack: "Next.js + Stripe + Supabase. One codebase, serverless, no DevOps.",
      cost: "Free until you're making money. Stripe takes 2.9% + $0.30 per transaction. No monthly fees.",
      speed: "Landing page + checkout in 2-3 days. Full product in 2-3 weeks depending on complexity.",
    },
    general: {
      stack: "Jamstack front end, serverless functions, managed database. The 'free tier trio' — Vercel + Supabase + Clerk.",
      cost: "Zero cost until product-market fit. All three providers have generous free tiers that handle real traffic.",
      speed: "Working prototype in a weekend. Production-ready in 2 weeks. The stack is optimized for speed, not premature optimization.",
    },
    event: {
      stack: "Google Forms for RSVPs, Canva for flyers, WhatsApp/Signal group for coordination, Google Sheets for tracking.",
      cost: "Free. All tools have free tiers. The only cost is your time and the venue (often free for community events).",
      speed: "Event page live in 1 hour. First invitation sent today. RSVPs rolling in within 24 hours.",
    },
    food: {
      stack: "WhatsApp group for orders, Google Sheets for inventory, Square/Stripe for payments, Instagram for marketing.",
      cost: "Free until you process payments. Square takes 2.6% + $0.10 per transaction. No monthly fees.",
      speed: "First order cycle in 1 week. Start with 10 customers, iterate on logistics, then scale.",
    },
    local: {
      stack: "Next.js site + Supabase for data, Vercel for hosting, Resend for email updates, WhatsApp for real-time coordination.",
      cost: "Free tier covers the first 500 residents. Email + hosting + database all free at small scale.",
      speed: "Community site live in 2-3 days. Start collecting signups and feedback immediately.",
    },
    hobby: {
      stack: "WhatsApp/Signal group for scheduling, Google Forms for signups, Instagram for showcasing, Canva for flyers.",
      cost: "Free. The tools are already on everyone's phone. No new software to learn or maintain.",
      speed: "First meetup organized in 24 hours. Post the invite, collect RSVPs, show up.",
    },
  };

  const s = stacks[domain] ?? stacks.general;
  const topic = topicPhrase(ctx.input);

  return `${heading("tech")}\nFor ${topic}, I'd keep the build boring and reliable: ${s.stack}\n\nCost baseline: ${s.cost}\n\nSpeed to market: ${s.speed}\n\nDon't buy a bigger stack than the idea needs today. Every migration starts with "it was only $0/month while nobody used it".`;
}

/* ------------------------- Strategy ------------------------ */

function strategy(ctx: ContributionCtx): string {
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);
  const hasBudget = priorHasRole(ctx, "budget");

  const strategies: Record<string, string[]> = {
    tech: [
      "3-milestone path: (1) MVP with 10 beta users in 2 weeks, (2) Public launch with 100 users in 6 weeks, (3) First revenue milestone in 12 weeks. Each milestone has a clear exit criterion.",
      "Risk map: Scope creep (mitigate: time-box features), adoption (mitigate: partner with 3 communities pre-launch), technical debt (mitigate: write tests for the critical path only).",
    ],
    creative: [
      "3-milestone path: (1) Portfolio of 5 works in 2 weeks, (2) First paying client in 4 weeks, (3) Repeatable service package in 8 weeks. Price by value, not hours.",
      "Risk map: Scope creep (mitigate: define 'done' per project), creative burnout (mitigate: alternate creative/admin tasks), underpricing (mitigate: research 3 competitors' rates first).",
    ],
    community: [
      "3-milestone path: (1) 15 engaged founding members in 1 week, (2) First community-generated content in 3 weeks, (3) Self-sustaining discussion in 8 weeks. Quality > quantity.",
      "Risk map: Dead forum (mitigate: seed 3 threads/day yourself), toxic members (mitigate: clear code of conduct from day 1), spam (mitigate: require introduction post).",
    ],
    business: [
      "3-milestone path: (1) Landing page + 50 waitlist signups in 1 week, (2) First paying customer in 4 weeks, (3) $1K MRR in 12 weeks. Revenue is the only metric that matters.",
      "Risk map: No demand (mitigate: talk to 20 potential customers first), pricing wrong (mitigate: test 3 price points), churn (mitigate: weekly check-ins with first 10 customers).",
    ],
    general: [
      "3-milestone path: (1) Working prototype in 1 week, (2) 10 real users in 3 weeks, (3) First dollar of revenue in 8 weeks. Each milestone forces a real-world test.",
      "Risk map: Building what nobody wants (mitigate: show before building), perfectionism (mitigate: 'good enough' deadline), losing momentum (mitigate: daily 15-min standup with yourself).",
    ],
    event: [
      "3-milestone path: (1) Date + venue locked, 20 RSVPs in 1 week, (2) First event with 15+ attendance in 3 weeks, (3) Recurring monthly cadence with 30+ regulars in 8 weeks.",
      "Risk map: Low turnout (mitigate: personal invitations to 50 people), venue falls through (mitigate: have 2 backup spaces), day-of chaos (mitigate: run-of-show doc with 15-min buffers).",
    ],
    food: [
      "3-milestone path: (1) First 10 customers ordering in 1 week, (2) 30 regular customers with weekly delivery in 4 weeks, (3) Break-even on ingredients + containers in 8 weeks.",
      "Risk map: Food safety (mitigate: follow local health guidelines), container loss (mitigate: deposit system), spoilage (mitigate: pre-orders only, no overstock).",
    ],
    local: [
      "3-milestone path: (1) 50 residents signed up in 1 week, (2) First neighbourhood event with 20+ attendance in 3 weeks, (3) Self-sustaining with volunteer rotation in 8 weeks.",
      "Risk map: Apathy (mitigate: start with visible, daily problems), volunteer burnout (mitigate: shared leadership from day 1), scope creep (mitigate: pick 1 project, finish it).",
    ],
    hobby: [
      "3-milestone path: (1) First meetup with 8+ people in 1 week, (2) Weekly cadence with 12+ regulars in 4 weeks, (3) Members organizing their own sub-groups in 8 weeks.",
      "Risk map: Skill gap intimidation (mitigate: separate beginner/advanced sessions), scheduling conflicts (mitigate: 2 time slots per week), venue cost (mitigate: public spaces, parks, libraries).",
    ],
  };

  const tips = strategies[domain] ?? strategies.general;
  const tip = tips[Math.floor(pseudoRandom(ctx.input + "strategy") * tips.length)];

  const budgetNote = hasBudget ? " Budget is pinned — align milestones to the cost ceiling." : "";
  return `${heading("strategy")}\n${tip}${budgetNote}\n\nFirst milestone is deliberately small so it ships this week, not next month.`;
}

/* ------------------------- Budget ------------------------ */

function budget(ctx: ContributionCtx): string {
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);
  const hasTech = priorHasRole(ctx, "tech");

  const budgets: Record<string, { fixed: string; variable: string; lever: string; target: string }> = {
    tech: {
      fixed: "Domain ($12/yr) + design tools ($0-15/mo) + email service ($0-20/mo). Total fixed: under $50/mo.",
      variable: "Hosting scales with usage: $0 at 1K users, ~$50 at 10K, ~$200 at 100K. Database: $25/mo base + $0.10 per 1K reads.",
      lever: "The single biggest cost lever is compute. Serverless means you pay per request, not per server. Optimize query efficiency early.",
      target: "Self-funding threshold: $500/mo covers all infrastructure. Price the product at $10-20/user/mo to hit this with 25-50 paying users.",
    },
    creative: {
      fixed: "Design software ($0-50/mo) + portfolio hosting ($0-10/mo) + invoicing tool ($0). Total fixed: under $60/mo.",
      variable: "Mostly time-based. Client work costs are reimbursable. Stock assets: $0-50/project depending on needs.",
      lever: "The biggest cost lever is your time. Track hours for the first month to understand your real hourly rate, then raise prices.",
      target: "Self-funding threshold: 2-3 client projects per month at $500-1000 each. Or one retainer at $1500/mo.",
    },
    community: {
      fixed: "Platform ($0-20/mo) + email ($0-20/mo) + moderation tools ($0). Total fixed: under $40/mo.",
      variable: "Scales with members. Most community tools have free tiers up to 100-1000 members. Growth costs come later.",
      lever: "The biggest cost lever is moderation. Manual moderation doesn't scale — build self-moderation norms early.",
      target: "Self-funding threshold: $300/mo. Options: membership ($5-10/mo), sponsorships, or freemium with premium features.",
    },
    business: {
      fixed: "Infrastructure ($0-50/mo) + payment processing (2.9% + $0.30) + support tools ($0-30/mo). Total fixed: under $80/mo.",
      variable: "Scales with revenue. Payment processing is the main variable cost. Support volume is the hidden variable.",
      lever: "The biggest cost lever is customer acquisition. Organic growth (content, community, referrals) is 10x cheaper than paid ads.",
      target: "Self-funding threshold: depends on your costs, but $2-5K MRR is where most solo founders can quit their day job.",
    },
    general: {
      fixed: "Essentials: domain ($12/yr) + hosting ($0-20/mo) + database ($0-25/mo). Total fixed: under $50/mo.",
      variable: "Mostly zero until you scale. Free tiers are generous. The real cost is your time.",
      lever: "The biggest cost lever is scope. Ship less, learn more. A focused MVP beats a sprawling product every time.",
      target: "Self-funding threshold: $500/mo covers most indie projects. Price based on value delivered, not cost incurred.",
    },
    event: {
      fixed: "Venue ($0-100/event) + supplies ($20-50/event) + promotion ($0, word of mouth). Total fixed: under $150 per event.",
      variable: "Food/refreshments ($2-5/head), printing ($0-20/event), backup supplies ($20). Scales linearly with attendance.",
      lever: "The biggest cost lever is the venue. Free spaces (parks, libraries, community centres) make the event free to run. Sponsorships cover food.",
      target: "Self-funding threshold: $0 if venue is free. Optional: $5-10/person ticket to cover food + supplies. Break-even at 15-20 attendees.",
    },
    food: {
      fixed: "Containers ($50-100 initial, reusable) + delivery bags ($20) + payment processing (2.6% + $0.10). Total fixed: under $120 startup.",
      variable: "Ingredients ($2-5/order), fuel/delivery ($1-3/order), container replacement ($0.50/order). Scales per delivery.",
      lever: "The biggest cost lever is ingredient sourcing. Local farms sell wholesale. Buying in bulk cuts costs 30-40% vs retail.",
      target: "Self-funding threshold: $200-400/mo. Price at $15-25/order with 30% margin. 15-20 regular customers covers costs.",
    },
    local: {
      fixed: "Website ($0-10/mo) + email ($0, free tier) + supplies ($0-50/event). Total fixed: under $60/mo.",
      variable: "Event costs ($20-50/event), printed materials ($0-20), refreshments ($0-30/event). Scales with event frequency.",
      lever: "The biggest cost lever is volunteer time. Shared leadership means no single person bears the cost. Partner with local businesses for in-kind support.",
      target: "Self-funding threshold: $0-100/mo if volunteers handle everything. Optional: $2-5/person event fee or local business sponsorships.",
    },
    hobby: {
      fixed: "Venue ($0, public spaces) + equipment ($50-200 one-time, shared) + communication ($0, WhatsApp). Total fixed: under $200 startup.",
      variable: "Refreshments ($2-5/meetup), replacement equipment ($10-20/mo), printed guides ($0-10). Scales with group size.",
      lever: "The biggest cost lever is equipment. Borrow, share, or buy used. Most hobbies don't need expensive gear to start.",
      target: "Self-funding threshold: $0 if using free spaces and shared equipment. Optional: $3-5/meetup contribution for refreshments.",
    },
  };

  const b = budgets[domain] ?? budgets.general;
  const techNote = hasTech ? " Aligned with the tech stack — serverless keeps variable costs near zero until traction." : "";

  return `${heading("budget")}\nFixed costs: ${b.fixed}\nVariable costs: ${b.variable}\n\n${b.lever}${techNote}\n\nSelf-funding target: ${b.target}`;
}

/* ------------------------- Synthesis ------------------------ */

/** Extract the first meaningful sentence from an agent's output. */
function agentSummary(content: string): string {
  // Strip the heading line
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const body = lines.slice(1).join(" ").trim();
  // Take first sentence or first 120 chars
  const firstSentence = body.match(/^[^.!?]+[.!?]/)?.[0] ?? body.slice(0, 120);
  return firstSentence.trim();
}

function synthesize(ctx: ContributionCtx): string {
  const keywords = extractKeywords(ctx.input);
  const domain = detectDomain(keywords);

  // Pull actual summaries from each agent's prior output
  const priorMap = new Map<string, string>();
  for (const p of ctx.prior) {
    if (p.agentRole) priorMap.set(p.agentRole, agentSummary(p.content));
  }

  const researchNote = priorMap.get("research") ?? "Demand validated.";
  const designNote = priorMap.get("design") ?? "Identity set.";
  const contentNote = priorMap.get("content") ?? "Message shaped.";
  const techNote = priorMap.get("tech") ?? "Tools chosen.";
  const strategyNote = priorMap.get("strategy") ?? "Path mapped.";
  const budgetNote = priorMap.get("budget") ?? "Costs pinned.";

  // Domain-specific next actions
  const nextActions: Record<string, string> = {
    tech: ctx.humanContributions > 0
      ? "validate with 5 real users, then ship milestone one this week"
      : "define the founding scope, then build a working prototype",
    creative: ctx.humanContributions > 0
      ? "show the first draft to 3 people, then iterate based on response"
      : "create the founding piece, then share it with your first audience",
    community: ctx.humanContributions > 0
      ? "invite 15 founding members, then seed the first conversations"
      : "write the community manifesto, then recruit your first 10 members",
    business: ctx.humanContributions > 0
      ? "get 3 letters of intent, then start the 30-day sprint"
      : "build the landing page, then start collecting signups",
    event: ctx.humanContributions > 0
      ? "confirm the venue and date, then spread the word through 3 channels"
      : "pick a date, secure the space, and draft the first invitation",
    food: ctx.humanContributions > 0
      ? "test the recipe with 5 friends, then refine based on feedback"
      : "prototype the menu, then source ingredients from local suppliers",
    local: ctx.humanContributions > 0
      ? "talk to 10 neighbours, then adjust the concept based on what they say"
      : "map the neighbourhood need, then find your first partner",
    hobby: ctx.humanContributions > 0
      ? "find 3 people to try it with, then refine the experience"
      : "define the core experience, then invite your first participants",
    general: ctx.humanContributions > 0
      ? "test with real users, then iterate based on what you learn"
      : "confirm the founding scope, then ship the first version",
  };

  const snippetText = snippet(ctx.input);
  const next = nextActions[domain] ?? nextActions.general;

  return [
    `${heading("community")}`,
    `Everything converges on "${snippetText}".`,
    ``,
    `Research: ${researchNote}`,
    `Design: ${designNote}`,
    `Content: ${contentNote}`,
    `Tech: ${techNote}`,
    `Strategy: ${strategyNote}`,
    `Budget: ${budgetNote}`,
    ``,
    `Next: ${next}.`,
    ``,
    `Driving the idea forward: @${ctx.authorHandle}.`,
  ].join("\n");
}

const GENERATORS: Record<AgentRole, (c: ContributionCtx) => string> = {
  research,
  design,
  content,
  tech,
  strategy,
  budget,
  community: synthesize,
};

/** Simple deterministic pseudo-random based on string hash. */
function pseudoRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) / 2147483647;
}

/** Default impact per role (drives fitness + contribution impact). */
export const DEFAULT_IMPACT: Record<AgentRole, number> = {
  research: 7,
  design: 6,
  content: 5,
  tech: 6,
  strategy: 6,
  budget: 5,
  community: 10,
};

/**
 * Run one agent persona. `community` synthesizes; others produce a
 * role-specific contribution that reacts to prior work.
 */
export function runAgent(role: AgentRole, ctx: ContributionCtx): AgentOutput {
  const content = (GENERATORS[role] ?? research)(ctx);
  return { role, content, impact: DEFAULT_IMPACT[role] ?? 5 };
}

/** The six creator agents fire in order; each sees prior output (agent-to-agent). */
export const AGENT_ORDER: AgentRole[] = [
  "research",
  "design",
  "content",
  "tech",
  "strategy",
  "budget",
];

/** Run the full agent pipeline + synthesis. Returns staged outputs. */
export function runPipeline(
  ctx: Omit<ContributionCtx, "prior">,
  initialPrior: ContributionCtx["prior"] = []
): AgentOutput[] {
  const prior: ContributionCtx["prior"] = [...initialPrior];
  const outputs: AgentOutput[] = [];
  for (const role of AGENT_ORDER) {
    const out = runAgent(role, { ...ctx, prior });
    prior.push({ agentRole: role, contributorHandle: "agent", content: out.content });
    outputs.push(out);
  }
  outputs.push(runAgent("community", { ...ctx, prior }));
  return outputs;
}

/**
 * Async pipeline that tries LLM first, falls back to deterministic templates.
 * `llmCaller` returns null if LLM is unavailable or fails for a role.
 */
export async function runPipelineWithLLM(
  ctx: Omit<ContributionCtx, "prior">,
  initialPrior: ContributionCtx["prior"],
  llmCaller: (role: AgentRole, ideaInput: string, contentKind: string, priorTexts: string[]) => Promise<string | null>,
): Promise<AgentOutput[]> {
  const prior: ContributionCtx["prior"] = [...initialPrior];
  const outputs: AgentOutput[] = [];

  for (const role of AGENT_ORDER) {
    const priorTexts = prior.map((p) => p.content);
    const llmContent = await llmCaller(role, ctx.input, ctx.contentKind, priorTexts);

    let content: string;
    if (llmContent) {
      content = llmContent;
    } else {
      content = (GENERATORS[role] ?? research)({ ...ctx, prior });
    }

    prior.push({ agentRole: role, contributorHandle: "agent", content });
    outputs.push({ role, content, impact: DEFAULT_IMPACT[role] ?? 5 });
  }

  // Synthesis — always deterministic (it just summarizes the other agents)
  const synthesisOut = runAgent("community", { ...ctx, prior });
  outputs.push(synthesisOut);

  return outputs;
}
