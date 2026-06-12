import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Trash2, Plus, Sparkles } from 'lucide-react';
import { adminDeleteBonusQuestion, adminDeletePick, adminSaveBonusQuestion, adminSetPick, getPicksForMatch, getProfiles } from '../api.js';
import { fmtKickoff } from '../lib/format.js';

export default function Admin({ state, onSaveRounds, onSyncScores }) {
  const [drafts, setDrafts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDrafts(state?.rounds || []);
  }, [state?.rounds]);

  const changePoints = (id, value) => {
    setDrafts((rounds) => rounds.map((round) => (
      round.id === id ? { ...round, pointsPerCorrect: Number(value) } : round
    )));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await onSaveRounds(drafts);
      setMessage('Round points saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setError('');
    setMessage('');
    try {
      const result = await onSyncScores();
      setMessage(`Synced ${result.upserted || 0} fixtures from ${result.provider || 'provider'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="view">
      <div className="view-head">
        <h2>Admin</h2>
        <button className="primary action-button" onClick={sync} disabled={syncing} type="button">
          <RefreshCw size={17} /> {syncing ? 'Syncing...' : 'Sync scores'}
        </button>
      </div>

      {message && <div className="notice ok">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <section className="admin-panel">
        <div className="round-head">
          <h3>Round Points</h3>
          <button className="action-button" onClick={save} disabled={saving} type="button">
            <Save size={17} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                <th>Round</th>
                <th>Points per correct pick</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((round) => (
                <tr key={round.id}>
                  <td><strong>{round.name}</strong></td>
                  <td>
                    <input
                      className="points-input"
                      type="number"
                      min="0"
                      value={round.pointsPerCorrect}
                      onChange={(event) => changePoints(round.id, event.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ManagePicks matches={state?.matches || []} />
      <ManageBonus questions={state?.bonusQuestions || []} />
    </section>
  );
}

function ManageBonus({ questions }) {
  const [drafts, setDrafts] = useState({}); // id -> partial overrides
  const [newQ, setNewQ] = useState({ id: '', prompt: '', points: 5, lockAt: '2026-06-27T00:00', options: '', correctAnswer: '', displayOrder: 100 });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const onChange = (id, field, value) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  };

  const saveOne = async (q) => {
    setBusy(q.id); setError(''); setOk('');
    const patch = drafts[q.id] || {};
    const next = {
      id: q.id,
      prompt: patch.prompt ?? q.prompt,
      options: 'options' in patch ? parseOptions(patch.options) : q.options,
      points: patch.points ?? q.points,
      lockAt: patch.lockAt != null ? toIso(patch.lockAt) : q.lockAt,
      correctAnswer: patch.correctAnswer ?? q.correctAnswer ?? '',
      displayOrder: patch.displayOrder ?? q.displayOrder,
    };
    try {
      await adminSaveBonusQuestion(next);
      setOk(`Saved: ${next.prompt}`);
      setDrafts((d) => { const c = { ...d }; delete c[q.id]; return c; });
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const removeOne = async (q) => {
    if (!window.confirm(`Delete "${q.prompt}" and all answers to it?`)) return;
    setBusy(q.id); setError(''); setOk('');
    try { await adminDeleteBonusQuestion(q.id); setOk('Deleted.'); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const addNew = async () => {
    const id = newQ.id.trim();
    if (!id) { setError('ID is required (e.g. "winner").'); return; }
    if (!newQ.prompt.trim()) { setError('Prompt is required.'); return; }
    setBusy('new'); setError(''); setOk('');
    try {
      await adminSaveBonusQuestion({
        id,
        prompt: newQ.prompt.trim(),
        options: parseOptions(newQ.options),
        points: Number(newQ.points) || 0,
        lockAt: toIso(newQ.lockAt),
        correctAnswer: newQ.correctAnswer.trim() || null,
        displayOrder: Number(newQ.displayOrder) || 0,
      });
      setOk('Question added.');
      setNewQ({ id: '', prompt: '', points: 5, lockAt: '2026-06-27T00:00', options: '', correctAnswer: '', displayOrder: 100 });
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  return (
    <section className="admin-panel">
      <div className="round-head">
        <h3><Sparkles size={18} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Bonus questions</h3>
        <span className="muted">Lock locks editing for players. Set "Correct" after the tournament to award points.</span>
      </div>

      {error && <div className="notice error">{error}</div>}
      {ok && <div className="notice ok">{ok}</div>}

      <div className="table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Prompt</th>
              <th>Options (comma-sep, blank = free text)</th>
              <th>Points</th>
              <th>Lock at (UTC)</th>
              <th>Correct</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => {
              const patch = drafts[q.id] || {};
              const opts = 'options' in patch ? patch.options : (q.options ? q.options.join(', ') : '');
              return (
                <tr key={q.id}>
                  <td><strong>{q.id}</strong></td>
                  <td><input value={patch.prompt ?? q.prompt} onChange={(e) => onChange(q.id, 'prompt', e.target.value)} /></td>
                  <td><input value={opts} placeholder="Argentina, Brazil, France..." onChange={(e) => onChange(q.id, 'options', e.target.value)} /></td>
                  <td style={{ width: 80 }}><input type="number" min="0" value={patch.points ?? q.points} onChange={(e) => onChange(q.id, 'points', e.target.value)} /></td>
                  <td style={{ width: 180 }}><input type="datetime-local" value={patch.lockAt ?? fromIso(q.lockAt)} onChange={(e) => onChange(q.id, 'lockAt', e.target.value)} /></td>
                  <td><input value={patch.correctAnswer ?? q.correctAnswer ?? ''} placeholder="Set after tournament" onChange={(e) => onChange(q.id, 'correctAnswer', e.target.value)} /></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button type="button" disabled={busy === q.id} onClick={() => saveOne(q)} title="Save"><Save size={15} /></button>
                    <button type="button" disabled={busy === q.id} onClick={() => removeOne(q)} title="Delete"><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td><input value={newQ.id} placeholder="e.g. winner" onChange={(e) => setNewQ({ ...newQ, id: e.target.value })} /></td>
              <td><input value={newQ.prompt} placeholder="Who will win the World Cup?" onChange={(e) => setNewQ({ ...newQ, prompt: e.target.value })} /></td>
              <td><input value={newQ.options} placeholder="(optional)" onChange={(e) => setNewQ({ ...newQ, options: e.target.value })} /></td>
              <td><input type="number" min="0" value={newQ.points} onChange={(e) => setNewQ({ ...newQ, points: e.target.value })} /></td>
              <td><input type="datetime-local" value={newQ.lockAt} onChange={(e) => setNewQ({ ...newQ, lockAt: e.target.value })} /></td>
              <td><input value={newQ.correctAnswer} placeholder="(blank)" onChange={(e) => setNewQ({ ...newQ, correctAnswer: e.target.value })} /></td>
              <td>
                <button type="button" disabled={busy === 'new'} className="primary action-button" onClick={addNew}>
                  <Plus size={15} /> Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function parseOptions(text) {
  if (text == null) return null;
  const trimmed = String(text).trim();
  if (!trimmed) return null;
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

function toIso(localValue) {
  if (!localValue) return null;
  // datetime-local gives 'YYYY-MM-DDTHH:mm' in the user's local zone; we store UTC.
  const d = new Date(localValue);
  return d.toISOString();
}

function fromIso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function ManagePicks({ matches }) {
  const sorted = useMemo(
    () => [...matches].sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)),
    [matches],
  );
  const [matchId, setMatchId] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [picks, setPicks] = useState({}); // userId -> 'HOME'|'AWAY'|'DRAW'
  const [busyUser, setBusyUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let cancelled = false;
    getProfiles().then((rows) => { if (!cancelled) setProfiles(rows); }).catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!matchId) { setPicks({}); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    getPicksForMatch(matchId)
      .then((rows) => { if (!cancelled) setPicks(rows); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  const setPick = async (userId, next) => {
    setBusyUser(userId);
    setError(''); setOk('');
    const prev = picks[userId];
    setPicks((p) => ({ ...p, [userId]: next }));
    try {
      await adminSetPick(userId, matchId, next);
      setOk('Pick updated.');
    } catch (e) {
      setPicks((p) => ({ ...p, [userId]: prev }));
      setError(e.message);
    } finally {
      setBusyUser('');
    }
  };

  const removePick = async (userId) => {
    setBusyUser(userId);
    setError(''); setOk('');
    const prev = picks[userId];
    setPicks((p) => { const copy = { ...p }; delete copy[userId]; return copy; });
    try {
      await adminDeletePick(userId, matchId);
      setOk('Pick removed.');
    } catch (e) {
      setPicks((p) => ({ ...p, [userId]: prev }));
      setError(e.message);
    } finally {
      setBusyUser('');
    }
  };

  const selectedMatch = sorted.find((m) => m.id === matchId);

  return (
    <section className="admin-panel">
      <div className="round-head">
        <h3>Manage picks</h3>
        <span className="muted">Override or clear picks for any user, any match.</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>
          Match
          <select value={matchId} onChange={(e) => setMatchId(e.target.value)}>
            <option value="">— Choose a match —</option>
            {sorted.map((m) => (
              <option key={m.id} value={m.id}>
                {fmtKickoff(m.kickoff)} · {m.homeTeam} vs {m.awayTeam}
                {m.status === 'FINISHED' && m.winner ? ` (won: ${m.winner})` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="notice error">{error}</div>}
      {ok && <div className="notice ok">{ok}</div>}

      {matchId && (
        <div className="table-shell">
          {loading ? (
            <p className="muted">Loading picks…</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Current</th>
                  <th>Set to</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const current = picks[p.userId] || null;
                  const correct = selectedMatch?.winner && current === selectedMatch.winner;
                  return (
                    <tr key={p.userId}>
                      <td><strong>{p.username}</strong></td>
                      <td>
                        {current ? (
                          <span className={correct ? 'ok' : ''}>{current}</span>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td>
                        <div className="pick-options" style={{ display: 'inline-grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 4 }}>
                          {['HOME', 'DRAW', 'AWAY'].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={busyUser === p.userId}
                              className={current === opt ? 'selected' : ''}
                              onClick={() => setPick(p.userId, opt)}
                            >
                              {opt[0]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        {current && (
                          <button
                            type="button"
                            disabled={busyUser === p.userId}
                            onClick={() => removePick(p.userId)}
                            title="Clear this user's pick"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
