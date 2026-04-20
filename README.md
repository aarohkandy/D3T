# D3T

D3T is a Next.js + TypeScript web app for three-layer Grandfather Tic-Tac-Toe. The production path is now built around:

- Supabase Auth
- Supabase Postgres
- Supabase Realtime
- Vercel hosting

The first public beta is challenge-first. Quick Play stays disabled in the production path until a persistent queue and its QA pass are ready.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Localhost behavior

If you do **not** set the Supabase keys and `DATABASE_URL`, the app automatically falls back to:

- local cookie auth
- in-memory data
- mock realtime refresh

That keeps localhost usable while the hosted stack is being provisioned.

If you **do** set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

then the app uses the real beta architecture locally too.

## Database

The schema lives in [src/lib/db/schema.ts](C:/Users/aak/Downloads/D3T/src/lib/db/schema.ts) and Drizzle migrations are generated into `drizzle/`.

Useful commands:

```bash
npm run db:generate
npm run db:push
```

## Auth and beta flow

- Signed-out users create an account with email + password.
- Sign-up collects a unique username and display name.
- Signed-in users send and accept friend challenges by username.
- Live games persist clocks, moves, reconnect timestamps, and disconnect forfeits in Postgres.
- Realtime UI refresh comes from Supabase Realtime channel subscriptions.

## Vercel deployment

Use Vercel Preview deployments first, then promote to Production only after the full beta smoke test passes:

- sign up
- sign in
- challenge by username
- accept / decline
- full live game
- resign
- reconnect
- disconnect forfeit

Required production env vars:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## Verification

Current local verification commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
