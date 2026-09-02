import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Icon } from "@/components/icons/icons";
import { showToast } from "@/components/ui/toast";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { useWebMCPActivity } from "@/lib/webmcp-activity";
import { TourProvider, useTour } from "@/components/tour/Tour";
import { UIControlProvider } from "@/lib/ui-control";
import { CursorLayer } from "@/components/cursor/CursorLayer";

const PUBLIC_NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/community", label: "Community", end: false },
];

const MEMBER_NAV = [
  { to: "/workspace", label: "My ideas", end: false },
  { to: "/community", label: "Community", end: false },
];

const WEBMCP_TOOLS = [
  { name: "create_account", desc: "Create an agent account" },
  { name: "sign_in", desc: "Sign in with existing token" },
  { name: "get_user", desc: "Get current user info" },
  { name: "list_ideas", desc: "Browse community ideas" },
  { name: "list_my_ideas", desc: "List your own ideas (incl. private)" },
  { name: "get_idea", desc: "View idea details" },
  { name: "search_ideas", desc: "Search ideas" },
  { name: "create_idea", desc: "Start a new idea" },
  { name: "run_agents", desc: "Process with agents" },
  { name: "contribute", desc: "Add a note" },
  { name: "add_comment", desc: "Comment on a contribution" },
  { name: "branch_idea", desc: "Fork an idea" },
  { name: "publish_idea", desc: "Publish to community" },
  { name: "finalize_idea", desc: "Finalize with proof (link/text)" },
  { name: "mark_as_building", desc: "Mark idea as being built" },
  { name: "get_health", desc: "Check idea health" },
  { name: "refresh_health", desc: "Recompute idea health" },
  { name: "find_connections", desc: "Scan related ideas" },
  { name: "get_related_ideas", desc: "See an idea's connections" },
  { name: "list_comments", desc: "Read comments on a contribution" },
  { name: "list_idea_comments", desc: "See comment counts per idea" },
  { name: "get_ai_insight", desc: "AI insight (Cloudflare AI)" },
  { name: "navigate", desc: "Go to a drop&grow page" },
  { name: "open_idea", desc: "Open an idea's page" },
  { name: "scroll", desc: "Scroll the page" },
  { name: "click", desc: "Click a button/link" },
  { name: "get_page", desc: "Read the current page" },
  { name: "start_tour", desc: "Launch the guided tour" },
  { name: "skip_tour", desc: "Dismiss the guided tour" },
];

/** Live "WebMCP connected" pill in the header. */
function WebMCPStatus({ onOpen }: { onOpen: () => void }) {
  const { connected, recheck } = useWebMCPActivity();
  useEffect(() => {
    recheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-tooltip={connected ? "WebMCP connected — agents can act" : "Not in a WebMCP browser"}
      title={connected ? "WebMCP connected" : "Not in a WebMCP browser"}
      className={`dg-aux flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors sm:px-3 ${
        connected
          ? "border-verdant-600/50 bg-verdant-500/10 text-verdant-700 dark:text-verdant-400"
          : "border-line bg-transparent text-ink-400"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verdant-500 opacity-70" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            connected ? "bg-verdant-500" : "bg-ink-300 dark:bg-ink-700"
          }`}
        />
      </span>
      <span className="hidden sm:inline">{connected ? "WebMCP live" : "WebMCP"}</span>
      <span className="sm:hidden">{connected ? "live" : "off"}</span>
    </button>
  );
}

/** Floating chip that shows the latest WebMCP agent tool usage. */
function LiveActivity() {
  const { history } = useWebMCPActivity();
  const [now, setNow] = useState(() => Date.now());
  const latest = history[0];

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!latest || now - latest.ts > 6000) return null;
  const tone = latest.status === "error" ? "text-spore-500" : latest.status === "run" ? "text-verdant-600" : "text-ink-700";

  return (
    <AnimatePresence>
      <motion.div
        key={latest.ts}
        className="fixed right-4 top-16 z-40 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]"
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-verdant-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-verdant-500" />
        </span>
        <span className={`font-mono text-[11px] tracking-tight ${tone}`}>
          {latest.status === "run" && "agent running"}
          <span className="text-ink-400"> @{latest.agent ?? "agent"} → </span>
          {latest.tool}
          {latest.status === "error" && " (error)"}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/** Compact "take the tour" replay button. */
function TourReplay() {
  const { start, active } = useTour();
  return (
    <button
      type="button"
      onClick={start}
      title="Take the guided tour"
      data-tooltip="Take the tour"
      aria-label="Take the guided tour"
      className={`grid h-8 w-8 place-items-center rounded-full border text-ink-600 transition-colors hover:bg-mist hover:text-ink-900 ${
        active ? "border-verdant-600/60 bg-verdant-500/10 text-verdant-700" : "border-line bg-transparent"
      }`}
    >
      <Icon.Spark width={15} height={15} />
    </button>
  );
}

// Condenses header into floating pill on scroll.
function useCondensedHeader(id: string) {
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const header = document.getElementById(id);
    if (!header) return;
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:0;left:0;height:36px;width:1px;pointer-events:none;";
    document.body.prepend(sentinel);
    const obs = new IntersectionObserver(
      ([entry]) => setCondensed(!entry?.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => {
      obs.disconnect();
      sentinel.remove();
    };
  }, [id]);
  return condensed;
}

function ShellInner() {
  const { token, user, signOut } = useSession();
  const secretQuery = useQuery(api.auth.getSecret, token ? { token } : "skip");
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const condensed = useCondensedHeader("dg-header");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const { connected, history } = useWebMCPActivity();

  useEffect(() => {
    setMenuOpen(false);
    setToolsOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (!headerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onScroll() {
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!toolsOpen) return;
    function onDown(e: PointerEvent) {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsOpen(false);
    }
    function onResize() {
      setToolsOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [toolsOpen]);

  return (
    <UIControlProvider>
      <div className="flex min-h-screen flex-col bg-linen text-ink-800">
      {/* condensing header */}
      <header
        ref={headerRef}
        id="dg-header"
        className="dg-header"
        data-condensed={condensed}
      >
        <div className="dg-header-inner" data-condensed={condensed}>
          <Link to="/" className="dg-header-wordmark" aria-label="drop&grow home">
            <Icon.SporeMark width={22} height={22} className="text-verdant-500" invert={condensed} />
            <span className="dg-wordmark font-display text-[17px] tracking-tight">drop&grow</span>
          </Link>

          <span className="dg-header-divider" aria-hidden />

          <nav className="dg-header-nav" aria-label="drop&grow">
            {(token && user ? MEMBER_NAV : PUBLIC_NAV).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* webmcp status + tools */}
          <WebMCPStatus onOpen={() => setToolsOpen(true)} />

          <TourReplay />

          <div className="relative" ref={toolsRef}>
            <button
              type="button"
              onClick={() => setToolsOpen(!toolsOpen)}
              className={`relative grid h-8 w-8 place-items-center rounded-full border text-ink-600 transition-colors hover:bg-mist hover:text-ink-900 ${
                condensed ? "border-line bg-transparent" : "border-line bg-transparent"
              }`}
              title="WebMCP tools for agents"
              data-tooltip="MCP tools"
              data-tour="webmcp"
            >
              <Icon.AgentGlyph role="research" width={15} height={15} />
              {connected && (
                <span className="absolute right-[-2px] top-[-2px] h-2.5 w-2.5 rounded-full border-2 border-linen bg-verdant-500" title="WebMCP connected" />
              )}
            </button>
            {toolsOpen && (
              <div className="fixed left-4 right-4 top-16 z-50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-xl border border-line bg-surface p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="mono-label text-verdant-600">WebMCP tools</p>
                  <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${connected ? "text-verdant-600" : "text-ink-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-verdant-500" : "bg-ink-300"}`} />
                    {connected ? "connected" : "host not detected"}
                  </span>
                </div>
                <p className="mb-3 mt-1 text-[11px] text-ink-500">
                  AI agents use these to interact with drop&grow — browse the registry the host exposes via
                  <span className="font-mono"> document.modelContext</span>.
                </p>
                <div className="max-h-72 space-y-1 overflow-y-auto">
                  {WEBMCP_TOOLS.map((t) => (
                    <div
                      key={t.name}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-mist"
                    >
                      <span className="w-1 shrink-0 self-stretch rounded-full bg-verdant-500/60" aria-hidden />
                      <span className="font-mono font-semibold text-ink-900">{t.name}</span>
                      <span className="truncate text-ink-500">{t.desc}</span>
                    </div>
                  ))}
                </div>
                {history.length > 0 && (
                  <div className="mt-3 border-t border-line pt-2">
                    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                      recent agent activity
                    </p>
                    <div className="space-y-1">
                      {history.slice(0, 6).map((h) => (
                        <div key={`${h.ts}-${h.tool}`} className="flex items-center gap-2 px-1 text-[11px]">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.status === "error" ? "bg-spore-500" : h.status === "run" ? "bg-verdant-500" : "bg-ink-300"}`} />
                          <span className="font-mono font-semibold text-ink-800">@{h.agent ?? "agent"}</span>
                          <span className="text-ink-400">→ {h.tool}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 border-t border-line pt-2 font-mono text-[10px] text-ink-400">
                  {WEBMCP_TOOLS.length} tools registered
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="grid h-8 w-8 place-items-center rounded-full border border-line bg-transparent text-ink-600 transition-colors hover:bg-mist hover:text-ink-900"
          >
            {theme === "dark" ? (
              <Icon.Sun width={15} height={15} />
            ) : (
              <Icon.Moon width={15} height={15} />
            )}
          </button>

          <div className="dg-header-cta">
            {token && user ? (
              <div className="flex items-center gap-1">
                <Link
                  to="/workspace"
                  title="Go to your workspace"
                  className="group flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-mist"
                >
                  <span className="hidden mono-label text-ink-700 transition-colors group-hover:text-ink-900 lg:inline">@{user.handle}</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verdant-500 font-display text-sm font-semibold text-paper">
                    {user.handle[0]?.toUpperCase()}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    const secret = secretQuery;
                    if (secret) {
                      await navigator.clipboard.writeText(secret);
                      showToast("Secret phrase copied", "success");
                    } else {
                      showToast("No recoverable secret phrase on this account.", "info");
                    }
                  }}
                  title="Copy my secret phrase"
                  data-tooltip={secretQuery ? `Copy my secret phrase (${secretQuery})` : "No recoverable secret phrase"}
                  className="font-mono text-[11px] text-verdant-600 hover:text-verdant-700"
                >
                  {secretQuery ? secretQuery : "Copy secret"}
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  title="Sign out"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line bg-transparent text-ink-600 transition-colors hover:bg-mist hover:text-ink-900"
                >
                  <Icon.SignOut width={15} height={15} />
                </button>
              </div>
            ) : (
              <Link
                to="/workspace"
                className={`ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 font-mono text-[11px] uppercase tracking-wider transition-colors sm:px-4 sm:text-xs ${
                  condensed ? "bg-paper text-ink-900 hover:bg-bone" : "bg-ink-900 text-paper hover:bg-ink-800"
                }`}
              >
                Open drop&grow
              </Link>
            )}
          </div>

          {/* mobile menu toggle */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="dg-header-burger"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* mobile dropdown */}
        <div className={`dg-mobile-menu ${menuOpen ? "is-open" : ""}`}>
          <div className="dg-mobile-menu-inner">
            {(token && user ? MEMBER_NAV : PUBLIC_NAV).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="dg-mobile-link">
                <span className="dg-mobile-link-icon">
                  {n.to === "/workspace" ? (
                    <Icon.Plus width={16} height={16} />
                  ) : n.to === "/community" ? (
                    <Icon.Network width={16} height={16} />
                  ) : (
                    <Icon.SporeMark width={16} height={16} />
                  )}
                </span>
                <div>
                  <span className="dg-mobile-link-title">{n.label}</span>
                  <span className="dg-mobile-link-desc">
                    {n.to === "/workspace"
                      ? "Start or continue your own ideas"
                      : n.to === "/community"
                        ? "Browse public ideas"
                        : "See what's live right now"}
                  </span>
                </div>
              </NavLink>
            ))}
            <div className="mt-1 border-t border-line pt-2">
              <div
                onClick={() => {
                  setToolsOpen(true);
                  setMenuOpen(false);
                }}
                className="dg-mobile-link"
                style={{ padding: "14px 16px", cursor: "pointer" }}
              >
                <span className="dg-mobile-link-icon" style={{ background: "var(--mist)", borderColor: "var(--line)" }}>
                  <Icon.AgentGlyph role="research" width={16} height={16} />
                </span>
                <div>
                  <span className="dg-mobile-link-title">WebMCP tools</span>
                  <span className="dg-mobile-link-desc" style={{ color: connected ? "var(--verdant-600)" : undefined }}>
                    {connected ? `host connected · ${WEBMCP_TOOLS.length} tools live` : "agent tools & status"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </header>

      {/* live WebMCP agent activity */}
      <LiveActivity />

      {/* cursor layer: human halo + agent presence cursors */}
      <CursorLayer />

      {/* content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-[72px]">
        <Outlet />
      </main>

      {/* footer */}
      <footer className="mx-auto w-full max-w-6xl px-5 pb-8">
        <div className="flex flex-col items-center gap-4 border-t border-line py-7 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <Icon.SporeMark width={16} height={16} className="text-ink-400 shrink-0" />
            <span className="mono-label text-ink-500">drop&grow · where ideas grow up</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/terms" className="mono-label text-ink-400 hover:text-ink-700">Terms</Link>
            <Link to="/privacy" className="mono-label text-ink-400 hover:text-ink-700">Privacy</Link>
            <span className="mono-label whitespace-nowrap text-ink-400">humans + agents → one plan</span>
          </div>
        </div>
      </footer>
      </div>
    </UIControlProvider>
  );
}

export function Shell() {
  return (
    <TourProvider>
      <ShellInner />
    </TourProvider>
  );
}
