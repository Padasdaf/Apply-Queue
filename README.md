# ApplyQueue

ApplyQueue turns repetitive job applications into a reviewable queue. Save a reusable applicant profile, add a public job URL, and let the worker fill the application with verified profile information while you retain final control.

```text
Applicant profile
  → job queue
  → TypeScript worker
  → Browserbase + Stagehand
  → deterministic autofill + OpenAI reasoning
  → human review
```

ApplyQueue never submits an application automatically. Every run stops at `NEEDS_INPUT` or `READY_FOR_REVIEW`.

## Core features

- Structured applicant profile with education, employment, links, and application preferences
- Private primary-resume storage and browser-native PDF upload
- Asynchronous application queue with atomic worker claims
- Browserbase Live View for following automation in real time
- Iframe-aware ATS form discovery with Stagehand
- Deterministic matching for known applicant facts
- Structured OpenAI fallback for unresolved fields without inventing applicant information
- Human-in-the-loop questions and a persisted activity timeline
- Explicit protection against final-submission actions

## Architecture

```text
Next.js web app ── server API routes ── Supabase Postgres + Storage
                                             │
                                   atomic queue claim
                                             │
                                    TypeScript worker
                                     ├─ Browserbase
                                     ├─ Stagehand v4
                                     └─ OpenAI
```

- `apps/web` contains the Next.js interface and server-only API routes.
- `apps/worker` contains queue polling, browser orchestration, profile resolution, and field filling.
- `packages/shared` contains shared Zod schemas, types, constants, and profile helpers.
- `supabase/migrations` contains the database, Storage, RLS, and queue-claim setup.

## Setup

Requirements:

- Node.js 22.18 or newer
- npm 10+
- Supabase, Browserbase, and OpenAI credentials

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env
```

Configure `.env`:

```dotenv
BROWSERBASE_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_URL=
SUPABASE_SECRET_KEY=

WORKER_POLL_INTERVAL_MS=2000
WORKER_BROWSER_DIAGNOSTICS=false
```

Apply the Supabase migrations in timestamp order:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Start the web app and worker together:

```bash
npm run dev
```

Or start them separately:

```bash
npm run dev:web
npm run dev:worker
```

Open [http://localhost:3000](http://localhost:3000), complete the applicant profile, add a public job URL, and start the queued application.

## Safety and privacy

- The worker does not click final Submit, Finish, Send, Confirm, or Complete actions.
- Unknown required fields are returned for human input.
- Resume files remain in a private Supabase Storage bucket.
- Supabase secret, Browserbase, and OpenAI keys remain server-side.
- Applicant values and resume contents are excluded from routine logs.

## Validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
