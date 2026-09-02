import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Icon } from "@/components/icons/icons";
import { Pill, FitnessDial, Button } from "@/components/ui/primitives";
import { STAGE_LABEL } from "@/lib/domain";
import type { Doc } from "@convex/_generated/dataModel";

type Idea = Doc<"ideas">;

export function IdeaCard({
  idea,
  index = 0,
}: {
  idea: Idea;
  index?: number;
}) {
  const publicMode = idea.visibility === "community";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-[inset_0_0_0_1px_var(--surface)] transition-shadow hover:shadow-[0_16px_34px_-26px_rgba(23,28,23,0.35)]"
    >
      {/* top rule — accent per visibility */}
      <div className={`h-[3px] ${publicMode ? "bg-verdant-500" : "bg-ink-300"}`} />

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={publicMode ? "live" : "soft"}>
              {publicMode ? "community" : "private"}
            </Pill>
            <Pill tone="soft">{STAGE_LABEL[idea.stage]}</Pill>
          </div>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-mist text-ink-500">
            <Icon.Glyph kind={idea.contentKind} width={14} height={14} />
          </span>
        </div>

        <Link to={`/i/${idea._id}`} className="mt-4 block">
          <h3 className="font-display text-lg leading-snug tracking-tight text-ink-900 line-clamp-2 transition-colors group-hover:text-verdant-600">
            {idea.input}
          </h3>
        </Link>

      <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
        <span className="font-mono">by @{idea.authorHandle}</span>
        <span className="font-mono tabular">{idea.contributionCount} contributions</span>
        {idea.forkCount > 0 && <span className="font-mono tabular">{idea.forkCount} branches</span>}
      </div>

      {/* DNA line */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="flex items-center gap-1" title="Which agents have helped this idea grow">
          {idea.contributorRoles.slice(0, 6).map((role) => (
            <span
              key={role}
              title={role}
              className="grid h-6 w-6 place-items-center rounded-full border border-line bg-mist text-ink-500"
            >
              <Icon.AgentGlyph role={role} width={12} height={12} />
            </span>
          ))}
          {idea.contributorRoles.length > 6 && (
            <span className="index-tag">+{idea.contributorRoles.length - 6}</span>
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5" title="How far the idea has come (0-100)">
          <FitnessDial value={idea.fitness} size={52} />
          <span className="font-mono text-[9px] uppercase text-ink-400">progress</span>
        </div>
      </div>
    </div>

    <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-3">
      <span className="index-tag">#{String(index + 1).padStart(2, "0")}</span>
      <div className="flex items-center gap-1">
        <Link to={`/i/${idea._id}`}>
          <Button variant="ghost">Open</Button>
        </Link>
        {publicMode ? (
          <Link to={`/i/${idea._id}?fork=1`} title="Spin off a new version of this idea">
            <Button variant="ghost">
              <Icon.ForkArrow width={14} height={14} />
              Branch
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  </motion.div>
);
}
