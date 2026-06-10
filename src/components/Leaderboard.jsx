import { Medal } from 'lucide-react';

export default function Leaderboard({ state }) {
  const rows = state?.leaderboard || [];
  const currentUserId = state?.profile?.userId;

  return (
    <section className="view">
      <div className="view-head">
        <h2>Standings</h2>
        <span className="muted">{rows.length} players</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty-panel">No players yet.</div>
      ) : (
        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Picks</th>
                <th>Settled</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.userId} className={row.userId === currentUserId ? 'mine' : ''}>
                  <td><span className="rank"><Medal size={15} /> {index + 1}</span></td>
                  <td><strong>{row.username}</strong></td>
                  <td>{row.picksMade}</td>
                  <td>{row.picksSettled}</td>
                  <td><strong>{row.points}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
