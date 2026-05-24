# Learn&

> **Fork note:** This repo is a fork of [KennyKeni/humansand-hackathon](https://github.com/KennyKeni/humansand-hackathon), maintained by Dylan Fernandez de Lara for independent hosting on **Cloudflare Workers** (frontend) and **Convex** (backend). The upstream demo at [valedictorian.app](https://valedictorian.app) is a separate deployment.

**Production (this fork):** [https://learn-and.fernandezdelaradylan.workers.dev](https://learn-and.fernandezdelaradylan.workers.dev) — hosted on Cloudflare Workers; backend on Convex (`usable-badger-650`).

AI-powered collaborative learning platform where a professor teaches on a shared whiteboard, and an AI agent monitors comprehension, dynamically pairs students into complementary study groups, and facilitates peer learning -- all in real time.

## How It Works

1. **Professor teaches** on a shared Excalidraw whiteboard while AI captures snapshots and synthesizes lesson content
2. **AI checks in** with each student via chat to probe their understanding of the lesson topics
3. **Complementary grouping** -- when Student A understands X but not Y, and Student B understands Y but not X, the AI pairs them together
4. **AI joins group chats** as a participant, nudging discussion and helping students teach each other
5. **Professor gets feedback** -- summaries of group activity and comprehension data surface what the class is struggling with

## Tech Stack

- **Framework**: Next.js (App Router), deployed via [OpenNext](https://opennext.js.org/cloudflare) on **Cloudflare Workers**
- **Backend/DB**: [Convex](https://convex.dev) (real-time queries, mutations, actions)
- **Auth**: Convex Auth (anonymous sign-in with display name)
- **Whiteboard**: Excalidraw (collaborative, real-time sync)
- **AI**: [OpenRouter](https://openrouter.ai) via Vercel AI SDK — model **`openrouter/free`** (no paid model calls)
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- A [Convex](https://convex.dev) account (your own team/project — not shared with upstream)
- An [OpenRouter](https://openrouter.ai) API key
- A [Cloudflare](https://cloudflare.com) account with Wrangler CLI (`npm install -g wrangler` or use the project devDependency)

## Local development

```bash
npm install
cp .env.example .env.local
# Fill in OPENROUTER_API_KEY and run once:
npx convex dev
```

In a second terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables (local)

| Variable | Where | Purpose |
|----------|--------|---------|
| `CONVEX_DEPLOYMENT` | `.env.local` | Set by `npx convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex HTTP API |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` | Convex site / auth HTTP |
| `OPENROUTER_API_KEY` | `.env.local` | Next.js API routes |
| `OPENROUTER_API_KEY` | Convex (`npx convex env set`) | `convex/ai.ts` actions |

Copy from [`.env.example`](./.env.example). Never commit `.env.local`.

## Deploy to Cloudflare Workers

This app uses `@opennextjs/cloudflare`. Convex stays on Convex Cloud; only the Next.js app runs on Workers.

### 1. Convex (one-time per deployment)

```bash
npx convex dev --once
npx @convex-dev/auth --web-server-url https://YOUR-WORKERS-URL --allow-dirty-git-state
```

Set secrets on **your** Convex deployment:

```bash
npx convex env set OPENROUTER_API_KEY your-key-here
npx convex env set SITE_URL https://YOUR-WORKERS-URL
```

`SITE_URL` must match your public Cloudflare URL (required for Convex Auth redirects).

Update `wrangler.jsonc` `vars` with your `NEXT_PUBLIC_CONVEX_*` URLs if they differ from the template.

### 2. Cloudflare secrets

```bash
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
```

### 3. Build and deploy

```bash
npm run deploy
```

Wrangler prints your `*.workers.dev` URL. Set that URL as Convex `SITE_URL` (step 1) if you have not already.

### 4. Preview locally (Workers runtime)

```bash
cp .dev.vars.example .dev.vars
# Add OPENROUTER_API_KEY to .dev.vars
npm run preview
```

## AI model (free tier)

All LLM calls use **`openrouter/free`** (OpenRouter’s free router). Do not switch to paid model IDs (e.g. `google/gemini-3-flash-preview`) unless you intend to pay.

## Usage

1. Enter your name on the landing page
2. Create a new session from the lobby (you become the professor/creator)
3. Share the session code with students
4. Start teaching -- draw on the whiteboard, then hit "Check-In" to synthesize and probe students
5. AI matches students into complementary groups automatically
6. Monitor group discussions and view AI-generated summaries

## License

MIT — see [LICENSE](./LICENSE).
