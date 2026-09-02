import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AGENTS, STAGE_LABEL, type AgentRole } from "@/lib/domain";
import { isAIEnabled } from "@/lib/cloudflare-ai";

interface Contribution {
  agentRole: AgentRole | null;
  contributorHandle: string;
  content: string;
  impact?: number;
}

interface GrowthVisualizationProps {
  contributions: Contribution[];
  stage: string;
  input: string;
  fitness: number;
  isOwner?: boolean;
}

const STAGES = [
  { key: "seed", label: "New" },
  { key: "hatching", label: "Scoping" },
  { key: "growing", label: "Growing" },
  { key: "building", label: "Building" },
  { key: "mature", label: "Ready" },
];

const AGENT_STEPS: AgentRole[] = [
  "research",
  "design",
  "content",
  "tech",
  "strategy",
  "budget",
  "community",
];

function AgentStep({
  role,
  contribution,
  isLast,
  index,
}: {
  role: AgentRole;
  contribution: Contribution | undefined;
  isLast: boolean;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const a = AGENTS[role];
  const hasDone = !!contribution;

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: "easeOut" }}
      className="relative flex gap-3"
    >
      {!isLast && (
        <span className="absolute left-[13px] top-8 bottom-0 w-px bg-line" />
      )}
      <span
        className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white transition-all duration-300 ${
          hasDone ? "" : "opacity-30 grayscale"
        }`}
        style={{ backgroundColor: hasDone ? a.color : "#9ca3af" }}
      >
        {hasDone ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25, delay: index * 0.08 + 0.2 }}
          >
            ✓
          </motion.span>
        ) : (
          a.name[0]
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink-900">
            {a.name}
          </span>
          <span className="mono-label lowercase">{role}</span>
        </div>
        {hasDone && contribution ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-1 w-full text-left"
          >
            <motion.div
              className="rounded-lg bg-mist p-2.5 text-xs leading-relaxed text-ink-700 whitespace-pre-wrap cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={expanded ? "full" : "short"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {expanded ? (
                    contribution.content
                  ) : contribution.content.length > 140 ? (
                    contribution.content.slice(0, 140) + "..."
                  ) : (
                    contribution.content
                  )}
                  {contribution.content.length > 140 && (
                    <span className="ml-1 font-mono text-[10px] text-ink-500 dark:text-ink-600">
                      {expanded ? "(click to collapse)" : "(click to expand)"}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </button>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-ink-500 italic">
            {a.what}
          </p>
        )}
      </div>
    </motion.li>
  );
}

export function GrowthVisualization({
  contributions,
  stage,
  input,
  fitness,
  isOwner = false,
}: GrowthVisualizationProps) {
  const aiEnabled = isAIEnabled();

  const byStep = useMemo(() => {
    const map = new Map<AgentRole, Contribution>();
    for (const c of contributions) {
      if (c.agentRole && !map.has(c.agentRole)) {
        map.set(c.agentRole, c);
      }
    }
    return map;
  }, [contributions]);

  const humanNotes = useMemo(
    () => contributions.filter((c) => c.agentRole === null),
    [contributions],
  );

  const stageIndex = STAGES.findIndex((s) => s.key === stage);
  const score = Math.min(100, Math.max(0, Math.round(fitness)));
  const doneCount = byStep.size;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-line bg-surface p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink-900">
              {STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage}
            </p>
            <p className="font-mono text-[11px] text-ink-500">
              {doneCount} of {AGENT_STEPS.length} agents have helped
              {aiEnabled ? " (AI-enhanced)" : ""}
            </p>
          </div>
          <span className="font-display text-2xl font-bold text-verdant-500">
            {score}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-200">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="h-full rounded-full bg-verdant-500"
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-600">
          {STAGES.map((s) => (
            <span
              key={s.key}
              className={
                STAGES.indexOf(s) <= stageIndex
                  ? "font-semibold text-verdant-600"
                  : ""
              }
            >
              {s.label}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Agent pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-xl border border-line bg-surface p-4"
      >
        <p className="mono-label mb-3 text-verdant-600">
          how the team grew this idea
        </p>
        <ol className="space-y-3">
          {AGENT_STEPS.map((role, i) => (
            <AgentStep
              key={role}
              role={role}
              contribution={byStep.get(role)}
              isLast={i === AGENT_STEPS.length - 1}
              index={i}
            />
          ))}
        </ol>
      </motion.div>

      {/* Human notes */}
      <AnimatePresence>
        {humanNotes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
          >
            <p className="mono-label mb-3 text-amber-600">
              {isOwner ? "your notes" : "notes from real people"}
            </p>
            <ul className="space-y-2">
              {humanNotes.map((c, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="flex gap-2"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-500 font-mono text-[10px] font-bold text-white">
                    {c.contributorHandle[0]?.toUpperCase() ?? "?"}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      @{c.contributorHandle}
                    </span>
                    <p className="text-xs leading-relaxed text-ink-700">
                      {c.content}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Original idea */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-xl border border-line bg-surface p-4"
      >
        <p className="mono-label mb-1.5 text-ink-500">
          {isOwner ? "your original idea" : "where it started"}
        </p>
        <p className="text-sm leading-relaxed text-ink-900">{input}</p>
      </motion.div>
    </div>
  );
}
