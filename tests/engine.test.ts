import { describe, expect, it, vi } from "vitest";
import {
  runPipeline,
  runAgent,
  runPipelineWithLLM,
  AGENT_ORDER,
  AGENT_NAMES,
  DEFAULT_IMPACT,
  type AgentRole,
  type ContributionCtx,
} from "../convex/agents/engine";

const baseCtx: Omit<ContributionCtx, "prior"> = {
  ideaId: "idea_1",
  input: "a community garden for families",
  contentKind: "voice",
  authorHandle: "sarah_j",
  stage: "growing",
  visibility: "community",
  humanContributions: 3,
  agentContributions: 6,
};

describe("AGENT_NAMES", () => {
  it("has names for all roles", () => {
    for (const role of AGENT_ORDER) {
      expect(AGENT_NAMES[role]).toBeTruthy();
      expect(typeof AGENT_NAMES[role]).toBe("string");
    }
    expect(AGENT_NAMES.community).toBeTruthy();
  });
});

describe("DEFAULT_IMPACT", () => {
  it("has impact scores for all roles", () => {
    for (const role of AGENT_ORDER) {
      expect(DEFAULT_IMPACT[role]).toBeGreaterThan(0);
      expect(DEFAULT_IMPACT[role]).toBeLessThanOrEqual(10);
    }
    expect(DEFAULT_IMPACT.community).toBeGreaterThan(0);
  });
});

describe("runAgent", () => {
  it("returns valid output for each role", () => {
    const roles: AgentRole[] = [...AGENT_ORDER, "community"];
    for (const role of roles) {
      const out = runAgent(role, { ...baseCtx, prior: [] });
      expect(out.role).toBe(role);
      expect(out.content).toBeTruthy();
      expect(out.content.length).toBeGreaterThan(10);
      expect(out.impact).toBeGreaterThan(0);
    }
  });

  it("includes agent name in output", () => {
    for (const role of AGENT_ORDER) {
      const out = runAgent(role, { ...baseCtx, prior: [] });
      expect(out.content).toContain(AGENT_NAMES[role]);
    }
  });

  it("reacts to human contributions", () => {
    const withHuman = runAgent("design", {
      ...baseCtx,
      prior: [
        { agentRole: null, contributorHandle: "mike_r", content: "I built one in Queens" },
      ],
    });
    expect(withHuman.content).toContain("notes you added");
  });

  it("reacts to agent contributions", () => {
    const withBudget = runAgent("strategy", {
      ...baseCtx,
      prior: [
        { agentRole: "budget", contributorHandle: "agent", content: "budget done: $500" },
      ],
    });
    expect(withBudget.content).toContain("Budget is pinned");
  });
});

describe("runPipeline", () => {
  it("fires the six creator agents plus the community synthesizer", () => {
    const outputs = runPipeline(baseCtx);
    expect(outputs).toHaveLength(AGENT_ORDER.length + 1);
    expect(outputs.map((o) => o.role)).toEqual([...AGENT_ORDER, "community"]);
  });

  it("every output has a non-empty role-labelled body", () => {
    const outputs = runPipeline(baseCtx);
    for (const out of outputs) {
      expect(out.content).toContain(AGENT_NAMES[out.role]);
      expect(out.content.length).toBeGreaterThan(20);
      expect(out.impact).toBeGreaterThan(0);
    }
  });

  it("gives each agent a distinct contribution", () => {
    const outputs = runPipeline(baseCtx);
    const bodies = new Set(outputs.map((o) => o.content));
    expect(bodies.size).toBe(outputs.length);
  });

  it("agents build on one another (agent-to-agent): strategy reacts to budget when it already ran", () => {
    const outputs = runPipeline(baseCtx, [
      { agentRole: "budget", contributorHandle: "agent", content: "budget done" },
    ]);
    const strategy = outputs.find((o) => o.role === "strategy")!;
    expect(strategy.content).toContain("Budget is pinned");
  });

  it("synthesis references real human and agent contribution counts", () => {
    const outputs = runPipeline(baseCtx);
    const final = outputs[outputs.length - 1];
    expect(final.role).toBe("community");
    expect(final.content).toContain("@sarah_j");
  });

  it("handles seed stage differently", () => {
    const seedCtx = { ...baseCtx, stage: "seed" as const };
    const outputs = runPipeline(seedCtx);
    expect(outputs).toHaveLength(7);
    for (const out of outputs) {
      expect(out.content).toBeTruthy();
    }
  });

  it("handles mature stage", () => {
    const matureCtx = { ...baseCtx, stage: "mature" as const };
    const outputs = runPipeline(matureCtx);
    expect(outputs).toHaveLength(7);
  });

  it("works with personal visibility", () => {
    const personalCtx = { ...baseCtx, visibility: "personal" as const };
    const outputs = runPipeline(personalCtx);
    expect(outputs).toHaveLength(7);
  });

  it("works with different content kinds", () => {
    for (const kind of ["image", "voice", "text"]) {
      const ctx = { ...baseCtx, contentKind: kind };
      const outputs = runPipeline(ctx);
      expect(outputs).toHaveLength(7);
    }
  });
});

describe("runPipelineWithLLM", () => {
  it("uses LLM output when caller returns content", async () => {
    const llmCaller = vi.fn().mockResolvedValue("LLM response for this role");
    const outputs = await runPipelineWithLLM(baseCtx, [], llmCaller);
    expect(outputs).toHaveLength(7);
    // First 6 agents should use LLM
    for (let i = 0; i < 6; i++) {
      expect(outputs[i].content).toBe("LLM response for this role");
    }
    // Synthesis is always deterministic
    expect(outputs[6].content).toContain(AGENT_NAMES.community);
  });

  it("falls back to deterministic when LLM returns null", async () => {
    const llmCaller = vi.fn().mockResolvedValue(null);
    const outputs = await runPipelineWithLLM(baseCtx, [], llmCaller);
    expect(outputs).toHaveLength(7);
    for (const out of outputs) {
      expect(out.content).toContain(AGENT_NAMES[out.role]);
    }
  });

  it("passes prior texts to LLM caller", async () => {
    const llmCaller = vi.fn().mockResolvedValue("response");
    await runPipelineWithLLM(baseCtx, [], llmCaller);
    // First call has no prior
    expect(llmCaller).toHaveBeenNthCalledWith(1, "research", baseCtx.input, baseCtx.contentKind, []);
  });

  it("passes accumulated prior to subsequent calls", async () => {
    const llmCaller = vi.fn().mockResolvedValue("response");
    await runPipelineWithLLM(baseCtx, [], llmCaller);
    // Second call has one prior
    const secondCallPrior = llmCaller.mock.calls[1][3];
    expect(secondCallPrior).toHaveLength(1);
    expect(secondCallPrior[0]).toBe("response");
  });

  it("mixed LLM and deterministic fallback", async () => {
    const llmCaller = vi.fn().mockImplementation(
      async (role: AgentRole) => role === "research" ? "research LLM" : null
    );
    const outputs = await runPipelineWithLLM(baseCtx, [], llmCaller);
    expect(outputs[0].content).toBe("research LLM");
    // Others fall back to deterministic
    expect(outputs[1].content).toContain(AGENT_NAMES.design);
  });
});

describe("human-to-agent reaction", () => {
  it("design adapts when human wisdom arrives", () => {
    const withHuman = runPipeline(baseCtx, [
      { agentRole: null, contributorHandle: "mike_r", content: "I built one in Queens" },
    ]);
    const design = withHuman.find((o) => o.role === "design")!;
    expect(design.content).toContain("notes you added");
  });

  it("content reacts to the most recent human contribution", () => {
    const prior = [
      { agentRole: "research" as const, contributorHandle: "agent", content: "data" },
      { agentRole: null as null, contributorHandle: "linda_h", content: "parents love sundays" },
    ];
    const out = runAgent("content", { ...baseCtx, prior });
    expect(out.content).toContain("parents love sundays");
  });

  it("budget reacts to human cost concerns", () => {
    const out = runAgent("budget", {
      ...baseCtx,
      prior: [
        { agentRole: null, contributorHandle: "alex", content: "we need to keep costs under $200" },
      ],
    });
    expect(out.content).toContain("cost");
  });
});

describe("domain detection", () => {
  it("detects tech ideas", () => {
    const ctx = { ...baseCtx, input: "an AI-powered SaaS platform for code review", prior: [] };
    const out = runAgent("research", ctx);
    expect(out.content).toBeTruthy();
  });

  it("detects food ideas", () => {
    const ctx = { ...baseCtx, input: "organic vegetable delivery for restaurants", prior: [] };
    const out = runAgent("research", ctx);
    expect(out.content).toBeTruthy();
  });

  it("detects event ideas", () => {
    const ctx = { ...baseCtx, input: "weekly community potluck in the park", prior: [] };
    const out = runAgent("research", ctx);
    expect(out.content).toBeTruthy();
  });

  it("detects hobby ideas", () => {
    const ctx = { ...baseCtx, input: "outdoor yoga and meditation sessions", prior: [] };
    const out = runAgent("research", ctx);
    expect(out.content).toBeTruthy();
  });
});
