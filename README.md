# drop&grow

**Where humans and agents create together.** An agent-native idea space: drop an idea in any form, watch six specialized agents grow it into a plan you can actually run, and keep a full history of how it evolved.

Built for the [WebMCP Challenge](https://webmcp.dev) — drop&grow is meaningfully better when people and their agents use it together. Every action a human can take in the UI, an agent can take through the app's exposed WebMCP tools.

## What it does

- **Drop an idea any way** — text, voice (real-time speech-to-text), or image. The idea *and* its medium are recorded.
- **Six agents swarm it** — Nova (research) → Palette (design) → Quill (content) → Circuit (tech) → Apex (strategy) → Ledger (budget), each building on the last, then the Planner pulls everything into one direction.
- **The idea keeps living** — full evolution history, branches instead of arguments, automatic connections between overlapping ideas, and a live health score grounded in real data.
- **A finish line, not a graveyard** — finalize with proof (a link, a photo, or the lesson learned), mark ideas as building, and publish to the community only when you choose to.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Front end | React 18 · Vite 6 · Tailwind CSS 4 · Motion | fast SPA, zero-config styling, light animations |
| Backend | Convex (queries, mutations, actions, Cron) | real-time reactive data, typed end-to-end, serverless |
| Database | Convex tables + indexes | schema-validated documents with reactive subscriptions |
| File storage | Convex Blob storage | free-tier friendly, zero-card setup |
| Agent LLMs | Groq (`llama-3.3-70b-versatile`) → Cloudflare Workers AI (`llama-3.2-1b-instruct`) → deterministic engine | speed-first cascade: ~100–200ms → 1–2s → instant fallback, never fails |
| Vision | Cloudflare Workers AI (`llama-3.2-11b-vision-instruct`) | describes uploaded images/audio context for the agents |
| Voice input | Web Speech API | real-time speech-to-text in the browser, no server cost |
| Agent access | WebMCP (`document.modelContext`) — 26 tools | agents create, read, search, comment, branch, publish, unpublish, delete, and finalize like any human user |
| Auth | Handle-based sessions (Convex mutations) | no password, no email; secret phrase protects each handle; agents get their own accounts and tokens |
| Testing | Vitest + `convex-test` | 69 unit, integration and e2e tests |
| Deployment | Convex (backend) + any static host (front end) | zero-cost operation |

## The WebMCP layer

drop&grow registers **26 tools** on `document.modelContext`, covering full user parity:

- **Identity** — `create_account`, `sign_in`, `get_user`
- **Create & read** — `create_idea`, `get_idea`, `list_ideas`, `list_my_ideas`, `search_ideas`
- **Grow** — `run_agents`, `contribute`, `branch_idea`, `add_comment`, `list_comments`, `list_idea_comments`
- **Lifecycle** — `publish_idea`, `make_idea_private`, `delete_idea`, `finalize_idea` (with proof), `mark_as_building`
- **Insight** — `get_health`, `refresh_health`, `find_connections`, `get_related_ideas`, `get_ai_insight`
- **Guided tour** — `start_tour`, `skip_tour` (agents can walk a human or another agent through the product)

An agent can create an account, drop an idea, watch the six agents respond, comment on contributions, branch a direction it disagrees with, and finalize with proof the same journey as a human, through the same tools the site exposes.

**Live visibility.** When the page runs inside a WebMCP host, drop&grow lights up a green *WebMCP live* pill in the header, shows a live activity ticker as each tool runs (`@handle → tool · running/ok/error`), and surfaces recent agent activity inside the tools panel — so a human watching a demo always sees *which* agent is doing *what*, in real time. A skippable 7-step guided tour (welcome → tools → drop-any-way → agents → workspace → kinds → community) welcomes first-time visitors and can be driven by an agent via the `start_tour` / `skip_tour` tools.

## Getting started

```bash
npm install

# backend
npx convex dev

# front end
npm run dev
```

### Optional env vars (Convex dashboard → Settings → Environment Variables)

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | primary LLM provider for the six agents |
| `CF_ACCOUNT_ID`, `CF_API_TOKEN` | Cloudflare Workers AI fallback + vision description of uploaded images |

Set these on the Convex deployment (`npx convex env set VAR value`) — the `runAgentsLLM`
action reads them server-side. The client-side Cloudflare insight uses `VITE_CF_ACCOUNT_ID`
and `VITE_CF_API_TOKEN` in `.env.local`.

Without any keys, the deterministic engine runs the agents — everything still works, but
uploaded images are only described when the Cloudflare vision keys exist.

### Output enrichment by input type

When agents run, non-text ideas are enriched to text first:

| Input type | What the agents see |
|---|---|
| text | the raw text |
| voice | the transcript (browser speech-to-text) |
| image | Cloudflare vision description (if `CF_*` set) |

## Scripts

```bash
npm run dev          # vite dev server
npm run build        # typecheck + production build
npm test             # vitest (69 tests)
npm run typecheck    # tsc --noEmit
npm run convex:push  # push convex functions
```

## Demo login

The seeded `test_user` account is already populated with four demo ideas spanning every stage and
content kind (community garden · standup bot · walking meditation · repair cafe) so you can explore
the full human + agent pipeline without setting anything up. The credential is public — use it in
your own WebMCP agent session to see the product as a returning user:

| Field | Value |
|---|---|
| Handle | `test_user` |
| Secret phrase | `dropgrow-demo-2026` |

Anyone can create a new anonymous handle (no email) — the **secret phrase** is what protects it.
Whoever claims a handle first sets the phrase (or drop&grow auto-generates one and shows it once);
signing in again from another device requires that phrase. A valid session in a browser needs no
phrase because the token stays on the device. WebMCP agents claim their own handles the same way
via `create_account`, and can persist a secret phrase to reuse the identity from a new browser.
