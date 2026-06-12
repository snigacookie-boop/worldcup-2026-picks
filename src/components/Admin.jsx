import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Trash2 } from 'lucide-react';
import { adminDeletePick, adminSetPick, getPicksForMatch, getProfiles } from '../api.js';
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
    </section>
  );
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
