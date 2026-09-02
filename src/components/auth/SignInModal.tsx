import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/icons/icons";
import { showToast } from "@/components/ui/toast";

interface SignInContextValue {
  openSignIn: () => void;
  closeSignIn: () => void;
  guardSignIn: () => boolean;
}

const SignInContext = createContext<SignInContextValue | null>(null);

export function SignInProvider({ children }: { children: ReactNode }) {
  const { token, signIn } = useSession();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [secretPhrase, setSecretPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openSignIn = useCallback(() => setOpen(true), []);
  const closeSignIn = useCallback(() => setOpen(false), []);

  const guardSignIn = useCallback((): boolean => {
    if (token) return true;
    setOpen(true);
    return false;
  }, [token]);

  useEffect(() => {
    if (open && token) setOpen(false);
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function join() {
    if (submitting || !handle.trim()) return;
    setSubmitting(true);
    try {
      const result = await signIn(
        displayName.trim() || handle.trim(),
        handle.trim(),
        undefined,
        secretPhrase.trim() || undefined
      );
      if (result.secret) {
        showToast(`New handle! Your secret phrase is: ${result.secret}. Log in from any device with it.`);
      }
      setHandle("");
      setDisplayName("");
      setSecretPhrase("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not join drop&grow.");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void join();
  }

  const value = useMemo<SignInContextValue>(
    () => ({ openSignIn, closeSignIn, guardSignIn }),
    [openSignIn, closeSignIn, guardSignIn]
  );

  return (
    <SignInContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div
              className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Sign in"
              className="relative z-10 w-full max-w-sm"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-12px_rgba(0,0,0,0.4)]">
                <div className="absolute inset-0 bg-dotpaper opacity-[0.35]" />
                <div className="absolute left-0 right-0 top-0 h-[3px] bg-verdant-500" />
                <div className="relative p-7">
                  <div className="flex items-start justify-between">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-verdant-500/10">
                      <Icon.SporeMark width={22} height={22} className="text-verdant-600" />
                    </span>
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition-colors hover:bg-mist hover:text-ink-900"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="square"
                        width={18}
                        height={18}
                        aria-hidden
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>

                  <p className="mono-label mt-5">claim a handle</p>
                  <h2 className="mt-1 font-display text-3xl leading-tight text-ink-900">
                    Sign in to keep growing
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    Save a secret phrase — it is the only way to sign in as this handle
                    again from another device. Your token on this device needs no phrase.
                  </p>

                  <form className="mt-6 space-y-3" onSubmit={onSubmit}>
                    <label className="block">
                      <span className="mono-label">handle</span>
                      <input
                        autoFocus
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="sarah_j"
                        className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-verdant-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mono-label">display name · optional</span>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Sarah"
                        className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-verdant-500"
                      />
                    </label>
                  <label className="block">
                      <span className="mono-label">secret phrase · optional</span>
                      <input
                        value={secretPhrase}
                        onChange={(e) => setSecretPhrase(e.target.value)}
                        placeholder="phrase for this handle"
                        autoComplete="off"
                        className="mt-1.5 w-full rounded-lg border border-line bg-paper px-4 py-3 font-sans text-[15px] text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-verdant-500"
                      />
                    </label>
                  </form>

                  <Button
                    variant="spore"
                    onClick={() => void join()}
                    disabled={submitting || !handle.trim()}
                    className="mt-6 w-full"
                    type="submit"
                  >
                    <Icon.Spark width={16} height={16} />
                    {submitting ? "Joining…" : "Join drop&grow"}
                  </Button>

                  <button
                    onClick={() => setOpen(false)}
                    className="mt-4 w-full text-center text-sm text-ink-500 underline decoration-dotted underline-offset-4 transition-colors hover:text-ink-900"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SignInContext.Provider>
  );
}

export function useSignIn(): SignInContextValue {
  const ctx = useContext(SignInContext);
  if (!ctx) throw new Error("useSignIn must be used within SignInProvider");
  return ctx;
}
