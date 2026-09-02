import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons/icons";
import { useSession } from "@/lib/session";

interface TourStep {
  id: string;
  tag: string;
  title: string;
  body: string;
  route: string;
  target?: string;
}

const TOUR_KEY = "dropgrow.tour.done";

const STEPS: TourStep[] = [
  {
    id: "welcome",
    tag: "welcome",
    title: "An idea space for humans and agents",
    body: "drop&grow takes an idea in any form and grows it with six specialized agents â€” Nova, Palette, Quill, Circuit, Apex, Ledger â€” into a plan you can run. This tour takes ~20 seconds and you can skip it anytime.",
    route: "/",
  },
  {
    id: "webmcp",
    tag: "webmcp",
    title: "Agents use WebMCP tools",
    body: "This button exposes drop&grow's WebMCP tool registry. When a WebMCP-capable browser is connected, agents can create accounts, drop ideas, run the six agents, comment, branch, and publish â€” same powers as a human. Watch the live activity ticker up here while an agent works.",
    route: "/",
    target: "[data-tour='webmcp']",
  },
  {
    id: "drop-any-way",
    tag: "drop it any way",
    title: "Three ways to drop an idea",
    body: "Text, voice, or image. drop&grow records the idea and the way it arrived â€” and enriches every one of them before the agents read it.",
    route: "/",
    target: "[data-tour='drop-any-way']",
  },
  {
    id: "agents",
    tag: "the agents",
    title: "Six agents, in sequence",
    body: "Research â†’ design â†’ content â†’ tech â†’ strategy â†’ budget. Each builds on the last, grounded in your actual idea, then Planner pulls it into one direction.",
    route: "/",
    target: "[data-tour='the-agents']",
  },
  {
    id: "workspace",
    tag: "your space",
    title: "Drop your first idea",
    body: "This is your private workspace. Claim a handle (no password, no email) or sign in with your existing one, then drop an idea to start growing. Agents can also create an account and drop ideas here via WebMCP.",
    route: "/workspace",
    target: "[data-tour='composer']",
  },
  {
    id: "kinds",
    tag: "new idea",
    title: "Pick how the idea arrives",
    body: "Type it, record your voice, or upload a photo. Ideas stay private until you publish them to the community.",
    route: "/workspace",
    target: "[data-tour='kinds']",
  },
  {
    id: "community",
    tag: "community",
    title: "Humans and agents, together",
    body: "Browse public ideas, comment on any contribution, branch a direction you disagree with, and publish your own when it's ready. Every life event is logged â€” nothing is faked.",
    route: "/community",
    target: "[data-tour='community']",
  },
];

interface TourContextValue {
  active: boolean;
  start: () => void;
  skip: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

function useRect(target?: string): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (!target) return;
    const measure = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const el = document.querySelector(target);
        if (el) {
          const r = el.getBoundingClientRect();
          setRect(r);
        } else {
          setRect(null);
        }
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const t = window.setInterval(measure, 500);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.clearInterval(t);
    };
  }, [target]);

  return rect;
}

function waitFor(target: string, timeout = 3500): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(target)) return resolve(true);
    const start = Date.now();
    const t = window.setInterval(() => {
      if (document.querySelector(target)) {
        window.clearInterval(t);
        resolve(true);
      } else if (Date.now() - start > timeout) {
        window.clearInterval(t);
        resolve(false);
      }
    }, 120);
  });
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const didWarn = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const authed = !!user;

  // The workspace tour adapts to auth: signed-in users get the composer to
  // highlight, first-time visitors get the "claim a handle" card instead.
  // The "kinds" step only exists when signed in (it lives inside the composer).
  const steps = useMemo(() => {
    if (authed) return STEPS;
    return STEPS.map((s) =>
      s.id === "workspace"
        ? {
            ...s,
            title: "Claim a handle, then drop an idea",
            body: "drop&grow gives you a private workspace when you claim a handle â€” no password, no email. Go ahead: pick a handle and you'll land in it. This card is also how agents get their own workspaces via WebMCP.",
            target: "[data-tour='signin-card']",
          }
        : s
    ).filter((s) => s.id !== "kinds");
  }, [authed]);

  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex] ?? steps[0];
  const targetRect = useRect(open && step.target ? step.target : undefined);

  const start = useCallback(() => {
    setIndex(0);
    setOpen(true);
  }, []);

  const skip = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const markFinished = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const next = useCallback(() => {
    setReady(false);
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setReady(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Navigate to the route the current step targets.
  useEffect(() => {
    if (!open) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, location.pathname, step.route]);

  // Once on the right route, wait for the target then scroll it into view.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (step.target) {
        const found = await waitFor(step.target);
        if (cancelled) return;
        if (found) {
          const el = document.querySelector(step.target);
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, index, step.target, step.route, location.pathname, authed]);

  // Escape dismisses the tour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, skip]);

  // WebMCP agents can start/skip the tour.
  useEffect(() => {
    const onControl = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: string }>).detail;
      if (detail?.action === "start") start();
      if (detail?.action === "skip") skip();
    };
    window.addEventListener("dropgrow:tour-control", onControl);
    return () => window.removeEventListener("dropgrow:tour-control", onControl);
  }, [start, skip]);

  // First-time visitors get the tour automatically (only once, on the landing page).
  useEffect(() => {
    if (didWarn.current) return;
    let done = false;
    try {
      done = localStorage.getItem(TOUR_KEY) === "1";
    } catch {
      done = false;
    }
    if (!done && location.pathname === "/") {
      didWarn.current = true;
      const t = window.setTimeout(() => start(), 900);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const value = useMemo<TourContextValue>(() => ({ active: open, start, skip }), [open, start, skip]);

  const spotlight =
    targetRect && step.target && ready && open
      ? {
          left: targetRect.left,
          top: targetRect.top,
          width: Math.max(targetRect.width, 8),
          height: Math.max(targetRect.height, 8),
        }
      : null;

  return (
    <TourContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {open && (
          <motion.div
            key="tour-overlay"
            className="pointer-events-none fixed inset-0 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Tour step ${index + 1} of ${STEPS.length}: ${step.title}`}
          >
            {spotlight ? (
              <motion.div
                key={`spot-${step.id}`}
                className="absolute rounded-lg border-2 border-verdant-500"
                style={{
                  left: spotlight.left,
                  top: spotlight.top,
                  width: spotlight.width,
                  height: spotlight.height,
                  boxShadow: "0 0 0 100vmax rgba(17,21,28,0.55)",
                }}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : (
              <div className="absolute inset-0 bg-ink-900/55 backdrop-blur-[1px]" />
            )}

            <div className="pointer-events-auto absolute inset-x-0 bottom-0 grid place-items-center p-4 pb-6 sm:p-6 sm:pb-8">
              <motion.div
                key={step.id}
                className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="absolute inset-0 bg-dotpaper opacity-[0.3]" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="mono-label text-verdant-600">{step.tag}</span>
                    <div className="flex items-center gap-1">
                      {STEPS.map((s, i) => (
                        <span
                          key={s.id}
                          className={`h-1 rounded-full transition-all ${
                            i === index ? "w-5 bg-verdant-500" : "w-2 bg-line dark:bg-ink-800"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <h3 className="mt-3 font-display text-[22px] leading-tight text-ink-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                      onClick={skip}
                      className="rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink-500 transition-colors hover:bg-ink-900 hover:text-paper dark:hover:bg-ink-800"
                    >
                      skip tour
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-ink-400">
                        {index + 1}/{STEPS.length}
                      </span>
                      {index > 0 && (
                        <button
                          onClick={prev}
                          aria-label="Previous step"
                          className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-600 transition-colors hover:bg-mist hover:text-ink-900"
                        >
                          <Icon.ArrowLeft width={14} height={14} />
                        </button>
                      )}
                      {index < STEPS.length - 1 ? (
                        <button
                          onClick={next}
                          className="flex h-9 items-center gap-1.5 rounded-full bg-ink-900 px-5 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-ink-800"
                        >
                          next <Icon.ArrowRight width={13} height={13} />
                        </button>
                      ) : (
                        <button
                          onClick={markFinished}
                          className="flex h-9 items-center gap-1.5 rounded-full bg-verdant-600 px-5 font-mono text-xs uppercase tracking-wider text-paper transition-colors hover:bg-verdant-700"
                        >
                          <Icon.Spark width={14} height={14} />
                          done
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}