# Cordless

Cordless is a Discord-style MVP focused on:
- username + password registration/login
- adding people as friends
- live friend request notifications
- fast deployment to Vercel
- Supabase Postgres as backend

## Architecture

This version uses **custom app auth** stored in Postgres:
1. Next.js Route Handlers for auth + friend APIs
2. Supabase Postgres tables (`app_users`, `app_sessions`, `friend_requests`)
3. HttpOnly cookie sessions
4. Client polling every few seconds for request notifications

This keeps the UX exactly username/password (no synthetic email aliasing).

## Vercel + Supabase networking (IPv4 question)

If you add direct Postgres connections from Vercel server functions, use Supabase pooler URLs.
For this app, APIs already run through Next.js route handlers and the Supabase client SDK.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill env values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

4. Create DB schema:
- Open Supabase SQL editor
- Run `supabase/schema.sql`

5. Run locally:

```bash
npm run dev
```

## MVP flows implemented

- Sign up with username + password
- Log in with username + password
- Password stored hashed in database
- Session stored in `app_sessions` with secure HttpOnly cookie
- Add friend by username with existence checks
- Incoming friend request list with Accept action
- Notification appears when a new request is detected

## Security note

Because auth/session logic is custom, all database writes happen server-side using `SUPABASE_SERVICE_ROLE_KEY`.
Do not expose service role keys to the browser.

## Troubleshooting

- **"Failed to create account" (500)** usually means one of these:
  1. `SUPABASE_SERVICE_ROLE_KEY` is missing or incorrect.
  2. You have not executed `supabase/schema.sql` (missing `app_users`/`app_sessions`).

Check your `.env.local`, restart the dev server, and rerun the schema SQL.

- **Friend request is inserted in DB but UI says send failed / receiver sees nothing**:
  1. Ensure both users are logged in (valid `cordless_session` cookie).
  2. Open browser devtools network tab and inspect `/api/friends/request` and `/api/friends/list` responses.
  3. This app now returns detailed API errors for duplicate/race and list-query failures so the status text should explain the exact cause.
