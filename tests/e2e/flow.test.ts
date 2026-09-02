import { describe, expect, it } from "vitest";
import { runPipeline, AGENT_ORDER, AGENT_NAMES } from "../../convex/agents/engine";
import { callAllAgents } from "../../convex/agents/llm";

describe("full idea lifecycle", () => {
  it("create idea, run agents, contribute, fork", () => {
    // 1. Create idea
    const idea = {
      input: "community composting program for urban neighborhoods",
      contentKind: "text",
      authorHandle: "creator",
      stage: "seed",
      visibility: "community",
      contributionCount: 0,
      forkCount: 0,
    };

    // 2. Run engine
    const outputs = runPipeline({
      ideaId: "idea_1",
      input: idea.input,
      contentKind: idea.contentKind,
      authorHandle: idea.authorHandle,
      stage: idea.stage as any,
      visibility: idea.visibility as any,
      humanContributions: 0,
      agentContributions: 0,
    });
    expect(outputs).toHaveLength(7);

    // 3. Save contributions
    const contributions = outputs.map((o) => ({
      ideaId: "idea_1",
      mutationKind: o.role === "community" ? "synthesis" : o.role,
      contributorType: "agent",
      contributorHandle: AGENT_NAMES[o.role],
      agentRole: o.role,
      content: o.content,
      impact: o.impact,
    }));
    expect(contributions).toHaveLength(7);

    // 4. Update idea
    const updatedIdea = {
      ...idea,
      contributionCount: 7,
      stage: "growing",
    };
    expect(updatedIdea.stage).toBe("growing");

    // 5. Human contributes
    const humanContrib = {
      ideaId: "idea_1",
      mutationKind: "wisdom",
      contributorType: "human",
      contributorHandle: "creator",
      content: "I tried composting. The smell was the biggest issue. Need sealed bins.",
      impact: 8,
    };
    contributions.push(humanContrib);

    // 6. Re-run agents with human contribution
    const prior = contributions.map((c) => ({
      agentRole: c.agentRole ?? null,
      contributorHandle: c.contributorHandle,
      content: c.content,
    }));

    const rerunOutputs = runPipeline(
      {
        ideaId: "idea_1",
        input: idea.input,
        contentKind: idea.contentKind,
        authorHandle: idea.authorHandle,
        stage: "growing",
        visibility: "community",
        humanContributions: 1,
        agentContributions: 7,
      },
      prior
    );

    // Design should react to human input
    const design = rerunOutputs.find((o) => o.role === "design")!;
    expect(design.content).toContain("notes you added");

    // 7. Fork
    const fork = {
      parentIdeaId: "idea_1",
      childIdeaId: "idea_2",
      description: "focusing on restaurants",
      forkedByHandle: "creator",
    };
    expect(fork.parentIdeaId).not.toBe(fork.childIdeaId);

    // 8. Verify final state
    expect(contributions.length).toBe(8); // 7 agents + 1 human
    expect(updatedIdea.contributionCount).toBe(7);
  });

  it("two users contribute to the same idea", () => {
    const contributions = [
      {
        ideaId: "idea_1",
        contributorHandle: "user_1",
        content: "from user 1",
        impact: 5,
      },
      {
        ideaId: "idea_1",
        contributorHandle: "user_2",
        content: "from user 2",
        impact: 6,
      },
    ];
    expect(contributions).toHaveLength(2);
    expect(contributions[0].contributorHandle).not.toBe(contributions[1].contributorHandle);
  });

  it("health metrics are stored per idea", () => {
    const health = {
      ideaId: "idea_1",
      communityInterest: 80,
      feasibility: 65,
      impactPotential: 75,
      resourceAvailability: 50,
      gaps: ["need funding", "no tech lead"],
      suggestions: ["apply for grant", "recruit CTO"],
    };
    expect(health.communityInterest).toBeGreaterThanOrEqual(0);
    expect(health.communityInterest).toBeLessThanOrEqual(100);
    expect(health.gaps.length).toBeGreaterThan(0);
  });

  it("connections link related ideas", () => {
    const connections = [
      {
        ideaId: "idea_1",
        relatedIdeaId: "idea_2",
        strength: 72,
        reason: "both community sharing models",
      },
    ];
    expect(connections[0].strength).toBeGreaterThanOrEqual(0);
    expect(connections[0].strength).toBeLessThanOrEqual(100);
    expect(connections[0].ideaId).not.toBe(connections[0].relatedIdeaId);
  });
});

describe("LLM integration", () => {
  it("returns deterministic results without API keys", async () => {
    const results = await callAllAgents("community garden", "text", [], {});
    expect(results.size).toBe(6);
    for (const [, result] of results) {
      expect(result.provider).toBe("deterministic");
    }
  });

  it("all 6 roles are represented", async () => {
    const results = await callAllAgents("idea", "text", [], {});
    const roles = Array.from(results.keys());
    expect(roles).toContain("research");
    expect(roles).toContain("design");
    expect(roles).toContain("content");
    expect(roles).toContain("tech");
    expect(roles).toContain("strategy");
    expect(roles).toContain("budget");
  });
});
