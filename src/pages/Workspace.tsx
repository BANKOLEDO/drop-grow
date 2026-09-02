import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Composer } from "@/components/ideas/Composer";
import { IdeaCard } from "@/components/ideas/IdeaCard";
import { SignInCard } from "@/components/auth/SignInCard";
import { SectionHeader } from "@/components/ui/primitives";
import { Explainer } from "@/components/ui/explainers";
import { useSession } from "@/lib/session";

export function WorkspacePage() {
  const { user, token, ready } = useSession();
  const personal = useQuery(
    api.ideas.listIdeas,
    token && user ? { visibility: "personal", token, limit: 20 } : "skip"
  );
  const suggested = useQuery(api.ideas.listIdeas, { visibility: "community", limit: 3 });

  if (!ready) {
    return (
      <div className="py-24 text-center">
        <p className="mono-label text-ink-400">loading your ideas…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="py-16" data-tour="signin-card">
        <SignInCard />
      </section>
    );
  }

  return (
    <div className="relative py-10">
      <div className="pointer-events-none absolute inset-0 bg-dotpaper opacity-50" aria-hidden />
      <div className="relative">
      <div className="mb-8 max-w-2xl">
        <p className="mono-label">my space · @{user.handle}</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl text-ink-900">
          Your ideas, growing.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          This is your private space. Drop an idea below, and agents will start helping
          it grow. Nothing here is public until you choose to publish it.
        </p>
      </div>

      <div data-tour="composer">
        <Composer />
      </div>

      <div className="mt-6">
        <Explainer title="how it works">
          <ol className="list-decimal space-y-1 pl-4">
            <li><span className="font-semibold">Drop an idea</span> — type it, record your voice, or upload a photo.</li>
            <li><span className="font-semibold">Agents help</span> — six specialists (research, design, content, tech, strategy, budget) each add their take.</li>
            <li><span className="font-semibold">Add your own</span> — reply with real-world knowledge, questions, or constraints. The agents read it and adapt.</li>
            <li><span className="font-semibold">Publish when ready</span> — share it with the community for feedback and branching.</li>
          </ol>
        </Explainer>
      </div>

      <div className="mt-12">
        <SectionHeader
          index="G-1"
          title="Your private ideas"
          rule={`${personal?.length ?? 0} in the works`}
        />
        {personal && personal.length === 0 ? (
          <PanelEmpty message="Nothing here yet. Drop your first idea above." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {personal?.map((idea, i) => (
              <IdeaCard key={idea._id} idea={idea} index={i} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-16">
        <SectionHeader index="G-2" title="See what the community is working on" rule="public ideas" />
        <div className="grid gap-4 md:grid-cols-3">
          {suggested?.map((idea, i) => (
            <IdeaCard key={idea._id} idea={idea} index={i} />
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

export function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-10 text-center">
      <p className="font-display text-xl text-ink-600">{message}</p>
    </div>
  );
}
