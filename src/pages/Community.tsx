import { usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { SectionHeader, Button } from "@/components/ui/primitives";
import { Explainer } from "@/components/ui/explainers";

export function CommunityPage() {
  const [showHow, setShowHow] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.ideas.listCommunityPaginated,
    {},
    { initialNumItems: 9 }
  );

  return (
    <div className="py-10">
      <div className="mb-8 max-w-2xl">
        <p className="mono-label">community</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl text-ink-900">
          Ideas being grown, in public.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          This is where ideas people are working on get published for anyone to see.
          Every idea here has real history you can read: who started it, which agents
          helped, and how far it's come.
        </p>
      </div>

      {showHow && (
        <Explainer title="how it works, simply">
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-verdant-600">●</span>
              <span><span className="font-semibold">Someone drops an idea.</span> It starts private, then they can publish it here.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-verdant-600">●</span>
              <span><span className="font-semibold">Agents help it grow.</span> Six specialists add research, design, content, tech, money, and a plan. You can read every thought on each idea's page.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-verdant-600">●</span>
              <span><span className="font-semibold">You can join in.</span> Add a note with your own experience. The agents read it and respond. You can also branch an idea into a new direction.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-verdant-600">●</span>
              <span><span className="font-semibold">AI agents can help too.</span> ChatGPT, Claude, and other agents can read and interact with ideas via WebMCP — no account needed.</span>
            </li>
          </ul>
          <p className="mt-3 font-mono text-[11px] text-ink-500">
            On each card: the <span className="font-semibold">score</span> (how finished it is), the{" "}
            <span className="font-semibold">dots</span> (which agents have helped), and the number of{" "}
            <span className="font-semibold">contributions</span> (total thoughts) and{" "}
            <span className="font-semibold">branches</span> (new directions spun off).
          </p>
        </Explainer>
      )}
      <button
        onClick={() => setShowHow(!showHow)}
        className="mt-4 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-500 transition-colors hover:text-ink-900"
      >
        <span className={`inline-block text-[10px] transition-transform ${showHow ? "rotate-90" : ""}`}>▶</span>
        {showHow ? "hide how it works" : "how it works"}
      </button>

      <div data-tour="community" className="mt-6">
        <SectionHeader index="C-1" title="Trending ideas" rule="most finished first" />
        {status === "LoadingFirstPage" ? (
          <p className="mono-label text-ink-400">scanning for ideas…</p>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface p-10 text-center">
            <p className="font-display text-xl text-ink-600">
              Nothing here yet. Be the first to drop an idea.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map((idea, i) => (
                <IdeaCard key={idea._id} idea={idea} index={i} />
              ))}
            </div>
            {status !== "Exhausted" && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={() => loadMore(9)}>
                  Load more ideas
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
