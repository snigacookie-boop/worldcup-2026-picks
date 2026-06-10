import { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Schedule from './components/Schedule.jsx';
import Picks from './components/Picks.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Admin from './components/Admin.jsx';
import { demoState } from './demoState.js';

// Renders the full UI with mock data so the design can be previewed
// without Netlify Identity or API-Football set up.
export default function DemoApp() {
  const [state, setState] = useState(demoState);
  const [busyMatch, setBusyMatch] = useState('');

  const currentRank = useMemo(() => {
    const i = state.leaderboard.findIndex(r => r.userId === state.profile.userId);
    return i >= 0 ? i + 1 : null;
  }, [state]);

  const onPick = async (matchId, pick) => {
    setBusyMatch(matchId);
    setState(s => ({ ...s, picks: { ...s.picks, [matchId]: pick } }));
    setBusyMatch('');
  };

  const onSaveRounds = async (rounds) => {
    setState(s => ({ ...s, rounds }));
    return { ...state, rounds };
  };

  const onSyncScores = async () => ({ upserted: state.matches.length, provider: 'Demo' });

  return (
    <Layout
      state={state}
      loading={false}
      rank={currentRank}
      onRefresh={() => {}}
      onSignOut={() => alert('Sign out is disabled in demo mode.')}
    >
      <div className="notice ok" style={{ marginBottom: 12 }}>
        Demo mode — data is mocked locally. Disable by removing VITE_DEMO from .env.local.
      </div>
      <Routes>
        <Route path="/" element={<Navigate to="/schedule" replace />} />
        <Route path="/schedule" element={<Schedule state={state} />} />
        <Route path="/picks" element={<Picks state={state} busyMatch={busyMatch} onPick={onPick} />} />
        <Route path="/leaderboard" element={<Leaderboard state={state} />} />
        <Route path="/admin" element={<Admin state={state} onSaveRounds={onSaveRounds} onSyncScores={onSyncScores} />} />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </Layout>
  );
}
