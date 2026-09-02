import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "motion/react";

/**
 * drop&grow primitives — "Atrium", light + editorial-growth.
 * - Button: hard-offset chip (offset drop gives it a machined, pressable read,
 *   not a soft rounded "box" button).
 * - Pill: indexed mono tag.
 * - Panel: hairline + inner-rim raised surface (double border).
 * - SectionHeader / Stat / DataRow: tabular, ruled data display.
 * - FitnessDial: SVG arc gauge with a tabular readout.
 */

/* Button */

type Variant = "spore" | "ink" | "outline" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, string> = {
  spore:
    "bg-spore-500 text-white shadow-[0_2px_0_0_#7e2a10] hover:bg-spore-400 active:translate-y-[2px] active:shadow-none disabled:opacity-50",
  ink: "bg-ink-900 text-paper shadow-[0_2px_0_0_#000] hover:bg-ink-800 active:translate-y-[2px] active:shadow-none disabled:opacity-50",
  outline:
    "bg-paper text-ink-800 border border-line-strong hover:border-ink-400 hover:bg-mist active:translate-y-[1px] disabled:opacity-50",
  ghost:
    "bg-transparent text-ink-600 hover:text-ink-900 underline decoration-dotted underline-offset-4 disabled:opacity-50",
  danger:
    "bg-paper text-spore-600 border border-spore-600/40 hover:bg-spore-500/10 hover:border-spore-500 active:translate-y-[1px] disabled:opacity-50",
};

export function Button({
  variant = "ink",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`group inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-transparent px-4 py-2 font-sans text-[15px] font-medium tracking-tight transition-all duration-150 ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* Pill */

export function Pill({
  children,
  tone = "soft",
  className = "",
}: {
  children: ReactNode;
  tone?: "soft" | "surface" | "live" | "alert";
  className?: string;
}) {
  const cls =
    tone === "live"
      ? "pill pill-live"
      : tone === "alert"
        ? "pill pill-alert"
        : tone === "surface"
          ? "pill"
          : "pill pill-soft";
  return <span className={`${cls} ${className}`}>{children}</span>;
}

/* Panel */

export function Panel({
  children,
  className = "",
  tone = "surface",
}: {
  children: ReactNode;
  className?: string;
  tone?: "surface" | "sunken";
}) {
  return (
    <div className={`${tone === "sunken" ? "panel panel-sunken" : "panel"} ${className}`}>
      {children}
    </div>
  );
}

/* Section header */

export function SectionHeader({
  index,
  title,
  rule,
  className = "mb-12",
}: {
  index: string;
  title: string;
  rule?: string;
  className?: string;
}) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return (
    <div className={className} id={`section-${slug}`} data-section={slug}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="index-tag">{index}</span>
        <h2 className="font-display text-2xl sm:text-[28px] text-ink-900">{title}</h2>
        {rule ? (
          <span className="index-tag underline decoration-dotted underline-offset-[5px]">
            {rule}
          </span>
        ) : null}
      </div>
      <div className="rule mt-4" />
    </div>
  );
}

/* Data display */

export function Stat({
  label,
  value,
  meta,
}: {
  label: string;
  value: ReactNode;
  meta?: string;
}) {
  return (
    <div>
      <p className="mono-label">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink-900 tabular">{value}</p>
      {meta ? <p className="mt-0.5 text-xs text-ink-500">{meta}</p> : null}
    </div>
  );
}

export function DataRow({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-2.5 last:border-b-0">
      <span className="text-sm text-ink-600">{label}</span>
      <span className={`font-mono text-sm tabular text-ink-900 ${valueClass}`}>{value}</span>
    </div>
  );
}

/* FitnessDial */

export function FitnessDial({
  value,
  size = 64,
}: {
  value: number;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const filled = (pct / 100) * c;
  const stable =
    pct >= 80
      ? "text-verdant-500"
      : pct >= 55
        ? "text-saffron-400"
        : "text-spore-500";
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={2.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="square"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - filled }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className={stable}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-display text-base font-bold tabular ${stable}`}>
          {Math.round(pct)}
          <span className="text-[9px] font-mono">%</span>
        </span>
      </div>
    </div>
  );
}
