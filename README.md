# Learn&

**Live app:** [https://learn-and.fernandezdelaradylan.workers.dev](https://learn-and.fernandezdelaradylan.workers.dev)  
**Convex backend:** [dashboard](https://dashboard.convex.dev/d/usable-badger-650) (`humansand-hackathon` on team `dylan-fernandez-de-lara`)

> Forked from [KennyKeni/humansand-hackathon](https://github.com/KennyKeni/humansand-hackathon) for independent hosting. This deployment uses **your** Cloudflare Workers frontend and **your** Convex project only.

AI-powered collaborative learning platform where a professor teaches on a shared whiteboard, and an AI agent monitors comprehension, dynamically pairs students into complementary study groups, and facilitates peer learning -- all in real time.

## How It Works

1. **Professor teaches** on a shared Excalidraw whiteboard while AI captures snapshots and synthesizes lesson content
2. **AI checks in** with each student via chat to probe their understanding of the lesson topics
3. **Complementary grouping** -- when Student A understands X but not Y, and Student B understands Y but not X, the AI pairs them together
4. **AI joins group chats** as a participant, nudging discussion and helping students teach each other
5. **Professor gets feedback** -- summaries of group activity and comprehension data surface what the class is struggling with

## Tech Stack

- **Hosting**: [Cloudflare Workers](https://developers.cloudflare.com/workers/) (`learn-and.fernandezdelaradylan.workers.dev`)
- **Framework**: Next.js (App Router) via [OpenNext](https://opennext.js.org/cloudflare)
- **Backend/DB**: [Convex](https://convex.dev) — `usable-badger-650.convex.cloud`
- **Auth**: Convex Auth (anonymous sign-in with display name)
- **Whiteboard**: Excalidraw (collaborative, real-time sync)
- **AI**: [OpenRouter](https://openrouter.ai) — model **`openrouter/free`** (free tier only)
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- [Convex](https://convex.dev) account (this repo uses deployment `usable-badger-650`)
- [OpenRouter](https://openrouter.ai) API key
- [Cloudflare](https://cloudflare.com) account (for redeploys; Wrangler is in devDependencies)

## Local development

```bash
npm install
cp .env.example .env.local
# Add OPENROUTER_API_KEY, then link Convex (once):
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
| `CONVEX_DEPLOYMENT` | `.env.local` | `dev:usable-badger-650` (set by `npx convex dev`) |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | `https://usable-badger-650.convex.cloud` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` | `https://usable-badger-650.convex.site` |
| `OPENROUTER_API_KEY` | `.env.local` | Next.js API routes |
| `OPENROUTER_API_KEY` | Convex (`npx convex env set`) | `convex/ai.ts` actions |

Copy from [`.env.example`](./.env.example). Never commit `.env.local`.

## Deploy to Cloudflare Workers

Frontend only; Convex stays on Convex Cloud.

### 1. Convex

```bash
npx convex dev --once
npx convex env set SITE_URL https://learn-and.fernandezdelaradylan.workers.dev
npx convex env set OPENROUTER_API_KEY your-key-here
```

Auth keys (`JWT_*`, `JWKS`) are already on this deployment if you ran `@convex-dev/auth` setup earlier.

### 2. Cloudflare

```bash
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npm run deploy
```

Production URL: **https://learn-and.fernandezdelaradylan.workers.dev**  
(`wrangler.jsonc` already sets `NEXT_PUBLIC_CONVEX_*` for `usable-badger-650`.)

### 3. Preview locally (Workers runtime)

```bash
cp .dev.vars.example .dev.vars
# Add OPENROUTER_API_KEY
npm run preview
```

## AI model (free tier)

All LLM calls use **`openrouter/free`**. Do not switch to paid model IDs unless you intend to pay.

## Usage

1. Open [the live app](https://learn-and.fernandezdelaradylan.workers.dev) or run locally
2. Enter your name on the landing page
3. Create a new session from the lobby (you become the professor/creator)
4. Share the session code with students
5. Start teaching -- draw on the whiteboard, then hit "Check-In" to synthesize and probe students
6. AI matches students into complementary groups automatically
7. Monitor group discussions and view AI-generated summaries

## License

MIT — see [LICENSE](./LICENSE).
