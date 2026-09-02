import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

const TOKEN_KEY = "dropgrow.token";

export interface SessionUser {
  _id: string;
  name: string;
  handle: string;
  interests?: string[];
  joinedAt: number;
}

interface SessionContextValue {
  token: string | null;
  user: SessionUser | null;
  ready: boolean;
  signIn: (
    name: string,
    handle: string,
    interests?: string[],
    secret?: string
  ) => Promise<{ secret?: string }>;
  signOut: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)
  );
  const signInMutation = useMutation(api.auth.signIn);
  const signOutMutation = useMutation(api.auth.signOut);
  const me = useQuery(api.auth.me, token ? { token } : "skip");
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (signingIn) return;
    setReady(Boolean(token) === Boolean(me) || me !== undefined);
  }, [me, token, signingIn]);

  // Re-read token when WebMCP writes to localStorage (create_account / sign_in).
  useEffect(() => {
    const onSessionChanged = () => {
      const fresh = localStorage.getItem(TOKEN_KEY);
      if (fresh !== token) setToken(fresh);
    };
    window.addEventListener("dropgrow:session-changed", onSessionChanged);
    return () => window.removeEventListener("dropgrow:session-changed", onSessionChanged);
  }, [token]);

  const signIn = useCallback(
    async (
      name: string,
      handle: string,
      interests?: string[],
      secret?: string
    ) => {
      setSigningIn(true);
      try {
        const existing = localStorage.getItem(TOKEN_KEY);
        const result = await signInMutation({
          token: existing ?? undefined,
          secret,
          name,
          handle,
          interests,
          ip: typeof window !== "undefined" ? window.location.hostname : undefined,
        });
        localStorage.setItem(TOKEN_KEY, result.token);
        setToken(result.token);
        return { secret: result.secret };
      } finally {
        setSigningIn(false);
      }
    },
    [signInMutation]
  );

  const signOut = useCallback(async () => {
    const current = localStorage.getItem(TOKEN_KEY);
    if (current) {
      try {
        await signOutMutation({ token: current });
      } catch {
        // ignore â€” local cleanup anyway
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, [signOutMutation]);

  const value = useMemo<SessionContextValue>(
    () => ({ token, user: (me as SessionUser | null) ?? null, ready, signIn, signOut }),
    [token, me, ready, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function requireToken(): string {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) throw new Error("No session token.");
  return t;
}
