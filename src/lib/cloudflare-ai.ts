/**
 * Cloudflare Workers AI — free tier (10,000 neurons/day).
 * Uses Llama 3.2-1B for fast, cheap inference.
 * Docs: https://developers.cloudflare.com/workers-ai/
 */

import { AGENT_NAMES, type AgentRole } from "./domain";

const CF_ACCOUNT_ID = (import.meta as any).env?.VITE_CF_ACCOUNT_ID ?? "";
const CF_API_TOKEN = (import.meta as any).env?.VITE_CF_API_TOKEN ?? "";
const CF_MODEL = "@cf/meta/llama-3.2-1b-instruct";

interface LLMResponse {
  result: { response: string };
}

/** Call Cloudflare Workers AI — returns null on any failure so fallback to deterministic engine. */
export async function callLLM(
  role: AgentRole,
  ideaInput: string,
  priorContributions: string[],
): Promise<string | null> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return null;

  const systemPrompt = `You are ${AGENT_NAMES[role]}, a specialized AI agent in the drop&grow idea engine.
Your role: ${role}. You are concise, specific, and action-oriented.
Write 2-4 sentences max. No headers, no labels, just your insight.`;

  const priorContext =
    priorContributions.length > 0
      ? `\n\nPrevious contributions you're building on:\n${priorContributions.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "";

  const userPrompt = `Idea: "${ideaInput}"${priorContext}\n\nAs ${AGENT_NAMES[role]}, what is your ${role} insight?`;

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    if (!res.ok) return null;
    const data: LLMResponse = await res.json();
    const text = data?.result?.response?.trim();
    if (!text || text.length < 10) return null;
    return text;
  } catch {
    return null;
  }
}

/** Get a domain-specific enhancement from the LLM. */
export async function enhanceInsight(
  domain: string,
  ideaInput: string,
): Promise<string | null> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return null;

  const prompts: Record<string, string> = {
    tech: `For the tech idea "${ideaInput.slice(0, 80)}", suggest ONE specific technical approach or tool. Be concrete.`,
    creative: `For the creative idea "${ideaInput.slice(0, 80)}", suggest ONE specific creative direction or medium. Be vivid.`,
    community: `For the community idea "${ideaInput.slice(0, 80)}", suggest ONE specific engagement strategy. Be actionable.`,
    business: `For the business idea "${ideaInput.slice(0, 80)}", suggest ONE specific revenue or growth tactic. Be specific.`,
  };

  const prompt = prompts[domain] ?? prompts.community;

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 80,
        temperature: 0.8,
      }),
    });

    if (!res.ok) return null;
    const data: LLMResponse = await res.json();
    return data?.result?.response?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Check if Cloudflare AI is configured. */
export function isAIEnabled(): boolean {
  return Boolean(CF_ACCOUNT_ID && CF_API_TOKEN);
}
