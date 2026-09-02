import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface UIControlRequest {
  action:
    | "navigate"
    | "scroll"
    | "click"
    | "get_page"
    | "open_idea";
  route?: string;
  ideaId?: string;
  direction?: "up" | "down" | "top" | "bottom";
  amount?: number;
  selector?: string;
  text?: string;
  resolve?: (value: unknown) => void;
}

const UIControlContext = createContext<{ connected: boolean } | null>(null);

type Listener = (detail: UIControlRequest) => void;

// Global listeners so the module can bridge outside React (used by WebMCP tools).
const listeners = new Set<Listener>();

export function dispatchUIControl(detail: UIControlRequest) {
  listeners.forEach((fn) => fn(detail));
}

/**
 * React-side bridge for WebMCP UI-control tools (navigate, scroll, click, read).
 * It lives inside the router tree so `navigate` resolves to React Router rather
 * than a full page reload. Actions are acknowledged back through `detail.resolve`
 * so the calling WebMCP tool can report success/failure.
 */
export function UIControlProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  const locationRef = useRef(location);
  const connected = useMemo(() => listeners.size > 0, []);

  useEffect(() => {
    navigateRef.current = navigate;
    locationRef.current = location;
  }, [navigate, location]);

  useEffect(() => {
    const handler: Listener = (detail) => {
      const ok = processUIControl(detail, navigateRef.current, locationRef.current);
      detail.resolve?.(ok);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return (
    <UIControlContext.Provider value={{ connected }}>
      {children}
    </UIControlContext.Provider>
  );
}

export function useUIControl() {
  const ctx = useContext(UIControlContext);
  return ctx ?? { connected: false };
}

const ROUTE_ALIASES: Record<string, string> = {
  home: "/",
  landing: "/",
  overview: "/",
  workspace: "/workspace",
  myideas: "/workspace",
  my_ideas: "/workspace",
  community: "/community",
  terms: "/terms",
  privacy: "/privacy",
};

interface PageElement {
  tag: string;
  role?: string | null;
  text: string | null;
  selector: string;
  ariaLabel?: string | null;
}

function buildSelectorFor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const dataTour = el.getAttribute("data-tour");
  if (dataTour) return `[data-tour="${dataTour}"]`;
  const classes = Array.from(el.classList)
    .slice(0, 2)
    .map((c) => `.${c}`)
    .join("");
  if (classes) return `${tag}${classes}`;
  const nth = Array.from(el.parentElement?.children ?? []).indexOf(el) + 1;
  return `${tag}:nth-child(${Math.max(nth, 1)})`;
}

function collectInteractive(root: Document): PageElement[] {
  const els = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], input, textarea, select, [data-tour]'
    )
  );
  const out: PageElement[] = [];
  for (const el of els) {
    const text = el.getAttribute("aria-label") || el.textContent?.trim() || null;
    out.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      text,
      selector: buildSelectorFor(el),
      ariaLabel: el.getAttribute("aria-label"),
    });
  }
  return out;
}

function findClickable(raw: string, root: Document | null): HTMLElement | null {
  const doc = root ?? document;
  // exact text match on button / link / any element
  const wanted = raw.trim().toLowerCase();
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      'button, a, [role="button"], [data-tour], [role="menuitem"]'
    )
  );
  for (const el of candidates) {
    const label =
      el.getAttribute("aria-label")?.toLowerCase() ||
      el.textContent?.trim().toLowerCase() ||
      "";
    if (label === wanted) return el;
  }
  for (const el of candidates) {
    const label =
      el.getAttribute("aria-label")?.toLowerCase() ||
      el.textContent?.trim().toLowerCase() ||
      "";
    if (label.includes(wanted)) return el;
  }
  // fall back to CSS selector
  try {
    const bySel = doc.querySelector<HTMLElement>(raw);
    if (bySel) return bySel;
  } catch {
    /* not a valid selector */
  }
  return null;
}

interface SectionInfo {
  title: string;
  index?: string;
  selector: string;
  id?: string;
  kind: "header" | "explainer" | "heading";
}

/** Extract the meaningful page sections the agent can scroll to by name.
 *  Components opt in by rendering data-section (SectionHeader, Explainer). */
function collectSections(root: Document): SectionInfo[] {
  const doc = root;
  const out: SectionInfo[] = [];

  for (const el of Array.from(
    doc.querySelectorAll<HTMLElement>("[data-section]")
  )) {
    const slug = el.getAttribute("data-section") || "";
    const h = el.querySelector<HTMLElement>("h1, h2, h3, .mono-label");
    const title = h?.textContent?.trim() || slug;
    const row = h?.parentElement ?? el;
    const index = row.querySelector<HTMLElement>(".index-tag")?.textContent?.trim();
    if (out.some((s) => s.id === slug)) continue;
    out.push({
      title,
      index,
      selector: `[data-section="${slug}"]`,
      id: `section-${slug}`,
      kind: index ? "header" : "explainer",
    });
  }

  return out;
}

function findScrollTarget(raw: string, root: Document | null): HTMLElement | null {
  const doc = root ?? document;
  const wanted = raw.trim().toLowerCase();
  // element id
  if (doc.getElementById(raw)) return doc.getElementById(raw);
  // data-section slug (from SectionHeader/Explainer anchors)
  const bySection = doc.querySelector<HTMLElement>(`[data-section="${raw}"]`);
  if (bySection) return bySection;
  // data-tour name
  const byTour = doc.querySelector<HTMLElement>(`[data-tour="${raw}"]`);
  if (byTour) return byTour;
  // exact visible-text match on section headings / index tags first
  const headCandidates = Array.from(
    doc.querySelectorAll<HTMLElement>("[data-section] h1, [data-section] h2, [data-section] h3, [data-section] .mono-label, .index-tag")
  );
  for (const el of headCandidates) {
    const label = el.textContent?.trim().toLowerCase() || "";
    if (label === wanted) return el;
  }
  for (const el of headCandidates) {
    const label = el.textContent?.trim().toLowerCase() || "";
    if (label.includes(wanted)) return el;
  }
  // any element id/name/aria/visible text
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[id], [data-tour], button, a, [role="button"], h1, h2, h3, section'
    )
  );
  for (const el of candidates) {
    const label =
      el.getAttribute("aria-label")?.toLowerCase() ||
      el.getAttribute("data-tour")?.toLowerCase() ||
      el.textContent?.trim().toLowerCase() ||
      "";
    if (label === wanted) return el;
  }
  for (const el of candidates) {
    const label =
      el.getAttribute("aria-label")?.toLowerCase() ||
      el.textContent?.trim().toLowerCase() ||
      "";
    if (label.includes(wanted)) return el;
  }
  // fall back to CSS child combinator selectors
  try {
    const bySel = doc.querySelector<HTMLElement>(raw);
    if (bySel) return bySel;
  } catch {
    /* not a valid selector */
  }
  return null;
}

function processUIControl(
  detail: UIControlRequest,
  navigate: (route: string) => void,
  currentLocation: { pathname: string }
): unknown {
  switch (detail.action) {
    case "navigate": {
      let route = detail.route ?? "/";
      if (route in ROUTE_ALIASES) route = ROUTE_ALIASES[route];
      if (!route.startsWith("/")) route = `/${route}`;
      navigate(route);
      return { ok: true, message: `Navigated to ${route}` };
    }
    case "open_idea": {
      if (!detail.ideaId) return { error: "ideaId is required" };
      const route = `/i/${detail.ideaId}`;
      navigate(route);
      return { ok: true, message: `Opened idea ${detail.ideaId}`, route };
    }
    case "scroll": {
      // If a section target was given, jump straight to it.
      if (detail.selector) {
        const el = findScrollTarget(detail.selector, document);
        if (!el) return { error: `No element found for '${detail.selector}'` };
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const reached =
          el.textContent?.trim().slice(0, 40) || el.getAttribute("data-tour") || detail.selector;
        return {
          ok: true,
          message: `Scrolled to ${detail.selector}`,
          reached,
          hint: "Call get_page to re-read the current sections and what's now in view.",
        };
      }
      const amount = detail.amount ?? 300;
      switch (detail.direction) {
        case "top":
          window.scrollTo({ top: 0, behavior: "smooth" });
          return { ok: true, message: "Scrolled to top" };
        case "bottom":
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          });
          return { ok: true, message: "Scrolled to bottom" };
        case "down":
        case "up":
          window.scrollBy({ top: (detail.direction === "up" ? -1 : 1) * amount, behavior: "smooth" });
          return { ok: true, message: `Scrolled ${detail.direction} ${amount}px` };
        default:
          return { error: "Specify a direction or a section target to scroll" };
      }
    }
    case "click": {
      const el = findClickable(detail.selector ?? "", document);
      if (!el)
        return {
          error: `Could not find '${detail.selector ?? detail.text}'. Use get_page to see clickable elements.`,
        };
      el.click();
      return { ok: true, message: `Clicked ${detail.selector ?? detail.text}` };
    }
    case "get_page": {
      const interactive = collectInteractive(document);
      const sections = collectSections(document);
      return {
        url: currentLocation.pathname,
        title: document.title,
        sections,
        sectionCount: sections.length,
        interactive,
        count: interactive.length,
      };
    }
    default:
      return { error: `Unknown ui-control action: ${(detail as { action?: string }).action}` };
  }
}