// Pulls fixtures + live scores from football-data.org and upserts into Supabase.
// Runs on a schedule (see netlify.toml) and on-demand from the admin "Sync now" button.
//
// Uses the SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS to write to public.matches.
// The service role key MUST NOT be exposed to the client — Netlify env vars are server-only.

import { createClient } from '@supabase/supabase-js';

const COMP = process.env.FOOTBALL_DATA_COMPETITION || 'WC';

// Map football-data.org "stage" strings to our round IDs.
const STAGE_TO_ROUND = {
  GROUP_STAGE:    'group',
  LAST_32:        'r32',
  ROUND_OF_32:    'r32',
  LAST_16:        'r16',
  ROUND_OF_16:    'r16',
  QUARTER_FINALS: 'quarter',
  SEMI_FINALS:    'semi',
  THIRD_PLACE:    'third',
  FINAL:          'final',
};

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE']);

function deriveWinner(m) {
  if (m.status !== 'FINISHED') return null;
  const h = m.score?.fullTime?.home;
  const a = m.score?.fullTime?.away;
  if (h == null || a == null) return null;
  if (h > a) return 'HOME';
  if (a > h) return 'AWAY';
  return 'DRAW';
}

function mapStatus(s) {
  if (s === 'FINISHED') return 'FINISHED';
  if (s === 'POSTPONED' || s === 'CANCELLED' || s === 'SUSPENDED') return 'POSTPONED';
  if (LIVE_STATUSES.has(s)) return 'LIVE';
  return 'SCHEDULED';
}

function normalizeMatch(m) {
  return {
    id: `football-data-${m.id}`,
    external_id: String(m.id),
    round_id: STAGE_TO_ROUND[m.stage] || 'group',
    home_team: m.homeTeam?.name || m.homeTeam?.shortName || 'TBD',
    away_team: m.awayTeam?.name || m.awayTeam?.shortName || 'TBD',
    home_code: m.homeTeam?.tla || null,
    away_code: m.awayTeam?.tla || null,
    kickoff: m.utcDate,
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    status: mapStatus(m.status),
    winner: deriveWinner(m),
    venue: m.venue || null,
    city: null,
    elapsed: null,
    updated_at: new Date().toISOString(),
    // Intentionally do NOT overwrite `goals` here — football-data.org free tier doesn't include
    // scorers. The DB default '[]' applies on insert; on update we leave the column alone via
    // the upsert pattern below.
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async (req) => {
  if (!['GET', 'POST'].includes(req.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !supabaseUrl || !serviceKey) {
    return json({ error: 'Missing one of FOOTBALL_DATA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Pull fixtures.
  const resp = await fetch(`https://api.football-data.org/v4/competitions/${COMP}/matches`, {
    headers: { 'X-Auth-Token': apiKey },
  });
  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: `football-data ${resp.status}: ${text}` }, 502);
  }
  const payload = await resp.json();
  const matches = Array.isArray(payload.matches) ? payload.matches : [];

  if (matches.length === 0) {
    return json({ ok: true, upserted: 0, note: 'No matches returned for competition ' + COMP });
  }

  const rows = matches.map(normalizeMatch);
  const { error } = await sb.from('matches').upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    provider: 'football-data.org',
    competition: COMP,
    upserted: rows.length,
  });
};
