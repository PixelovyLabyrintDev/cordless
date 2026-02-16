# Cordless

Cordless is a Discord-style MVP focused on:
- simple direct text messaging
- adding people as friends
- fast deployment to Vercel
- Supabase as the backend (Auth + Postgres + Realtime)

## Why this architecture?

Instead of running a custom websocket server (hard on serverless platforms), this setup uses:
1. **Supabase Auth** for user identity
2. **Supabase Postgres** for durable data
3. **Supabase Realtime** for live messages
4. **Vercel** to host the Next.js app

This is the easiest path to production with the tooling you already have.

## Vercel + Supabase networking (IPv4 question)

Short answer: **yes, if you need a Postgres connection from Vercel, use Supabase's pooler connection string**.

- For this current MVP, the app talks to Supabase via `@supabase/supabase-js` (HTTP/WebSocket APIs), so you usually do **not** need a raw Postgres connection from Vercel.
- If you later add a server-side DB client (Prisma, Drizzle, `pg`, migrations, cron jobs), use Supabase's **Supavisor pooler** connection strings from the project dashboard.

### Which pooler mode should I use?

- **Transaction pooler**: best default for serverless runtime queries (many short-lived requests).
- **Session pooler**: use when your library/tool needs session-level behavior (some ORMs or long-lived operations).

A practical setup is:
- runtime app queries on Vercel → **pooler URL**
- migrations/admin scripts → **direct connection URL** (run from local/CI where supported)

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

Then fill in your Supabase URL + anon key.

3. Create DB schema:
- Open Supabase SQL editor
- Run `supabase/schema.sql`

4. Enable Anonymous Sign-in:
- Supabase Dashboard → Authentication → Providers
- Turn on **Anonymous**

5. Run locally:

```bash
npm run dev
```

6. Deploy:
- Push to GitHub
- Import repo in Vercel
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars
- If you add server-side SQL access, also add the pooler-based `DATABASE_URL`

## MVP flows implemented

- Anonymous session on first load
- User chooses a unique handle (`profiles` table)
- Send a friend request by handle (`friend_requests` table)
- Send direct message by handle (`direct_messages` table)
- Receive realtime message inserts via Supabase Realtime

## Next improvements (recommended)

1. Convert friend request list from raw JSON to polished cards.
2. Add accept/decline actions for pending requests.
3. Resolve sender/receiver IDs to handles in message list.
4. Add conversation view grouped by friend.
5. Move write operations to Next.js server actions if you want stricter control.
6. Add rate limiting and anti-spam moderation rules.
