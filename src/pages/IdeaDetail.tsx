import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { type GenericId } from "convex/values";
import { api } from "@convex/_generated/api";
import { Icon } from "@/components/icons/icons";
import { Button, Panel, Pill, FitnessDial, SectionHeader, DataRow } from "@/components/ui/primitives";
import { AGENTS, STAGE_LABEL, STAGE_INDEX, type AgentRole } from "@/lib/domain";
import type { Doc } from "@convex/_generated/dataModel";
import { useSession } from "@/lib/session";
import { GrowthVisualization } from "@/components/ideas/GrowthVisualization";
import { Explainer, Def } from "@/components/ui/explainers";
import { showToast } from "@/components/ui/toast";
import { useSignIn } from "@/components/auth/SignInModal";

type Contribution = Doc<"contributions">;
type Connection = { strength: number; reason: string; related: Doc<"ideas"> };

const MUTATION_LABEL: Record<string, string> = {
  seed: "idea",
  research: "research",
  design: "design",
  content: "content",
  tech: "tech",
  strategy: "strategy",
  budget: "budget",
  wisdom: "insight",
  synthesis: "plan",
  fork: "branch",
};

const MUTATION_EXPLAIN: Record<string, string> = {
  seed: "The original idea that started this thread.",
  research: "Nova checked the market and demand for this idea.",
  design: "Palette shaped the look and identity.",
  content: "Quill drafted the message and content plan.",
  tech: "Circuit picked the tools and approach to build it.",
  strategy: "Apex mapped the step-by-step action plan.",
  budget: "Ledger worked out the costs and funding.",
  wisdom: "A real person shared their experience or a question.",
  synthesis: "The Planner combined everything into one direction.",
  fork: "This idea split off into its own branch with a new direction.",
};

function CommentSection({
  contributionId,
  commentText,
  setCommentText,
  commentBusy,
  onSubmit,
}: {
  contributionId: string;
  commentText: string;
  setCommentText: (v: string) => void;
  commentBusy: boolean;
  onSubmit: () => void;
}) {
  const comments = useQuery(api.comments.listByContribution, {
    contributionId: contributionId as any,
  });

  return (
    <>
      {comments && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c._id} className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink-900 text-paper font-mono text-[10px]">
                {c.authorHandle[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink-900">@{c.authorHandle}</span>
                  <span className="font-mono text-[10px] text-ink-500">{formatWhen(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Add a comment…"
          className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
        />
        <Button
          variant="ghost"
          onClick={onSubmit}
          disabled={!commentText.trim() || commentBusy}
          className="shrink-0"
        >
          {commentBusy ? "…" : "Post"}
        </Button>
      </div>
    </>
  );
}

function formatWhen(ts: number): string {
  const el = Date.now() - ts;
  const m = Math.floor(el / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

function MutationRow({ c, isAgent }: { c: Contribution; isAgent: boolean }) {
  const name = isAgent ? AGENTS[c.agentRole as AgentRole]?.name ?? c.contributorHandle : `@${c.contributorHandle}`;
  const explain = MUTATION_EXPLAIN[c.mutationKind];
  const [expanded, setExpanded] = useState(false);
  const isLong = c.content.length > 220;
  const shown = expanded || !isLong ? c.content : c.content.slice(0, 220);
  return (
    <div className="border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        {isAgent ? (
          <span className="grid h-6 w-6 place-items-center rounded-full border border-verdant-500 text-verdant-600">
            <Icon.AgentGlyph role={c.agentRole as AgentRole} width={13} height={13} />
          </span>
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-900 text-paper">
            <Icon.Chat width={13} height={13} />
          </span>
        )}
        <span className="font-display text-sm font-semibold text-ink-900">{name}</span>
        <span className="index-tag uppercase">{MUTATION_LABEL[c.mutationKind] ?? c.mutationKind}</span>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-500">
          {formatWhen(c._creationTime)}
        </span>
      </div>
      {explain && (
        <p className="mt-1.5 font-mono text-[11px] italic text-ink-500">{explain}</p>
      )}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{shown}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-500 transition-colors hover:text-ink-900"
        >
          {expanded ? "show less" : `show full +${c.content.length - 220} chars`}
        </button>
      )}
    </div>
  );
}

export function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { user, token } = useSession();
  const ideaId: GenericId<"ideas"> | null = id ? (id as GenericId<"ideas">) : null;
  const data = useQuery(api.ideas.getIdea, ideaId ? { ideaId } : "skip");
  const connections = useQuery(api.connections.listConnections, ideaId ? { ideaId } : "skip");
  const [tab, setTab] = useState<string>(params.get("fork") === "1" ? "forks" : "evolution");
  const [contribution, setContribution] = useState("");
  const [branchText, setBranchText] = useState("");
  const [forkDesc, setForkDesc] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [proofType, setProofType] = useState<"link" | "photo" | "text">("link");
  const [proofUrl, setProofUrl] = useState("");
  const [proofText, setProofText] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const { openSignIn } = useSignIn();

  const processAction = useAction(api.ideas.runAgentsLLM);
  const contributeMutation = useMutation(api.ideas.contribute);
  const forkMutation = useMutation(api.ideas.forkIdea);
  const publishMutation = useMutation(api.ideas.publishToCommunity);
  const makePrivateMutation = useMutation(api.ideas.makePrivate);
  const deleteIdeaMutation = useMutation(api.ideas.deleteIdea);
  const finalizeMutation = useMutation(api.ideas.finalizeIdea);
  const markBuildingMutation = useMutation(api.ideas.markAsBuilding);
  const generateUploadUrl = useMutation(api.ideas.generateUploadUrl);
  const connMutation = useMutation(api.connections.computeConnections);
  const healthMutation = useMutation(api.health.refreshHealth);
  const addCommentMutation = useMutation(api.comments.add);

  const commentCounts = useQuery(
    api.comments.listByIdea,
    ideaId ? { ideaId } : "skip"
  );

  const [expandedComment, setExpandedComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const idea = data?.idea;
  const contributions = data?.contributions ?? [];
  const health = data?.health;
  const isOwner = !!user && idea?.authorId === user._id;

  function requireSignIn(): boolean {
    if (token) return true;
    if (idea?.visibility === "community") {
      openSignIn();
    } else {
      showToast("Sign in to do this. It's instant and keeps your work yours.");
    }
    return false;
  }

  async function submitComment(contributionId: string) {
    if (!commentText.trim() || commentBusy) return;
    if (!requireSignIn()) return;
    setCommentBusy(true);
    try {
      await addCommentMutation({
        token: token!,
        contributionId: contributionId as any,
        content: commentText.trim(),
      });
      setCommentText("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not post comment.");
    } finally {
      setCommentBusy(false);
    }
  }

  async function run(name: string, fn: () => Promise<void>) {
    if (!requireSignIn() || busy) return;
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function processAgents() {
    if (!ideaId) return;
    run("agents", async () => {
      setNotice(null);
      await processAction({ token: token!, ideaId });
      setNotice("Agents done. They added their thoughts above.");
    });
  }
  function contribute() {
    if (!ideaId || !contribution.trim()) return;
    run("contribute", async () => {
      await contributeMutation({ token: token!, ideaId, content: contribution.trim() });
      setContribution("");
      setNotice("Thanks. Your note is in. Run the agents to see them react.");
    });
  }
  function fork() {
    if (!ideaId || !branchText.trim()) return;
    run("fork", async () => {
      const res = await forkMutation({
        token: token!,
        parentIdeaId: ideaId,
        input: branchText.trim(),
        description: forkDesc.trim(),
      });
      window.location.href = `/i/${res.childIdeaId}`;
    });
  }
  function publish() {
    if (!ideaId) return;
    run("publish", async () => {
      await publishMutation({ token: token!, ideaId });
      setNotice("Published. This idea is now live on the Community page.");
    });
  }
  function makePrivate() {
    if (!ideaId) return;
    run("unpublish", async () => {
      await makePrivateMutation({ token: token!, ideaId });
      setNotice("Set back to personal. Only you can see it now.");
    });
  }
  function deleteIdea() {
    if (!ideaId) return;
    setNotice(null);
    showToast("Permanently delete this idea and its whole history? This cannot be undone.", "info");
    setConfirmDelete(true);
  }
  function deleteConfirmed() {
    if (!ideaId) return;
    const wasCommunity = idea?.visibility === "community";
    run("delete", async () => {
      await deleteIdeaMutation({ token: token!, ideaId });
      showToast("Idea deleted.", "success");
      window.location.href = wasCommunity ? "/community" : "/workspace";
    });
    setConfirmDelete(false);
  }
  function connect() {
    if (!ideaId) return;
    run("connect", async () => {
      await connMutation({ token: token!, ideaId });
      setNotice("Done. Related ideas are in the Related tab.");
    });
  }
  function finalize() {
    if (!ideaId) return;
    setShowFinalize((v) => !v);
  }

  function submitFinalize() {
    if (!ideaId) return;
    run("finalize", async () => {
      let proofImageStorageId: any = undefined;
      if (proofType === "photo" && proofFile) {
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": proofFile.type || "application/octet-stream" },
          body: proofFile,
        });
        if (!uploadRes.ok) throw new Error("Could not upload the photo. Try again.");
        const { storageId } = await uploadRes.json();
        proofImageStorageId = storageId;
      }
      await finalizeMutation({
        token: token!,
        ideaId,
        proofType,
        proofUrl: proofType === "link" ? proofUrl.trim() || undefined : undefined,
        proofText: proofType === "text" ? proofText.trim() || undefined : undefined,
        proofImageStorageId,
      });
      setShowFinalize(false);
      setProofUrl("");
      setProofText("");
      setProofFile(null);
      setNotice("Marked as ready. Proof saved to the idea history.");
    });
  }

  function markBuilding() {
    if (!ideaId) return;
    run("building", async () => {
      await markBuildingMutation({ token: token!, ideaId });
      setNotice("Marked as building. You're on it.");
    });
  }

  function refresh() {
    if (!ideaId) return;
    run("refresh", async () => {
      await healthMutation({ token: token!, ideaId });
      setNotice("Health refreshed.");
    });
  }

  if (!idea) {
    return (
      <div className="py-24 text-center">
        <p className="mono-label text-ink-400">locating the idea…</p>
      </div>
    );
  }

  const tabs = [
    { key: "evolution", label: "Overview" },
    { key: "thread", label: "Timeline" },
    { key: "health", label: "Health" },
    { key: "forks", label: "Branches" },
    { key: "dna", label: "Related" },
  ];

  return (
    <div data-agent-anchor="idea" className="mx-auto max-w-4xl py-10">
      <Link
        to={idea.visibility === "community" ? "/community" : "/workspace"}
        className="inline-flex items-center gap-1.5 font-mono text-[13px] uppercase tracking-wider text-ink-500 hover:text-ink-900"
      >
        <Icon.ArrowLeft width={14} height={14} /> back
      </Link>

      <div className="mt-4">
        <p className="text-sm text-ink-600">
          {isOwner
            ? "This is your idea. Every thought from agents and people is collected here as it grows."
            : "Every thought about this idea is collected here, from agents and from people, as it grows from new to ready."}
        </p>
      </div>

      {/* header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone={idea.visibility === "community" ? "live" : "soft"}>
              {idea.visibility === "community" ? "community" : "private"}
            </Pill>
            <Pill tone="soft">{STAGE_LABEL[idea.stage]}</Pill>
            {isOwner && (
              <Pill tone="live">yours</Pill>
            )}
            <span className="grid h-6 w-6 place-items-center rounded-full bg-mist text-ink-500">
              <Icon.Glyph kind={idea.contentKind} width={13} height={13} />
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl leading-tight text-ink-900 text-balance">
            {idea.input}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider text-ink-500">
            <span>{isOwner ? "by you" : `by @${idea.authorHandle}`}</span>
            <span className="tabular">{idea.contributionCount} contributions</span>
            <span className="tabular">{idea.forkCount} branches</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <FitnessDial value={idea.fitness} size={84} />
          <span className="mono-label">score</span>
        </div>
      </div>

      {/* stage progress */}
      <div className="mt-6">
        <div className="h-2 flex overflow-hidden rounded-full bg-ink-200">
          {(Object.keys(STAGE_INDEX) as (keyof typeof STAGE_INDEX)[]).map((s, i) => (
            <div
              key={s}
              className={i < STAGE_INDEX[idea.stage as keyof typeof STAGE_INDEX] + 1 ? "bg-verdant-500" : "bg-transparent"}
              style={{ width: "20%" }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-600">
          {Object.entries(STAGE_LABEL).map(([s, label]) => (
            <span key={s} className={s === idea.stage ? "font-semibold text-verdant-600" : ""}>
              {label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Ideas move from <span className="font-semibold">New</span> to{" "}
          <span className="font-semibold">Building</span> to{" "}
          <span className="font-semibold">Ready</span> as people and agents add more
          to them. More contributions = closer to ready.
        </p>
      </div>

      {/* actions */}
      <div className="mt-6 grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Explainer title={isOwner ? "step 1 · run the agents" : "step 1 · run the agents"}>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="spore" onClick={processAgents} disabled={!!busy}>
                <Icon.AgentGlyph role="research" width={15} height={15} />
                {busy === "agents" ? "Working…" : "Run the agents"}
              </Button>
              <p className="text-xs text-ink-600">
                {isOwner
                  ? "Send the six agents to work on your idea. Each adds a thought in order, building on the last."
                  : "Sends the six agents (plus the Planner) to work on this idea. Each adds a thought in order, building on the last."}
              </p>
            </div>
          </Explainer>
          <Explainer title="step 2 · add your own">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ink"
                onClick={() => document.getElementById("contribute-section")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Icon.Plus width={15} height={15} />
                {isOwner ? "Add your take" : "Add your own"}
              </Button>
              <p className="text-xs text-ink-600">
                {isOwner
                  ? "Share your real-world take. Experience, a question, a constraint. The agents react to it next time you run them."
                  : "Share your real-world take. Experience, a question, a constraint. The agents "}
                {!isOwner && (
                  <span className="font-semibold">react to it</span>
                )}
                {!isOwner && " next time you run them."}
              </p>
            </div>
          </Explainer>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          {isOwner && idea.visibility === "personal" && (
            <Button variant="outline" onClick={publish} disabled={!!busy}>
              <Icon.CloudUp width={15} height={15} />
              {busy === "publish" ? "Publishing…" : "Publish to community"}
            </Button>
          )}
          {isOwner && idea.visibility === "community" && (
            <Button variant="outline" onClick={makePrivate} disabled={!!busy}>
              <Icon.Lock width={15} height={15} />
              {busy === "unpublish" ? "Unpublishing…" : "Make private"}
            </Button>
          )}
          {isOwner && (
            <Button variant="danger" onClick={deleteIdea} disabled={!!busy}>
              <Icon.Trash width={15} height={15} />
              {busy === "delete" ? "Deleting…" : "Delete idea"}
            </Button>
          )}
          {isOwner && idea.stage !== "mature" && idea.stage !== "building" && (
            <Button variant="outline" onClick={markBuilding} disabled={!!busy}>
              <Icon.Pulse width={15} height={15} />
              {busy === "building" ? "Marking…" : "I'm building this"}
            </Button>
          )}
          {isOwner && idea.stage !== "mature" && (
            <Button variant="outline" onClick={finalize} disabled={!!busy}>
              <Icon.Spark width={15} height={15} />
              {busy === "finalize" ? "Finalizing…" : showFinalize ? "Close" : "Finalize idea"}
            </Button>
          )}
          <Button variant="outline" onClick={connect} disabled={!!busy}>
            <Icon.Network width={15} height={15} />
            {busy === "connect" ? "Scanning…" : "Find connections"}
          </Button>
          <Button variant="ghost" onClick={refresh} disabled={!!busy}>
            {busy === "refresh" ? "Refreshing…" : "Refresh health"}
          </Button>
        </div>
        <p className="text-xs text-ink-500">
          <Def term="Publish to community" hint="Makes a private idea visible to everyone on the Community page." /> ·{" "}
          <Def term="Finalize" hint="Marks a finished idea as Ready with proof — a link, a photo, or the lesson learned. Publishing to the community stays a separate choice." /> ·{" "}
          <Def term="Find connections" hint="Scans other public ideas for ones that overlap with this, so you can borrow from each other." /> ·{" "}
          <Def term="Refresh health" hint="Recalculates how healthy this idea is. Demand, feasibility, impact, and what's missing." />
        </p>
      </div>
      {notice && <p className="mt-3 font-mono text-xs text-verdant-600">{notice}</p>}

      {/* delete confirmation */}
      {confirmDelete && isOwner && (
        <div className="mt-4 rounded-xl border border-spore-600/40 bg-spore-500/5 p-5">
          <p className="mono-label text-spore-600">delete idea?</p>
          <p className="mt-1 text-sm text-ink-700">
            Permanently delete this idea and its whole history? This cannot be undone.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="danger" onClick={deleteConfirmed} disabled={!!busy}>
              <Icon.Trash width={15} height={15} />
              {busy === "delete" ? "Deleting…" : "Yes, delete it"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={!!busy}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      {/* finalize proof form */}
      {showFinalize && isOwner && idea.stage !== "mature" && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-5">
          <p className="mono-label">finalize with proof</p>
          <p className="mt-1 text-sm text-ink-600">
            Show what came out of this idea. Pick the kind of proof that fits.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ["link", "A link", "website, app, post"],
              ["photo", "A photo", "the thing, done"],
              ["text", "A goal or lesson", "what happened"],
            ] as const).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setProofType(value)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  proofType === value
                    ? "border-verdant-500 bg-verdant-500/10"
                    : "border-line hover:bg-mist"
                }`}
              >
                <span className="block text-sm font-semibold text-ink-900">{label}</span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ink-500">{hint}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {proofType === "link" && (
              <input
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
            )}
            {proofType === "text" && (
              <textarea
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="What did you build, learn, or reach? A few honest lines."
                rows={3}
                className="w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
            )}
            {proofType === "photo" && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-line bg-paper px-4 py-2.5 text-sm text-ink-700 file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1.5 file:text-xs file:text-ink-900"
              />
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="spore" onClick={submitFinalize} disabled={!!busy}>
              <Icon.Spark width={15} height={15} />
              {busy === "finalize" ? "Finalizing…" : "Mark as ready"}
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
              publishing stays separate — you choose
            </span>
          </div>
        </div>
      )}

      {/* tabs */}
      <div className="mt-10 flex flex-wrap items-center gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-md border border-b-0 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              tab === t.key
                ? "border-line bg-surface text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "evolution" && (
          <div className="space-y-4">
            <Explainer title="what you're looking at">
              This shows how the idea grew. The <span className="font-semibold">progress bar</span> at top
              shows how close it is to being ready. Below that, each <span className="font-semibold">agent</span> adds
              their perspective (research, design, content, tech, strategy, budget).{" "}
              <span className="font-semibold">Human notes</span> are real-world input from people.
              The <span className="font-semibold">original idea</span> is at the bottom.
            </Explainer>
            <GrowthVisualization
              contributions={contributions.map((c) => ({
                ...c,
                agentRole: c.agentRole as AgentRole | null,
              }))}
              stage={idea.stage}
              input={idea.input}
              fitness={idea.fitness}
              isOwner={isOwner}
            />
          </div>
        )}

        {tab === "thread" && (
          <div className="space-y-3">
            <Explainer title="the full history">
              Every thought about this idea, in order. Who said what, and what it was
              reacting to. Green entries are agents; dark ones are people.
            </Explainer>
            {(() => {
              const PAGE = 5;
              const ordered = [...contributions].reverse();
              const shown = showAll ? ordered : ordered.slice(0, PAGE);
              const hidden = ordered.length - shown.length;
              return (
                <>
                  {shown.map((c) => {
                    const count = commentCounts?.[c._id] ?? 0;
                    const isExpanded = expandedComment === c._id;
                    return (
                      <div key={c._id}>
                        <MutationRow c={c} isAgent={c.contributorType === "agent"} />
                        <div className="flex items-center gap-3 border-x border-b border-line bg-surface px-4 py-2">
                          <button
                            onClick={() => {
                              if (!token) { openSignIn(); return; }
                              setExpandedComment(isExpanded ? null : c._id);
                              setCommentText("");
                            }}
                            className="font-mono text-[11px] uppercase tracking-wider text-ink-500 hover:text-ink-900 transition-colors"
                          >
                            {isExpanded ? "hide" : count > 0 ? `${count} comment${count > 1 ? "s" : ""}` : "comment"}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="border-x border-b border-line bg-mist/30 p-4 space-y-3">
                            <CommentSection
                              contributionId={c._id}
                              commentText={commentText}
                              setCommentText={setCommentText}
                              commentBusy={commentBusy}
                              onSubmit={() => submitComment(c._id)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {hidden > 0 && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full rounded-md border border-dashed border-line-strong px-4 py-3 text-center font-mono text-xs uppercase tracking-wider text-ink-500 transition-colors hover:border-ink-400 hover:text-ink-900"
                    >
                      show {hidden} earlier {hidden === 1 ? "entry" : "entries"}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {tab === "health" && (
          <div className="space-y-4">
            <Explainer title="how healthy is this idea?">
              A quick health check that scores four things from the idea and its history,
              then lists what's missing and what to do next. Lower percentages are areas to
              work on.
            </Explainer>
            <Panel className="p-6">
              <p className="mono-label mb-4">health metrics · live</p>
              <DataRow label="Community interest" value={`${health?.communityInterest ?? 0}%`} />
              <DataRow label="Feasibility" value={`${health?.feasibility ?? 0}%`} />
              <DataRow label="Impact potential" value={`${health?.impactPotential ?? 0}%`} />
              <DataRow label="Resource availability" value={`${health?.resourceAvailability ?? 0}%`} />
              <p className="mt-3 font-mono text-[11px] italic text-ink-500">
                Community interest = are people into this? Feasibility = can it actually be
                built? Impact = how much good would it do? Resources = do you have what it takes?
              </p>
            </Panel>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Panel className="p-5">
                <p className="mono-label text-spore-600">what's missing</p>
                <ul className="mt-3 space-y-2">
                  {(health?.gaps ?? ["No gaps detected"]).map((g) => (
                    <li key={g} className="flex items-start gap-2 text-sm text-ink-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-spore-500" />
                      {g}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel className="p-5">
                <p className="mono-label text-verdant-600">what to do next</p>
                <ul className="mt-3 space-y-2">
                  {(health?.suggestions ?? ["Run a first survey"]).map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-ink-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-verdant-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}

        {tab === "forks" && (
          <div className="space-y-4">
            <Explainer title="what a branch is">
              Sometimes an idea splits into a new direction, like a tree. A branch starts
              fresh with its own history but keeps a bit of the parent's momentum. It's how
              one idea can explore several different futures at once.
            </Explainer>
            <Panel className="p-6">
              <p className="mono-label">start a new branch</p>
              <input
                value={branchText}
                onChange={(e) => setBranchText(e.target.value)}
                placeholder="the new direction, e.g. community-funded model"
                className="mt-3 w-full rounded-md border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
              <textarea
                value={forkDesc}
                onChange={(e) => setForkDesc(e.target.value)}
                placeholder="why this direction? (optional)"
                rows={2}
                className="mt-3 w-full resize-none rounded-md border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
              <Button variant="spore" onClick={fork} disabled={!branchText.trim() || !!busy} className="mt-4">
                <Icon.ForkArrow width={15} height={15} />
                {busy === "fork" ? "Branching…" : "Branch from this idea"}
              </Button>
            </Panel>
          </div>
        )}

        {tab === "dna" && (
          <Panel className="p-6">
            <p className="mono-label">related ideas</p>
            <p className="mt-2 text-sm text-ink-600">
              Other public ideas that overlap with this one, ranked by how much they share.
              A way to find potential collaborators or neighbouring projects. Press Find
              connections above to scan.
            </p>
            <div className="mt-5 space-y-3">
              {connections && connections.length === 0 && (
                <p className="font-mono text-xs text-ink-500">
                  No connections computed yet. Tap Find connections above.
                </p>
              )}
              {(connections as Connection[])?.map((c) => (
                <Link
                  key={c.related._id}
                  to={`/i/${c.related._id}`}
                  className="block border border-line bg-surface p-4 transition-colors hover:bg-mist"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-semibold text-ink-900 line-clamp-2">
                      {c.related.input}
                    </span>
                    <Pill tone="live">{c.strength}%</Pill>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-ink-500">{c.reason}</p>
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* contribute */}
      <div id="contribute-section" className="mt-14">
        <SectionHeader index="+" title={isOwner ? "Add your take" : "Add your own"} rule="the human touch" />
        <Explainer title="why add a note?">
          {isOwner
            ? "Agents are smart but they don't live your life. A real detail from you, like 'we tried this before and the part that failed was X', makes the agents' next run sharper."
            : "Agents are smart but they don't live your life. A real detail from you, like we tried this before and the part that failed was X, makes the agents' next run sharper, because they read and react to every human note."}
        </Explainer>
        <Panel className="mt-3 p-5">
          <textarea
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) contribute();
            }}
            placeholder="Share experience, ask a question, add a constraint…"
            rows={3}
            className="w-full resize-none rounded-md border border-line bg-paper p-4 font-sans text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="mono-label">the agents will react to your note</p>
            <Button variant="ink" onClick={contribute} disabled={!contribution.trim() || !!busy}>
              <Icon.Spark width={15} height={15} />
              {busy === "contribute" ? "Saving…" : "Contribute"}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
