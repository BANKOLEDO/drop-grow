import type { SVGProps } from "react";
import type { AgentRole, ContentKind } from "@/lib/domain";

/**
 * drop&grow Icon Set
 * ----------------
 * Bespoke stroke-based glyphs (24px grid, currentColor, strokeWidth 1.5)
 * — intentionally NOT an iconify/lucide dependency. Each glyph is hand-tuned
 * to the "fermented ink" system: weighted strokes, squared terminals, no fill.
 */

const base: SVGProps<SVGSVGElement> = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
  "aria-hidden": true,
};

function Svg({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg {...base} {...props} width={props.width ?? 20} height={props.height ?? 20}>
      {children}
    </svg>
  );
}

/* Core brand */

export function SporeMark({
  invert = false,
  ...props
}: SVGProps<SVGSVGElement> & { invert?: boolean }) {
  const core = invert ? "var(--color-paper)" : "var(--color-ink-900)";
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2.2" fill={core} />
      <circle cx="19.5" cy="6" r="2" />
      <circle cx="19.5" cy="6" r="0.8" fill={core} />
      <circle cx="5" cy="17" r="1.8" />
      <circle cx="5" cy="17" r="0.7" fill={core} />
    </Svg>
  );
}

/* Content kind glyphs */

export function Glyph({ kind, ...props }: { kind: ContentKind } & SVGProps<SVGSVGElement>) {
  switch (kind) {
    case "text":
      return (
        <Svg {...props}>
          <path d="M4 7h16" />
          <path d="M6 7v10" />
          <path d="M6 12h6" />
          <path d="M12 7v10" />
          <path d="M4 17h8" />
        </Svg>
      );
    case "voice":
      return (
        <Svg {...props}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </Svg>
      );
    case "image":
      return (
        <Svg {...props}>
          <rect x="3" y="4" width="18" height="16" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="M3 17l5-5 4 4 3-3 6 5" />
        </Svg>
      );
  }
}

/* Actions */

export function Plus({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ArrowRight({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 12h17M14 6l6 6-6 6" />
    </Svg>
  );
}

export function ArrowLeft({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M21 12H4M10 6l-6 6 6 6" />
    </Svg>
  );
}

export function Spark({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16.4l-1.8-5.4L5 9.2l5.2-1.8z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </Svg>
  );
}

export function ForkArrow({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 4v7a4 4 0 0 0 4 4h10" />
      <path d="M4 4h4M16 11l4 4-4 4" />
    </Svg>
  );
}

export function Pulse({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </Svg>
  );
}

export function Branch({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 6h4a4 4 0 0 1 4 4v5.8" />
      <path d="M15.8 6H18" />
    </Svg>
  );
}

export function Network({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="5" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
      <path d="M7 10.5L10 7M17 7l-3 3M17 12h-3M7 15l3 3M16 13.5l1.5 3.5M8 16.5l3-2" />
    </Svg>
  );
}

export function Lock({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x="5" y="10" width="14" height="10" rx="1" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function Trash({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l.8 12a1 1 0 0 0 1 .9h8.4a1 1 0 0 0 1-.9L18 7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

export function Globe({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.5 2.5 14.5 0 17M12 3.5C9.5 6 9.5 18 12 20.5" />
    </Svg>
  );
}

export function Bell({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function Chat({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </Svg>
  );
}

export function CloudUp({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.6.9A3.6 3.6 0 0 1 17.5 18H7" />
      <path d="M12 14V7M9 9.5L12 6.5l3 3" />
    </Svg>
  );
}

export function Vote({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 20l-8-8 3.5-3.5L12 13l3.5-3.5M20 12l-8-8" transform="translate(0 0)" />
      <path d="M7 8l4-1 4 4-3 4" />
    </Svg>
  );
}

export function Play({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M7 4l12 8-12 8z" />
    </Svg>
  );
}

export function Sun({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </Svg>
  );
}

export function Moon({ ...props }: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

/* Agent role glyphs */

const AGENT_DRAWS: Record<AgentRole, React.ReactNode> = {
  research: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l2.5 2.5" />
      <path d="M3 21l4-4" />
    </>
  ),
  design: (
    <>
      <rect x="5" y="5" width="14" height="14" />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="M5 16l5-5 3 3 3-3 3 3" />
    </>
  ),
  content: (
    <>
      <path d="M5 4h14v16H5z" />
      <path d="M8 4v16M8 12h6" />
    </>
  ),
  tech: (
    <>
      <rect x="6" y="6" width="12" height="12" />
      <path d="M9 10h.01M15 10h.01M9.5 14.5c1.5 1.2 3.5 1.2 5 0" />
      <path d="M6 9v6" />
    </>
  ),
  strategy: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M7 15l3-4 3 2 4-5" />
    </>
  ),
  budget: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="1" />
      <path d="M12 8v8M9.5 11h2.5a1.5 1.5 0 0 1 0 3H9M14 11h-2.5" />
    </>
  ),
  community: (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M17 6l1 1.5L20 7l-2 2 1 2" />
    </>
  ),
};

function SignOut(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export function AgentGlyph({
  role,
  ...props
}: { role: AgentRole } & SVGProps<SVGSVGElement>) {
  return <Svg {...props}>{AGENT_DRAWS[role]}</Svg>;
}

function Pen(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-1.5 3.5-3.5c.6-.6.6-1.5 0-2.1l-3-3c-.6-.6-1.5-.6-2.1 0L11.5 6.5 13 8 9 12l-5 5 3 3 5-5" />
      <path d="M17.5 9.5L14.5 6.5" />
    </Svg>
  );
}

function Eraser(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M7 21l-4.5-4.5a2 2 0 0 1 0-2.8L13 3.2a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L10.5 21H7z" />
      <path d="M13 5.5L18.5 11" />
      <path d="M11 21h10" />
    </Svg>
  );
}

function PaintBucket(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M4 14l7-9 7 9" />
      <path d="M7 14h8" />
      <path d="M19 15c0-1 1.5-2.5 1.5-2.5S22 14 22 15a1.5 1.5 0 0 1-3 0z" />
      <path d="M3.5 14l4 7 4-7" />
    </Svg>
  );
}

/* Composite */

export const Icon = Object.assign(Svg, {
  SporeMark,
  Glyph,
  Plus,
  ArrowRight,
  ArrowLeft,
  Spark,
  ForkArrow,
  Pulse,
  Branch,
  Network,
  Lock,
  Trash,
  Globe,
  Bell,
  Chat,
  CloudUp,
  Vote,
  Play,
  Sun,
  Moon,
  SignOut,
  Pen,
  Eraser,
  PaintBucket,
  AgentGlyph,
});

export default Icon;
