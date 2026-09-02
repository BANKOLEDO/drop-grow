import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface WebMCPActivityItem {
  tool: string;
  agent: string | null;
  ts: number;
  status: "run" | "ok" | "error";
}

interface WebMCPActivityContextValue {
  /** True when a WebMCP host (document.modelContext) is live on this page. */
  connected: boolean;
  /** Latest tool execution, if any. */
  latest: WebMCPActivityItem | null;
  /** Recent tool executions, newest first. */
  history: WebMCPActivityItem[];
  /** Explicitly re-check connection state. */
  recheck: () => void;
}

const WebMCPActivityContext = createContext<WebMCPActivityContextValue | null>(null);

export function isWebMCPConnected(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof (document as { modelContext?: unknown }).modelContext === "object" &&
    (document as { modelContext?: { registerTool?: unknown } }).modelContext !== null
  );
}

function snapshotActivity(): WebMCPActivityItem[] {
  if (typeof window === "undefined") return [];
  const raw = (window as { __dropgrowWebMCPActivity?: WebMCPActivityItem[] }).__dropgrowWebMCPActivity;
  return Array.isArray(raw) ? raw : [];
}

export function WebMCPActivityProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(isWebMCPConnected);
  const [history, setHistory] = useState<WebMCPActivityItem[]>(snapshotActivity);

  const recheck = useCallback(() => setConnected(isWebMCPConnected()), []);

  useEffect(() => {
    const onActivity = (e: Event) => {
      const item = (e as CustomEvent<WebMCPActivityItem>).detail;
      if (!item) return;
      setHistory((h) => [item, ...h].slice(0, 40));
      if (typeof window !== "undefined") {
        const existing = snapshotActivity();
        (window as { __dropgrowWebMCPActivity?: WebMCPActivityItem[] }).__dropgrowWebMCPActivity = [
          item,
          ...existing,
        ].slice(0, 40);
      }
    };
    const onChange = () => setConnected(isWebMCPConnected());
    window.addEventListener("dropgrow:webmcp-activity", onActivity);
    window.addEventListener("dropgrow:webmcp-change", onChange);
    const t = window.setInterval(onChange, 2000);
    return () => {
      window.removeEventListener("dropgrow:webmcp-activity", onActivity);
      window.removeEventListener("dropgrow:webmcp-change", onChange);
      window.clearInterval(t);
    };
  }, []);

  const value = useMemo<WebMCPActivityContextValue>(
    () => ({ connected, latest: history[0] ?? null, history, recheck }),
    [connected, history, recheck]
  );

  return (
    <WebMCPActivityContext.Provider value={value}>{children}</WebMCPActivityContext.Provider>
  );
}

export function useWebMCPActivity(): WebMCPActivityContextValue {
  const ctx = useContext(WebMCPActivityContext);
  if (!ctx) throw new Error("useWebMCPActivity must be used within WebMCPActivityProvider");
  return ctx;
}