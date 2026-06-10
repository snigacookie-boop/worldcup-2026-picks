import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';

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
    </section>
  );
}
