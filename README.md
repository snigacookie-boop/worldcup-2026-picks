# World Cup 2026 Pick'em

A browser-based pick'em tournament for the FIFA World Cup 2026.

- **Frontend:** React + Vite, deployed on Netlify.
- **Auth + Database:** Supabase (email/password, Postgres, row-level security, realtime).
- **Scores:** football-data.org, pulled by a Netlify scheduled function every 10 min.
- **Picks:** Users pick winner (or draw) per match. Admin sets points-per-round independently.

No server runs locally — everything is hosted.

---

## One-time setup (about 15 minutes)

### 1. Create the Supabase project

1. Go to https://supabase.com and create a free project. Save the DB password somewhere safe.
2. Open the **SQL editor**, paste the contents of `supabase/schema.sql`, and run.
3. In **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never commit, never expose to the client)
4. (Optional, recommended while testing) In **Authentication → Providers → Email**, disable "Confirm email" so signups work instantly. Re-enable for production.

### 2. Get a football-data.org API key

1. Register at https://www.football-data.org/client/register and copy the token.
2. The free tier allows 10 req/min with no daily cap — comfortable for a 10-minute scheduled sync.
3. The competition code is usually `WC`; if it changes at tournament time, set `FOOTBALL_DATA_COMPETITION`.

### 3. Push to GitHub

```sh
cd worldcup-2026-picks
git init
git add .
git commit -m "Initial scaffold"
git branch -M main
git remote add origin https://github.com/<you>/worldcup-2026-picks.git
git push -u origin main
```

### 4. Deploy on Netlify

1. https://app.netlify.com → **Add new site → Import from Git** and pick the repo.
2. Build settings are auto-detected from `netlify.toml` (`npm run build`, publish `dist`).
3. **Site settings → Environment variables** — add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FOOTBALL_DATA_API_KEY`
   - `FOOTBALL_DATA_COMPETITION` (e.g. `WC`)
4. Trigger a deploy. The site comes up at `https://<your-site>.netlify.app`.

### 5. Make yourself admin

1. Sign up on the live site with email + username + password.
2. In Supabase → **Table editor → profiles**, find your row and set `is_admin` to `true`.
3. Reload — the **Admin** tab appears.

### 6. Pull the schedule

In the Admin tab, click **Sync scores**. The schedule populates from football-data.org. After that the Netlify scheduled function keeps it fresh every 10 minutes.

---

## How users use it

1. **Sign up** with email + username + password.
2. **Schedule** — every match with flag, kickoff, venue, status (Live / Finished / Scheduled).
3. **My Picks** — pick Home / Draw / Away. Picks lock at kickoff (enforced by Postgres RLS, not just the UI).
4. **Standings** — live leaderboard. Points recompute whenever a match finishes — done server-side by the `leaderboard` view.

## How you (the admin) use it

- **Sync scores** — force a fresh pull from football-data.org.
- **Round points** — set the points-per-correct-pick for each round independently. The leaderboard view recalculates automatically.

## Architecture notes

- **Scoring** is a Postgres view (`public.leaderboard`) that joins picks → matches → rounds and sums `points_per_correct` whenever `picks.pick = matches.winner`. Zero client-side scoring logic.
- **Pick locking** is enforced by RLS: the database rejects `INSERT`/`UPDATE`/`DELETE` on `picks` for matches whose `kickoff <= now()`.
- **Live updates** use Supabase Realtime channels. The React app subscribes to `matches`, `picks`, and `rounds` changes — UI refreshes automatically with no polling needed (a 60s poll is kept as a safety net).
- **Goal scorers** — football-data.org's free tier does not include scorers. The `goals` JSONB column exists in the schema and the UI renders a scorer list when populated; you can add scorers manually via the Supabase table editor, or upgrade to a paid data source later.

## Local dev (optional)

You don't need this to ship. To iterate locally:

```sh
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

The `sync-scores` function only runs on Netlify. To test it locally, use `netlify dev` from the Netlify CLI.

**Preview without a backend:** set `VITE_DEMO=1` in `.env.local` to render mocked data. Useful for design iteration.

## Troubleshooting

- **"No matches yet"** — sync hasn't run, or `FOOTBALL_DATA_COMPETITION` is wrong. Hit Sync scores and check the Netlify function logs.
- **Sign-up succeeds, no profile row appears** — the `handle_new_user` trigger didn't fire. Re-run `supabase/schema.sql`.
- **Admin tab missing after flipping `is_admin`** — sign out and back in to refresh the profile fetch.
- **Picks won't save** — match kickoff is in the past; RLS blocks edits at or after kickoff.
- **Realtime not updating** — confirm in Supabase → Database → Replication that `matches`, `picks`, `rounds` are added to `supabase_realtime` (the schema script does this automatically).
