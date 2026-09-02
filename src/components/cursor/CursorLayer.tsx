import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { WebMCPActivityItem } from "@/lib/webmcp-activity";
import { useWebMCPActivity } from "@/lib/webmcp-activity";

const ACTIVE_MS = 9000;

const TOOL_LABEL: Record<string, string> = {
  create_idea: "dropping in",
  run_agents: "running agents",
  contribute: "adding a note",
  add_comment: "commenting",
  branch_idea: "branching",
  publish_idea: "publishing",
  finalize_idea: "finalizing",
  mark_as_building: "marking",
  list_ideas: "browsing ideas",
  list_my_ideas: "reading your ideas",
  search_ideas: "searching",
  get_idea: "reading",
  get_related_ideas: "finding sparks",
  get_health: "checking health",
  refresh_health: "rechecking health",
  find_connections: "connecting dots",
  list_comments: "reading comments",
  list_idea_comments: "reading comments",
  start_tour: "showing the tour",
  skip_tour: "skipping tour",
  get_ai_insight: "thinking",
  create_account: "signing up",
  sign_in: "signing in",
  get_user: "checking who you are",
};

function anchorSelectorFor(tool: string): string | null {
  switch (tool) {
    case "create_idea":
      return `[data-tour="composer"]`;
    case "list_ideas":
    case "search_ideas":
    case "get_related_ideas":
      return `[data-tour="community"]`;
    case "run_agents":
    case "contribute":
    case "add_comment":
    case "get_idea":
    case "get_health":
    case "refresh_health":
    case "finalize_idea":
    case "publish_idea":
    case "mark_as_building":
    case "branch_idea":
    case "find_connections":
    case "list_comments":
    case "list_idea_comments":
      return `[data-agent-anchor="idea"]`;
    default:
      return "main";
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function bubbleSpot(tool: string): { x: number; y: number } {
  const selector = anchorSelectorFor(tool);
  const el = selector ? document.querySelector(selector) : null;
  const win = { w: window.innerWidth, h: window.innerHeight };
  const drift = (hashString(tool) % 5 - 2) * 12;
  if (!el) {
    return { x: win.w / 2 + drift, y: Math.min(190, win.h * 0.16) };
  }
  const r = el.getBoundingClientRect();
  if (selector === "main") {
    return { x: r.left + Math.min(r.width * 0.5, 420) + drift, y: r.top + 90 };
  }
  return { x: r.left + r.width / 2 + drift, y: r.top - 3 };
}

/** A live presence pointer: appears over whatever part of the page a WebMCP agent is acting on. */
function AgentCursorBubble({ item }: { item: WebMCPActivityItem }) {
  const toolLabel = TOOL_LABEL[item.tool] ?? item.tool.replaceAll("_", " ");
  const running = item.status === "run";
  const failed = item.status === "error";
  const tone = failed
    ? "border-spore-500/60 text-spore-500"
    : running
      ? "border-verdant-500 text-verdant-600"
      : "border-ink-300 text-ink-600";
  const spot = bubbleSpot(item.tool);
  const handle = item.agent ?? "agent";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, left: spot.x, top: spot.y }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="pointer-events-none absolute"
      style={{ left: spot.x, top: spot.y }}
    >
      <div className="absolute -translate-x-1/2 -translate-y-full pb-2">
        <div
          className={`flex items-center gap-1.5 rounded-lg border bg-surface px-2 py-1 shadow-[0_10px_26px_-10px_rgba(0,0,0,0.45)] ${tone} ${
            running ? "animate-pulse" : ""
          }`}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold text-paper ${
              failed ? "bg-spore-500" : running ? "bg-verdant-600" : "bg-ink-900"
            }`}
          >
            {handle[0]?.toUpperCase() ?? "A"}
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-mono text-[10px] font-semibold">
              @{handle}
            </span>
            <span className="truncate font-mono text-[9px] uppercase tracking-wider opacity-70">
              {running ? `${toolLabel}…` : toolLabel}
            </span>
          </span>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            {running && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verdant-500 opacity-70" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                failed ? "bg-spore-500" : running ? "bg-verdant-500" : "bg-ink-300"
              }`}
            />
          </span>
        </div>
        <div className="mx-auto mt-[-1px] h-0 w-0 border-x-4 border-t-[6px] border-x-transparent border-t-surface/60" />
        <div
          className={`mx-auto h-0 w-0 border-x-2 border-t-[4px] border-x-transparent ${
            failed ? "border-t-spore-500" : running ? "border-t-verdant-500" : "border-t-ink-700"
          }`}
        />
      </div>
    </motion.div>
  );
}

/** Group recent tool activity by agent and render at most 3 live presence cursors. */
function AgentCursors() {
  const { history } = useWebMCPActivity();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const active = new Map<string, WebMCPActivityItem>();
  for (const item of history) {
    if (now - item.ts > ACTIVE_MS) continue;
    const key = `${item.agent ?? "agent"}-${item.ts}`;
    if (!active.has(key)) active.set(key, item);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[62]" aria-hidden>
      <AnimatePresence>
        {[...active.entries()].slice(0, 3).map(([key, item]) => (
          <AgentCursorBubble key={key} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/** A subtle verdant halo + dot that trails the human's real cursor. */
function CoolCursor() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  if (!enabled) return null;
  return <CoolCursorInner />;
}

const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, summary, label, [role='button'], [data-tooltip], [tabindex]:not([tabindex='-1'])";

function CoolCursorInner() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [overInteractive, setOverInteractive] = useState(false);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const cur = { ...target };
    let raf = 0;
    let shown = false;

    const render = () => {
      cur.x += (target.x - cur.x) * 0.16;
      cur.y += (target.y - cur.y) * 0.16;
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) translate(-50%,-50%)`;
      if (Math.abs(cur.x - target.x) > 0.4 || Math.abs(cur.y - target.y) > 0.4) {
        raf = requestAnimationFrame(render);
      }
    };

    const onMove = (e: MouseEvent) => {
      target = { x: e.clientX, y: e.clientY };
      if (!shown) {
        shown = true;
        setVisible(true);
      }
      setOverInteractive(
        !!(e.target as Element | null)?.closest?.(INTERACTIVE_SELECTOR)
      );
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    const onDown = () => setPressing(true);
    const onUp = () => setPressing(false);
    const onLeave = () => {
      shown = false;
      setVisible(false);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[74]"
      aria-hidden
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s" }}
    >
      <div ref={dotRef} className="absolute left-0 top-0">
        <div
          className={`rounded-full bg-verdant-600 shadow-[0_0_12px_rgba(20,140,74,0.85)] transition-all duration-150 ${
            pressing ? "scale-50" : overInteractive ? "h-3.5 w-3.5" : "h-2 w-2"
          }`}
        />
      </div>
      <div ref={ringRef} className="absolute left-0 top-0">
        <div
          className={`h-9 w-9 rounded-full border transition-all duration-150 ${
            overInteractive
              ? "h-10 w-10 border-spore-500/80"
              : pressing
                ? "border-verdant-700"
                : "border-verdant-500/60"
          }`}
          style={{
            boxShadow: overInteractive
              ? "0 0 20px -2px rgba(225,26,72,0.5)"
              : "0 0 18px -2px rgba(20,140,74,0.45)",
            transform: "rotate(45deg)",
          }}
        />
      </div>
    </div>
  );
}

/** Renders the human's cool cursor + live agent presence cursors. */
export function CursorLayer() {
  return (
    <>
      <AgentCursors />
      <CoolCursor />
    </>
  );
}