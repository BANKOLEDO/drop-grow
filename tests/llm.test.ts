import { describe, expect, it, vi, beforeEach } from "vitest";
import { callAllAgents, describeImage } from "../convex/agents/llm";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

function mockGroqResponse(content: string) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

function mockCloudflareResponse(response: string) {
  return {
    ok: true,
    json: async () => ({
      result: { response },
    }),
  };
}

function mockErrorResponse(status: number) {
  return {
    ok: false,
    status,
    text: async () => "error",
  };
}

describe("callAllAgents", () => {
  it("calls all 6 agents concurrently", async () => {
    mockFetch.mockResolvedValue(mockGroqResponse("LLM response"));
    const results = await callAllAgents(
      "a community garden",
      "text",
      [],
      { groq: "test-key" }
    );
    expect(results.size).toBe(6);
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it("returns groq provider when groq succeeds", async () => {
    mockFetch.mockResolvedValue(mockGroqResponse("Groq says hi"));
    const results = await callAllAgents(
      "test idea",
      "text",
      [],
      { groq: "test-key" }
    );
    for (const [role, result] of results) {
      expect(result.provider).toBe("groq");
      expect(result.content).toBe("Groq says hi");
    }
  });

  it("falls back to cloudflare when groq fails", async () => {
    // Each of 6 agents: Groq fails, then Cloudflare succeeds
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("groq")) return mockErrorResponse(500);
      if (url.includes("cloudflare")) return mockCloudflareResponse("CF response");
      return mockErrorResponse(404);
    });
    const results = await callAllAgents(
      "test idea",
      "text",
      [],
      { cfAccountId: "acc", cfApiToken: "token" }
    );
    for (const [role, result] of results) {
      expect(result.provider).toBe("cloudflare");
    }
  });

  it("returns deterministic when both fail", async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(500));
    const results = await callAllAgents(
      "test idea",
      "text",
      [],
      { groq: "key", cfAccountId: "acc", cfApiToken: "token" }
    );
    for (const [role, result] of results) {
      expect(result.provider).toBe("deterministic");
      expect(result.content).toBe("");
    }
  });

  it("passes prior texts to LLM", async () => {
    mockFetch.mockResolvedValue(mockGroqResponse("response"));
    await callAllAgents(
      "idea",
      "text",
      ["prior contribution 1", "prior contribution 2"],
      { groq: "key" }
    );
    // Check that the request body includes prior context
    const firstCall = mockFetch.mock.calls[0];
    const body = JSON.parse(firstCall[1].body);
    expect(body.messages[1].content).toContain("prior contribution 1");
  });

  it("handles timeout gracefully", async () => {
    // Mock fetch to simulate a slow response that gets aborted
    mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
      // Wait for the abort signal
      await new Promise<void>((resolve) => {
        init.signal?.addEventListener("abort", () => resolve());
        // Also resolve after a short time in case abort doesn't fire
        setTimeout(resolve, 100);
      });
      return mockErrorResponse(408);
    });
    const results = await callAllAgents(
      "idea",
      "text",
      [],
      { groq: "key" }
    );
    for (const [role, result] of results) {
      expect(result.provider).toBe("deterministic");
    }
  }, 15000);
});

describe("describeImage", () => {
  it("returns description on success", async () => {
    mockFetch.mockResolvedValue(mockCloudflareResponse("A photo of a garden"));
    const result = await describeImage("acc", "token", "https://example.com/img.jpg");
    expect(result).toBe("A photo of a garden");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(500));
    const result = await describeImage("acc", "token", "https://example.com/img.jpg");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValue(new Error("network"));
    const result = await describeImage("acc", "token", "https://example.com/img.jpg");
    expect(result).toBeNull();
  });
});
