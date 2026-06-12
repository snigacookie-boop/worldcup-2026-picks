import { NavLink } from 'react-router-dom';
import { CalendarDays, ListChecks, LogOut, RefreshCw, Settings, Trophy } from 'lucide-react';

export default function Layout({ state, loading, rank, onRefresh, onSignOut, children }) {
  const profile = state?.profile;
  const myRow = state?.leaderboard?.find((row) => row.userId === profile?.userId);
  const linkClass = ({ isActive }) => (isActive ? 'active' : '');

  return (
    <div>
      <header className="topbar">
        <div className="brand"><span className="badge">26</span> World Cup Pick'em</div>
        <nav className="nav" aria-label="Primary navigation">
          <NavLink to="/schedule" className={linkClass}><CalendarDays size={17} /> Schedule</NavLink>
          <NavLink to="/picks" className={linkClass}><ListChecks size={17} /> My Picks</NavLink>
          <NavLink to="/leaderboard" className={linkClass}><Trophy size={17} /> Standings</NavLink>
          {profile?.isAdmin && <NavLink to="/admin" className={linkClass}><Settings size={17} /> Admin</NavLink>}
        </nav>
        <button className="icon-button" onClick={onRefresh} disabled={loading} title="Refresh scores and standings">
          <RefreshCw size={18} />
        </button>
        <button className="icon-button" onClick={onSignOut} title="Sign out">
          <LogOut size={18} />
        </button>
      </header>

      <main className="container">
        <section className="scoreboard">
          <div className="scoreboard-copy">
            <span className="eyebrow">FIFA World Cup 2026</span>
            <h1>{profile?.username || 'Player'}</h1>
          </div>
          <div className="stat-strip" aria-label="Tournament summary">
            <div><span>{myRow?.points ?? 0}</span><small>Points</small></div>
            <div><span>{rank || '-'}</span><small>Rank</small></div>
            <div><span>{state?.totals?.open ?? 0}</span><small>Open</small></div>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
