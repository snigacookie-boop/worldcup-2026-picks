// Data layer: talks directly to Supabase using the anon key + RLS.
// Keeps the same function names the rest of the app already imports.

import { supabase } from './supabaseClient.js';

function camelMatch(row) {
  return {
    id: row.id,
    externalId: row.external_id,
    roundId: row.round_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeCode: row.home_code,
    awayCode: row.away_code,
    kickoff: row.kickoff,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    winner: row.winner,
    venue: row.venue,
    city: row.city,
    elapsed: row.elapsed,
    goals: Array.isArray(row.goals) ? row.goals : [],
    updatedAt: row.updated_at,
  };
}

function camelRound(row) {
  return {
    id: row.id,
    name: row.name,
    pointsPerCorrect: row.points_per_correct,
    displayOrder: row.display_order,
  };
}

function camelLeaderRow(row) {
  return {
    userId: row.user_id,
    username: row.username,
    points: row.points,
    picksMade: row.picks_made,
    picksSettled: row.picks_settled,
  };
}

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, is_admin')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return { userId: data.id, username: data.username, isAdmin: data.is_admin };
}

async function getRounds() {
  const { data, error } = await supabase.from('rounds').select('*').order('display_order');
  if (error) throw error;
  return (data || []).map(camelRound);
}

async function getMatches() {
  const { data, error } = await supabase.from('matches').select('*').order('kickoff');
  if (error) throw error;
  return (data || []).map(camelMatch);
}

async function getMyPicks(userId) {
  const { data, error } = await supabase.from('picks').select('match_id, pick').eq('user_id', userId);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.match_id, p.pick]));
}

async function getLeaderboard() {
  const { data, error } = await supabase.from('leaderboard').select('*');
  if (error) throw error;
  return (data || []).map(camelLeaderRow);
}

function summarize(matches) {
  const now = Date.now();
  return {
    matches: matches.length,
    live: matches.filter((m) => m.status === 'LIVE').length,
    finished: matches.filter((m) => m.status === 'FINISHED').length,
    open: matches.filter((m) => m.status === 'SCHEDULED' && new Date(m.kickoff).getTime() > now).length,
  };
}

export async function fetchState() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const err = new Error('Not signed in');
    err.status = 401;
    throw err;
  }
  const [profile, rounds, matches, picks, leaderboard] = await Promise.all([
    getProfile(user.id),
    getRounds(),
    getMatches(),
    getMyPicks(user.id),
    getLeaderboard(),
  ]);
  return {
    profile,
    rounds,
    matches,
    picks,
    leaderboard,
    totals: summarize(matches),
    syncedAt: new Date().toISOString(),
  };
}

export async function savePick(matchId, pick) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { const e = new Error('Not signed in'); e.status = 401; throw e; }

  const { error } = await supabase.from('picks').upsert(
    {
      user_id: user.id,
      match_id: matchId,
      pick,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,match_id' },
  );
  if (error) throw error;
  return fetchState();
}

export async function saveRoundPoints(rounds) {
  // rounds: [{ id, pointsPerCorrect }]
  for (const r of rounds) {
    const { error } = await supabase
      .from('rounds')
      .update({ points_per_correct: Number(r.pointsPerCorrect) })
      .eq('id', r.id);
    if (error) throw error;
  }
  return fetchState();
}

// Admin: list every profile (id + username) for the pick-correction table.
export async function getProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .order('username');
  if (error) throw error;
  return (data || []).map((p) => ({ userId: p.id, username: p.username }));
}

// Admin: every pick for a given match, keyed by userId.
export async function getPicksForMatch(matchId) {
  const { data, error } = await supabase
    .from('picks')
    .select('user_id, pick')
    .eq('match_id', matchId);
  if (error) throw error;
  return Object.fromEntries((data || []).map((p) => [p.user_id, p.pick]));
}

// Admin override: upsert a pick on behalf of any user. Bypasses kickoff lock via picks_admin_write RLS.
export async function adminSetPick(userId, matchId, pick) {
  const { error } = await supabase.from('picks').upsert(
    { user_id: userId, match_id: matchId, pick, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,match_id' },
  );
  if (error) throw error;
}

// Admin override: remove a pick on behalf of any user.
export async function adminDeletePick(userId, matchId) {
  const { error } = await supabase
    .from('picks')
    .delete()
    .eq('user_id', userId)
    .eq('match_id', matchId);
  if (error) throw error;
}

export async function syncScores() {
  const res = await fetch('/.netlify/functions/sync-scores', { method: 'POST' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error || `Sync failed with ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return payload;
}
