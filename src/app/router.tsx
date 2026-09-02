import { createBrowserRouter } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { LandingPage } from "@/pages/Landing";
import { WorkspacePage } from "@/pages/Workspace";
import { CommunityPage } from "@/pages/Community";
import { IdeaDetailPage } from "@/pages/IdeaDetail";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";

export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/workspace", element: <WorkspacePage /> },
      { path: "/community", element: <CommunityPage /> },
      { path: "/i/:id", element: <IdeaDetailPage /> },
      { path: "/terms", element: <Terms /> },
      { path: "/privacy", element: <Privacy /> },
    ],
  },
]);
