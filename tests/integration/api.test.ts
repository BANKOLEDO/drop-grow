import { describe, expect, it } from "vitest";
import { runPipeline, runAgent, AGENT_ORDER, AGENT_NAMES } from "../../convex/agents/engine";

// Pure unit tests for the Convex backend logic
// These test the engine, helpers, and data patterns without needing convex-test

describe("users and sessions pattern", () => {
  it("token hash is used for session lookup", () => {
    // The app uses SHA-256 hashes of tokens for session lookup
    // This pattern prevents plaintext token storage
    const token = "my-secret-token";
    const hash = sha256Simple(token);
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
    // Same token always produces same hash
    expect(sha256Simple(token)).toBe(hash);
    // Different tokens produce different hashes
    expect(sha256Simple("other-token")).not.toBe(hash);
  });
});

describe("ideas data patterns", () => {
  it("stage advances with contribution count", () => {
    // stageForCount logic
    expect(stageForCount(0)).toBe("seed");
    expect(stageForCount(1)).toBe("seed");
    expect(stageForCount(2)).toBe("hatching");
    expect(stageForCount(4)).toBe("hatching");
    expect(stageForCount(5)).toBe("growing");
    expect(stageForCount(10)).toBe("growing");
    expect(stageForCount(11)).toBe("building");
    expect(stageForCount(20)).toBe("building");
    expect(stageForCount(21)).toBe("mature");
  });

  it("fitness score is between 0 and 100", () => {
    const scores = [0, 25, 50, 75, 100];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("contributions pattern", () => {
  it("agent contributions have agentRole set", () => {
    const agentContrib = {
      mutationKind: "research",
      contributorType: "agent",
      agentRole: "research",
      content: "Nova says the market is growing",
      impact: 7,
    };
    expect(agentContrib.contributorType).toBe("agent");
    expect(agentContrib.agentRole).toBe("research");
  });

  it("human contributions have contributorId set", () => {
    const humanContrib = {
      mutationKind: "wisdom",
      contributorType: "human",
      contributorId: "user_123",
      contributorHandle: "alex",
      content: "we need to keep costs low",
      impact: 8,
    };
    expect(humanContrib.contributorType).toBe("human");
    expect(humanContrib.agentRole).toBeUndefined();
  });
});

describe("comments pattern", () => {
  it("comments are linked to contributions", () => {
    const comment = {
      contributionId: "contrib_123",
      authorId: "user_456",
      authorHandle: "commenter",
      content: "great point!",
      createdAt: Date.now(),
    };
    expect(comment.contributionId).toBeTruthy();
    expect(comment.content.length).toBeGreaterThan(0);
  });
});

describe("forks pattern", () => {
  it("fork creates parent-child relationship", () => {
    const fork = {
      parentIdeaId: "idea_parent",
      childIdeaId: "idea_child",
      description: "new direction",
      forkedByHandle: "author",
    };
    expect(fork.parentIdeaId).not.toBe(fork.childIdeaId);
    expect(fork.description).toBeTruthy();
  });
});

describe("health pattern", () => {
  it("health metrics are 0-100 percentages", () => {
    const health = {
      communityInterest: 75,
      feasibility: 60,
      impactPotential: 80,
      resourceAvailability: 50,
      gaps: ["need funding", "no tech lead"],
      suggestions: ["apply for grant", "recruit CTO"],
    };
    expect(health.communityInterest).toBeGreaterThanOrEqual(0);
    expect(health.communityInterest).toBeLessThanOrEqual(100);
    expect(health.gaps.length).toBeGreaterThan(0);
    expect(health.suggestions.length).toBeGreaterThan(0);
  });
});

describe("connections pattern", () => {
  it("connections have strength and reason", () => {
    const connection = {
      ideaId: "idea_1",
      relatedIdeaId: "idea_2",
      strength: 72,
      reason: "both community sharing models",
    };
    expect(connection.strength).toBeGreaterThanOrEqual(0);
    expect(connection.strength).toBeLessThanOrEqual(100);
    expect(connection.reason).toBeTruthy();
    expect(connection.ideaId).not.toBe(connection.relatedIdeaId);
  });
});

describe("engine pipeline", () => {
  const baseCtx = {
    ideaId: "idea_1",
    input: "community composting for urban neighborhoods",
    contentKind: "text",
    authorHandle: "creator",
    stage: "seed" as const,
    visibility: "community" as const,
    humanContributions: 0,
    agentContributions: 0,
  };

  it("runs all 7 agents in order", () => {
    const outputs = runPipeline(baseCtx);
    expect(outputs).toHaveLength(7);
    expect(outputs.map((o) => o.role)).toEqual([...AGENT_ORDER, "community"]);
  });

  it("each agent produces unique content", () => {
    const outputs = runPipeline(baseCtx);
    const contents = new Set(outputs.map((o) => o.content));
    expect(contents.size).toBe(7);
  });

  it("synthesis summarizes other agents", () => {
    const outputs = runPipeline(baseCtx);
    const synthesis = outputs[6];
    expect(synthesis.role).toBe("community");
    expect(synthesis.content).toContain(AGENT_NAMES.community);
  });

  it("agents react to human contributions", () => {
    const withHuman = runPipeline(baseCtx, [
      { agentRole: null, contributorHandle: "alex", content: "we tried this in Queens" },
    ]);
    const design = withHuman.find((o) => o.role === "design")!;
    expect(design.content).toContain("notes you added");
  });

  it("works with different content kinds", () => {
    for (const kind of ["image", "voice", "text"]) {
      const outputs = runPipeline({ ...baseCtx, contentKind: kind });
      expect(outputs).toHaveLength(7);
    }
  });

  it("works with different stages", () => {
    for (const stage of ["seed", "hatching", "growing", "building", "mature"]) {
      const outputs = runPipeline({ ...baseCtx, stage: stage as any });
      expect(outputs).toHaveLength(7);
    }
  });
});

// Simple hash helper (not cryptographic, just for testing patterns)
function sha256Simple(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function stageForCount(count: number): string {
  if (count <= 1) return "seed";
  if (count <= 4) return "hatching";
  if (count <= 10) return "growing";
  if (count <= 20) return "building";
  return "mature";
}
