import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { RouterProvider } from "react-router-dom";
import "./styles/globals.css";
import { router } from "./app/router";
import { SessionProvider } from "./lib/session";
import { SignInProvider } from "./components/auth/SignInModal";
import { registerWebMCP } from "./lib/webmcp";
import { WebMCPActivityProvider } from "./lib/webmcp-activity";

const convexUrl =
  (import.meta as { env?: Record<string, string> }).env?.VITE_CONVEX_URL ??
  "http://127.0.0.1:3210";

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <SessionProvider>
        <WebMCPActivityProvider>
          <SignInProvider>
            <RouterProvider router={router} />
          </SignInProvider>
        </WebMCPActivityProvider>
      </SessionProvider>
    </ConvexProvider>
  </StrictMode>
);

registerWebMCP();
