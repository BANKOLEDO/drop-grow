export type AgentRole =
  | "research"
  | "design"
  | "content"
  | "tech"
  | "strategy"
  | "budget"
  | "community";

export type ContentKind = "text" | "voice" | "image";

export type IdeaStage = "seed" | "hatching" | "growing" | "building" | "mature";

export interface AgentPersona {
  role: AgentRole;
  name: string;
  tagline: string;
  color: string;
  focus: string[];
  what: string;
}

export const AGENTS: Record<AgentRole, AgentPersona> = {
  research: {
    role: "research",
    name: "Nova",
    tagline: "Curious. Data-driven. Always digging.",
    color: "#1f9d55",
    focus: ["market data", "competitors", "sources", "references"],
    what: "Checks whether anyone wants this. Looks for real demand, comparable ideas, and useful references before you invest time.",
  },
  design: {
    role: "design",
    name: "Palette",
    tagline: "Creative. Visual. Shapes the identity.",
    color: "#ec4d21",
    focus: ["visual identity", "layouts", "brand", "aesthetics"],
    what: "Gives the idea its look and feel. The name, colours, and visual style that make it recognisable.",
  },
  content: {
    role: "content",
    name: "Quill",
    tagline: "Organized. Structured. Words that land.",
    color: "#a97609",
    focus: ["calendars", "outlines", "copy", "messaging"],
    what: "Writes what people will actually see. The pitch, the posts, the calendar of what to publish first.",
  },
  tech: {
    role: "tech",
    name: "Circuit",
    tagline: "Pragmatic. Efficient. Ships real things.",
    color: "#2f7fe0",
    focus: ["stack", "cost estimates", "implementation", "architecture"],
    what: "Figures out the practical how. What tools to use and how to actually build it without overcomplicating.",
  },
  strategy: {
    role: "strategy",
    name: "Apex",
    tagline: "Forward-thinking. Maps the path.",
    color: "#7a5ce0",
    focus: ["action plans", "milestones", "timelines", "risks"],
    what: "Turns everything into a step-by-step plan. The milestones, the order to do things, and what could go wrong.",
  },
  budget: {
    role: "budget",
    name: "Ledger",
    tagline: "Practical. Cautious. Every dollar matters.",
    color: "#6a7268",
    focus: ["cost breakdown", "funding", "grants", "budget"],
    what: "Works out the money. What it costs to start and run, and what it takes to become self-funding.",
  },
  community: {
    role: "community",
    name: "Planner",
    tagline: "The planner. Pulls every thread into one clear direction.",
    color: "#157a41",
    focus: ["synthesis", "connections", "next steps"],
    what: "The final step. Reads everything the other six came up with and compiles it into one clear, agreed direction.",
  },
};

export const AGENT_NAMES: Record<AgentRole, string> = {
  research: "Nova",
  design: "Palette",
  content: "Quill",
  tech: "Circuit",
  strategy: "Apex",
  budget: "Ledger",
  community: "Planner",
};

export const CONTENT_KIND_META: Record<ContentKind, { label: string; glyph: string }> = {
  text: { label: "Text", glyph: "text" },
  voice: { label: "Voice", glyph: "voice" },
  image: { label: "Image", glyph: "image" },
};

export const STAGE_LABEL: Record<IdeaStage, string> = {
  seed: "New",
  hatching: "Scoping",
  growing: "Growing",
  building: "Building",
  mature: "Ready",
};

export const STAGE_INDEX: Record<IdeaStage, number> = {
  seed: 0,
  hatching: 1,
  growing: 2,
  building: 3,
  mature: 4,
};
