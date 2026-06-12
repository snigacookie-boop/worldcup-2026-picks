// Sends a daily email to each user listing matches that kick off in the next 24 hours
// for which they have not yet made a pick. Skips users who are fully caught up.
//
// Requires Netlify env vars:
//   RESEND_API_KEY        - your Resend API key (https://resend.com)
//   REMINDER_FROM_EMAIL   - the From: address (e.g. picks@yourdomain.com)
//   REMINDER_SITE_URL     - the public URL of the live site (e.g. https://wc26.netlify.app)
//   SUPABASE_URL          - same as the picks app
//   SUPABASE_SERVICE_ROLE_KEY - service-role key (server-only)

import { createClient } from '@supabase/supabase-js';

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtKickoff(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });
}

function reminderHtml({ username, siteUrl, matches }) {
  const rows = matches.map((m) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e3dcc8;">
        <strong>${escape(m.home_team)}</strong> vs <strong>${escape(m.away_team)}</strong>
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #e3dcc8;color:#66706b;">
        ${escape(fmtKickoff(m.kickoff))}
      </td>
    </tr>`).join('');

  return `<!doctype html>
<html><body style="margin:0;font-family:system-ui,sans-serif;background:#f5f1e8;color:#17201b;">
  <div style="max-width:560px;margin:24px auto;padding:24px;background:#fffdf8;border-radius:10px;border:1px solid #d9d0c1;">
    <h2 style="margin:0 0 12px;">World Cup Pick'em — reminder</h2>
    <p>Hi ${escape(username)},</p>
    <p>The following matches kick off in the next 24 hours and you haven't picked yet:</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows}</table>
    <p>
      <a href="${escape(siteUrl)}/picks" style="display:inline-block;background:#bd1f2d;color:white;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700;">
        Make your picks
      </a>
    </p>
    <p style="color:#66706b;font-size:13px;margin-top:24px;">
      Picks lock at kickoff. After that no one — not even the admin via this email — can change them.
    </p>
  </div>
</body></html>`;
}

async function sendEmail({ apiKey, from, to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  return res.json();
}

export default async (req) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  const siteUrl = process.env.REMINDER_SITE_URL;

  if (!supabaseUrl || !serviceKey || !apiKey || !from || !siteUrl) {
    return new Response(JSON.stringify({
      error: 'Missing env var. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, REMINDER_FROM_EMAIL, REMINDER_SITE_URL.',
    }), { status: 500 });
  }

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. Matches in the next 24h that are still open for picks.
  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: matches, error: mErr } = await sb.from('matches')
    .select('id, home_team, away_team, kickoff, status')
    .gte('kickoff', now.toISOString())
    .lte('kickoff', cutoff.toISOString())
    .eq('status', 'SCHEDULED')
    .order('kickoff');
  if (mErr) return new Response(JSON.stringify({ error: mErr.message }), { status: 500 });
  if (!matches || matches.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, note: 'No upcoming matches in next 24h.' }));
  }
  const matchIds = matches.map((m) => m.id);

  // 2. All users (id + email) — service role can read auth.users via admin API.
  const { data: usersData, error: uErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (uErr) return new Response(JSON.stringify({ error: uErr.message }), { status: 500 });
  const users = (usersData?.users || []).filter((u) => u.email);

  // 3. Profile usernames.
  const { data: profiles } = await sb.from('profiles').select('id, username');
  const usernameById = Object.fromEntries((profiles || []).map((p) => [p.id, p.username]));

  // 4. All picks on those matches.
  const { data: picks } = await sb.from('picks').select('user_id, match_id').in('match_id', matchIds);
  const pickedByUser = new Map();
  for (const p of picks || []) {
    if (!pickedByUser.has(p.user_id)) pickedByUser.set(p.user_id, new Set());
    pickedByUser.get(p.user_id).add(p.match_id);
  }

  // 5. For each user, send a reminder if any of those matches is unpicked.
  let sent = 0;
  const failures = [];
  for (const u of users) {
    const picked = pickedByUser.get(u.id) || new Set();
    const missing = matches.filter((m) => !picked.has(m.id));
    if (missing.length === 0) continue;
    try {
      await sendEmail({
        apiKey,
        from,
        to: u.email,
        subject: `World Cup picks reminder — ${missing.length} match${missing.length === 1 ? '' : 'es'} closing soon`,
        html: reminderHtml({ username: usernameById[u.id] || u.email, siteUrl, matches: missing }),
      });
      sent += 1;
    } catch (e) {
      failures.push({ email: u.email, error: e.message });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, considered: users.length, matches: matches.length, failures }), {
    headers: { 'content-type': 'application/json' },
  });
};
