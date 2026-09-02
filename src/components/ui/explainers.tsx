import type { ReactNode } from "react";

/**
 * Explainer — a small card that explains a concept or action in plain English.
 * Use wherever a user might not know what something does.
 */

export function Explainer({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const slug = (title ?? "explainer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return (
    <div
      className="rounded-lg border border-line bg-surface p-4"
      id={`section-${slug}`}
      data-section={slug}
    >
      {title && (
        <p className="mono-label mb-1.5 text-verdant-600">{title}</p>
      )}
      <div className="text-sm leading-relaxed text-ink-700">{children}</div>
    </div>
  );
}

/** A one-line definition label with an inline hint on hover. */
export function Def({
  term,
  hint,
}: {
  term: string;
  hint: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-ink-900">{term}</span>
      <span
        className="group relative inline-flex"
        aria-label={hint}
      >
        <span className="grid h-4 w-4 cursor-help place-items-center rounded-full border border-ink-300 text-[9px] font-bold text-ink-500 group-hover:border-verdant-500 group-hover:text-verdant-600">
          ?
        </span>
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-56 -translate-x-1/2 rounded-md border border-line bg-surface p-2 text-xs leading-snug text-ink-700 shadow-lg group-hover:block dark:border-ink-300 dark:bg-ink-300 dark:text-ink-900">
          {hint}
        </span>
      </span>
    </span>
  );
}
