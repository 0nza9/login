# Day 2 — Roles & Admin User Management

Goal: add `admin` / `user` roles and let **only an admin** edit users from the dashboard.

## What we used

| Piece | Why |
| --- | --- |
| **better-auth `admin` plugin** | Adds the `role` field and ready-made, server-enforced endpoints (`listUsers`, `setRole`, `banUser`, `unbanUser`, `removeUser`). |
| **`adminClient()`** on the auth client | Exposes the admin actions to the browser. |
| **Drizzle + better-sqlite3** | Added the new columns to the schema and `ALTER`ed the live `sqlite.db`. |
| **SvelteKit `locals` + `hooks.server.ts`** | Resolve the session once per request so routes can guard. |
| **SvelteKit form actions** (`+page.server.ts`) | Each edit re-checks admin on the server — the hidden UI is *not* the security boundary. |
| **daisyUI / Tailwind** | The dashboard table + login toggle styling. |

## What we changed

- **`src/lib/server/auth.ts`** — registered `admin({ defaultRole: "user", adminRoles: ["admin"] })`. New sign-ups are `user`.
- **`src/lib/auth-client.ts`** — added `adminClient()`.
- **`src/lib/server/db/schema.ts`** — added `role`, `banned`, `banReason`, `banExpires` to `user`; `impersonatedBy` to `session`. Live DB migrated with matching `ALTER TABLE`s (existing users kept).
- **`src/hooks.server.ts` + `src/app.d.ts`** — populate & type `event.locals.user` / `.session`.
- **`src/routes/dashboard/+page.server.ts`** — guard (logged-out → `/login`; table only loads for admins) and `setRole` / `updateName` / `ban` / `unban` / `remove` actions, each re-checking admin. Admins can't ban/delete/demote themselves.
- **`src/routes/dashboard/+page.svelte`** — admin-only user table (edit name, change role, ban/unban, delete) + a **← Back** button to the home page.
- **`src/routes/login/+page.svelte` + `src/lib/sign-in.ts`** — sign-in / sign-up **toggle** (defaults to Sign in).
- **`scripts/make-admin.mjs`** — bootstrap script to set the very first admin directly in the DB.

## How the "only me" admin works

Roles can only be granted by an existing admin, so the first one is set out-of-band:

```bash
node scripts/make-admin.mjs your-email@example.com        # promote
node scripts/make-admin.mjs your-email@example.com user   # demote
```

The account must already exist (sign up first). Nobody can self-promote through the UI.

## Gotcha we hit

**"Invalid origin"** = better-auth rejecting a request whose browser `Origin` didn't match `BETTER_AUTH_URL` (`http://localhost:5175`). Cause: a stale dev server held port 5175, so a second `npm run dev` fell back to 5176. Fix: kill the duplicate, always open the app on **5175**.
