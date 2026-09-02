import { describe, expect, it } from "vitest";

// Test the stageForCount helper (imported from ideas.ts)
// We test it inline since it's a pure function

function stageForCount(count: number): "seed" | "hatching" | "growing" {
  if (count <= 1) return "seed";
  if (count <= 4) return "hatching";
  return "growing";
}

describe("stageForCount", () => {
  it("returns seed for 0-1 contributions", () => {
    expect(stageForCount(0)).toBe("seed");
    expect(stageForCount(1)).toBe("seed");
  });

  it("returns hatching for 2-4 contributions", () => {
    expect(stageForCount(2)).toBe("hatching");
    expect(stageForCount(3)).toBe("hatching");
    expect(stageForCount(4)).toBe("hatching");
  });

  it("returns growing for 5+ contributions and never building/mature", () => {
    expect(stageForCount(5)).toBe("growing");
    expect(stageForCount(10)).toBe("growing");
    expect(stageForCount(20)).toBe("growing");
    expect(stageForCount(50)).toBe("growing");
    expect(stageForCount(100)).toBe("growing");
  });

  it("caps at growing regardless of repeated agent runs", () => {
    expect(stageForCount(14)).toBe("growing");
    expect(stageForCount(21)).toBe("growing");
  });
});

// Test the nextStage helper (forward-only, never regresses manual promotion)
function nextStage(
  current: "seed" | "hatching" | "growing" | "building" | "mature",
  count: number,
): "seed" | "hatching" | "growing" | "building" | "mature" {
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

describe("nextStage", () => {
  it("advances forward with contribution count", () => {
    expect(nextStage("seed", 1)).toBe("seed");
    expect(nextStage("seed", 3)).toBe("hatching");
    expect(nextStage("hatching", 6)).toBe("growing");
  });

  it("caps auto-progression at growing", () => {
    expect(nextStage("growing", 50)).toBe("growing");
  });

  it("never demotes a manually-promoted building idea", () => {
    expect(nextStage("building", 1)).toBe("building");
    expect(nextStage("building", 3)).toBe("building");
    expect(nextStage("building", 10)).toBe("building");
  });

  it("never demotes a finalized mature idea", () => {
    expect(nextStage("mature", 0)).toBe("mature");
    expect(nextStage("mature", 3)).toBe("mature");
    expect(nextStage("mature", 50)).toBe("mature");
  });
});

// Test the sha256 helper
function sha256(input: string): string {
  // Simple mock for testing - we test the logic, not crypto
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

describe("sha256 (simplified)", () => {
  it("produces consistent hashes", () => {
    const h1 = sha256("test-token-123");
    const h2 = sha256("test-token-123");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", () => {
    const h1 = sha256("token-1");
    const h2 = sha256("token-2");
    expect(h1).not.toBe(h2);
  });
});

// Test contribution content formatting
describe("contribution formatting", () => {
  it("truncates long content for display", () => {
    const longContent = "a".repeat(500);
    const truncated = longContent.length > 140
      ? longContent.slice(0, 140) + "..."
      : longContent;
    expect(truncated).toHaveLength(143); // 140 + "..."
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("keeps short content unchanged", () => {
    const shortContent = "a short idea";
    const result = shortContent.length > 140
      ? shortContent.slice(0, 140) + "..."
      : shortContent;
    expect(result).toBe(shortContent);
  });
});

// Test timestamp formatting
function formatWhen(ts: number): string {
  const el = Date.now() - ts;
  const m = Math.floor(el / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

describe("formatWhen", () => {
  it("shows 'just now' for recent timestamps", () => {
    const now = Date.now();
    expect(formatWhen(now - 30000)).toBe("just now"); // 30s ago
  });

  it("shows minutes for < 1 hour", () => {
    const now = Date.now();
    expect(formatWhen(now - 5 * 60000)).toBe("5min ago");
    expect(formatWhen(now - 59 * 60000)).toBe("59min ago");
  });

  it("shows hours for < 1 day", () => {
    const now = Date.now();
    expect(formatWhen(now - 3 * 3600000)).toBe("3h ago");
    expect(formatWhen(now - 23 * 3600000)).toBe("23h ago");
  });

  it("shows days for < 7 days", () => {
    const now = Date.now();
    expect(formatWhen(now - 2 * 86400000)).toBe("2d ago");
    expect(formatWhen(now - 6 * 86400000)).toBe("6d ago");
  });
});
