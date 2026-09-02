/**
 * LLM integration for drop&grow agents.
 * Speed-first: Groq (100-200ms) → Cloudflare (1-2s) → deterministic (<1ms).
 * All 6 agents run concurrently via Promise.all.
 */

import type { AgentRole } from "./engine";

const AGENT_NAMES: Record<AgentRole, string> = {
  research: "Nova",
  design: "Palette",
  content: "Quill",
  tech: "Circuit",
  strategy: "Apex",
  budget: "Ledger",
  community: "Planner",
};

function contentKindHint(kind: string): string {
  switch (kind) {
    case "image": return "This idea was shared as an image. A visual description is provided.";
    case "voice": return "This idea was shared as a voice recording. The transcript is provided.";
    default: return "This idea was shared as text.";
  }
}

/**
 * Strip markdown so raw **bold**, `code`, or bullet syntax never shows in the UI.
 * Agents should reply in plain text paragraphs.
 */
function scrub(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^ *]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^(\d+)[.)]\s+/gm, "$1. ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[_*~]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function systemPrompt(role: AgentRole, contentKind: string): string {
  const kindHint = contentKindHint(contentKind);
  const name = AGENT_NAMES[role];

  const base = `You are ${name}, a sharp, opinionated agent in the drop&grow idea engine.
${kindHint}
- Be specific to THIS idea. Reference its actual details.
- Be opinionated. Real insight, not safe platitudes.
- Be actionable. Concrete steps, numbers, names, tools.
- Write in plain prose, 3-6 sentences, one or two short paragraphs.
- NEVER use markdown: no **bold**, no *, no backticks, no bullets, no hashtags, no links-as-markdown. Just clean sentences.`;

  switch (role) {
    case "research":
      return `${base}
Your job: demand, competitors, gaps, market. You know what exists and what's missing.
Cite real companies, real numbers. If it's a hobby/personal idea, find similar communities, creators, or products in that space.`;
    case "design":
      return `${base}
Your job: visual identity, branding, aesthetic. You think in palettes, type, layouts.
Suggest specific colors, typefaces, motifs. If non-visual (service, event), design the experience — signage, materials, touchpoints.`;
    case "content":
      return `${base}
Your job: messaging, voice, content strategy. You know what words land.
Suggest tagline, tone, content cadence. For personal/hobby ideas, think about sharing — social posts, invites, stories.`;
    case "tech":
      return `${base}
Your job: tools, platforms, build approach, costs. You pick the right stack.
Name exact tools and free tiers with costs. If it doesn't need tech, say so — and suggest what tools DO help.`;
    case "strategy":
      return `${base}
Your job: milestones, timeline, risks, first steps. You break big into small.
3 concrete milestones with timeframes. Name the biggest risk and fix. For hobby ideas: when to start, what's needed, who to invite.`;
    case "budget":
      return `${base}
Your job: costs, pricing, funding, break-even. You know what things cost.
Real numbers. If free to start, say that. Hidden costs? Call them out. For hobby: cost to try once, cost to keep going.`;
    case "community":
      return `${base}
Your job: synthesize all agents into one clear direction.
Key insight from each agent. Single next step. What happens this week? Connect the dots, don't just list.`;
    default:
      return base;
  }
}

interface LLMResult {
  provider: "groq" | "cloudflare" | "deterministic";
  content: string;
}

/** Compact prior context — last 3 contributions only. */
function priorContext(priorTexts: string[]): string {
  if (priorTexts.length === 0) return "";
  const recent = priorTexts.slice(-3);
  return `\n\nPrior:\n${recent.map((p, i) => `${i + 1}. ${p.slice(0, 200)}`).join("\n")}`;
}

/** Fetch with timeout. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(
  apiKey: string,
  role: AgentRole,
  ideaInput: string,
  contentKind: string,
  priorTexts: string[],
): Promise<string | null> {
  const ctx = priorContext(priorTexts);
  const userPrompt = `Idea: "${ideaInput}"${ctx}\n\nYour ${role} insight:`;

  try {
    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt(role, contentKind) },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 380,
        temperature: 0.7,
        top_p: 0.9,
      }),
    }, 10000);

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || null;
    return raw ? scrub(raw) : null;
  } catch {
    return null;
  }
}

async function callCloudflare(
  accountId: string,
  apiToken: string,
  role: AgentRole,
  ideaInput: string,
  contentKind: string,
  priorTexts: string[],
): Promise<string | null> {
  const ctx = priorContext(priorTexts);
  const userPrompt = `Idea: "${ideaInput}"${ctx}\n\nYour ${role} insight:`;

  try {
    const res = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-1b-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt(role, contentKind) },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 380,
          temperature: 0.7,
        }),
      },
      10000,
    );

    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.result?.response?.trim() || null;
    return raw ? scrub(raw) : null;
  } catch {
    return null;
  }
}

/** Single role: Groq → Cloudflare → deterministic. */
async function callAgentLLM(
  role: AgentRole,
  ideaInput: string,
  contentKind: string,
  priorTexts: string[],
  keys: { groq?: string; cfAccountId?: string; cfApiToken?: string },
): Promise<LLMResult> {
  if (keys.groq) {
    const r = await callGroq(keys.groq, role, ideaInput, contentKind, priorTexts);
    if (r) return { provider: "groq", content: r };
  }
  if (keys.cfAccountId && keys.cfApiToken) {
    const r = await callCloudflare(keys.cfAccountId, keys.cfApiToken, role, ideaInput, contentKind, priorTexts);
    if (r) return { provider: "cloudflare", content: r };
  }
  return { provider: "deterministic", content: "" };
}

/**
 * Run all 6 agents CONCURRENTLY via Promise.all.
 * Each agent: Groq → Cloudflare → deterministic fallback.
 * Total time: max(individual calls), not sum.
 */
export async function callAllAgents(
  ideaInput: string,
  contentKind: string,
  priorTexts: string[],
  keys: { groq?: string; cfAccountId?: string; cfApiToken?: string },
): Promise<Map<AgentRole, LLMResult>> {
  const roles: AgentRole[] = ["research", "design", "content", "tech", "strategy", "budget"];

  const results = await Promise.all(
    roles.map(async (role) => {
      const result = await callAgentLLM(role, ideaInput, contentKind, priorTexts, keys);
      return [role, result] as const;
    }),
  );

  return new Map(results);
}

/**
 * Call Cloudflare Vision to describe an image.
 * Returns a text description of the image content.
 */
export async function describeImage(
  accountId: string,
  apiToken: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                { type: "image", image: { url: imageUrl } },
                { type: "text", text: "Describe this image in detail. What does it show? What's the context?" },
              ],
            },
          ],
          max_tokens: 300,
        }),
      },
      15000,
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.response?.trim() || null;
  } catch {
    return null;
}
}

