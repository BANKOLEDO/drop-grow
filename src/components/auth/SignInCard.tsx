import { useState } from "react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/icons/icons";
import { showToast } from "@/components/ui/toast";

export function SignInCard() {
  const { signIn } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [secretPhrase, setSecretPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function join() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await signIn(
        displayName.trim() || handle.trim(),
        handle.trim(),
        undefined,
        secretPhrase.trim() || undefined
      );
      if (result.secret) {
        showToast(`New handle! Your secret phrase is: ${result.secret}. Use it to sign in from any device.`);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not join drop&grow.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="absolute inset-0 bg-dotpaper-thick opacity-60" />
        <div className="absolute left-0 right-0 top-0 h-[3px] bg-verdant-500" />
        <div className="relative p-8 sm:p-10">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-verdant-500/10">
              <Icon.SporeMark className="text-verdant-500" width={20} height={20} />
            </span>
            <div>
              <p className="mono-label">claim a handle</p>
              <h2 className="mt-0.5 font-display text-2xl text-ink-900">Start growing</h2>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-600">
            Pick a handle and save a secret phrase — the only way to sign in as this
            handle again from another device. Your token on this device needs no phrase.
          </p>

          <div className="mt-6 space-y-3">
            <label className="block">
              <span className="mono-label">handle</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="sarah_j"
                className="mt-1.5 w-full rounded-md border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
            </label>
            <label className="block">
              <span className="mono-label">display name · optional</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sarah"
                className="mt-1.5 w-full rounded-md border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
            </label>
            <label className="block">
              <span className="mono-label">secret phrase · optional</span>
              <input
                value={secretPhrase}
                onChange={(e) => setSecretPhrase(e.target.value)}
                placeholder="phrase for this handle"
                autoComplete="off"
                className="mt-1.5 w-full rounded-md border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-verdant-500"
              />
            </label>
          </div>

          <Button
            variant="spore"
            onClick={join}
            disabled={submitting || !handle.trim()}
            className="mt-6 w-full"
          >
            <Icon.Spark width={16} height={16} />
            {submitting ? "Joining…" : "Join drop&grow"}
          </Button>
        </div>
      </div>
    </div>
  );
}
