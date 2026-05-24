# Learn&

> **Fork note:** This repo is a fork of [KennyKeni/humansand-hackathon](https://github.com/KennyKeni/humansand-hackathon), maintained by Dylan Fernandez de Lara so it can be hosted independently (Cloudflare, Convex, and related services). The live demo at [valedictorian.app](https://valedictorian.app) is the upstream project, not this deployment.

AI-powered collaborative learning platform where a professor teaches on a shared whiteboard, and an AI agent monitors comprehension, dynamically pairs students into complementary study groups, and facilitates peer learning -- all in real time.

**Live demo: [valedictorian.app](https://valedictorian.app)** (uses OpenRouter free tier, so model quality will be poor)

## How It Works

1. **Professor teaches** on a shared Excalidraw whiteboard while AI captures snapshots and synthesizes lesson content
2. **AI checks in** with each student via chat to probe their understanding of the lesson topics
3. **Complementary grouping** -- when Student A understands X but not Y, and Student B understands Y but not X, the AI pairs them together
4. **AI joins group chats** as a participant, nudging discussion and helping students teach each other
5. **Professor gets feedback** -- summaries of group activity and comprehension data surface what the class is struggling with

## Tech Stack

- **Framework**: Next.js (App Router)
- **Backend/DB**: Convex (real-time queries, mutations, actions)
- **Auth**: Convex Auth (anonymous sign-in with display name)
- **Whiteboard**: Excalidraw (collaborative, real-time sync)
- **AI**: OpenRouter via Vercel AI SDK
- **Styling**: Tailwind CSS + shadcn/ui
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- A Convex account
- An OpenRouter API key

### Setup

```bash
npm install
```

### Environment Variables

```env
CONVEX_DEPLOYMENT=      # Auto-set by `npx convex dev`
NEXT_PUBLIC_CONVEX_URL= # Auto-set by `npx convex dev`
OPENROUTER_API_KEY=     # For AI actions
```

### Development

```bash
# Start Convex backend (runs in background, syncs functions)
npx convex dev

# In a separate terminal, start the Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

## Usage

1. Enter your name on the landing page
2. Create a new session from the lobby (you become the professor/creator)
3. Share the session code with students
4. Start teaching -- draw on the whiteboard, then hit "Check-In" to synthesize and probe students
5. AI matches students into complementary groups automatically
6. Monitor group discussions and view AI-generated summaries
