import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { fetchState, savePick, saveRoundPoints, syncScores } from './api.js';
import { authMessage, initializeIdentity, signOut, subscribeToIdentity } from './authClient.js';
import { supabase } from './supabaseClient.js';
import Auth from './components/Auth.jsx';
import Layout from './components/Layout.jsx';
import Schedule from './components/Schedule.jsx';
import Picks from './components/Picks.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import Admin from './components/Admin.jsx';
import ResetPassword from './components/ResetPassword.jsx';

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState(undefined);
  const [state, setState] = useState(null);
  const [loadingState, setLoadingState] = useState(false);
  const [busyMatch, setBusyMatch] = useState('');
  const [error, setError] = useState('');

  // The password-reset URL must render regardless of auth state — supabase-js processes
  // the link's hash and creates a recovery session, but the user may not be set yet.
  if (location.pathname === '/reset-password') return <ResetPassword />;

  useEffect(() => {
    let mounted = true;
    initializeIdentity()
      .then((current) => { if (mounted) setUser(current || null); })
      .catch((err) => {
        if (mounted) {
          setError(authMessage(err));
          setUser(null);
        }
      });
    const unsubscribe = subscribeToIdentity((nextUser) => {
      setUser(nextUser || null);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const loadState = useCallback(async (silent = false) => {
    if (!silent) setLoadingState(true);
    setError('');
    try {
      const next = await fetchState();
      setState(next);
    } catch (err) {
      if (err.status === 401) {
        setState(null);
        setUser(null);
      } else {
        setError(err.message);
      }
    } finally {
      if (!silent) setLoadingState(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setState(null);
      return undefined;
    }
    loadState();
    // Polling fallback (every 60s) in case realtime drops.
    const timer = window.setInterval(() => loadState(true), 60000);
    // Realtime: any change to matches / picks / rounds triggers a silent refresh.
    const channel = supabase
      .channel('app-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadState(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'picks' },   () => loadState(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' },  () => loadState(true))
      .subscribe();
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [loadState, user]);

  const currentRank = useMemo(() => {
    if (!state?.profile) return null;
    const index = state.leaderboard.findIndex((row) => row.userId === state.profile.userId);
    return index >= 0 ? index + 1 : null;
  }, [state]);

  const onSignOut = async () => {
    await signOut();
    setUser(null);
    setState(null);
  };

  const onPick = async (matchId, pick) => {
    setBusyMatch(matchId);
    setError('');
    try {
      setState(await savePick(matchId, pick));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyMatch('');
    }
  };

  const onSaveRounds = async (rounds) => {
    setError('');
    const next = await saveRoundPoints(rounds);
    setState(next);
    return next;
  };

  const onSyncScores = async () => {
    setError('');
    const result = await syncScores();
    await loadState(true);
    return result;
  };

  if (user === undefined) {
    return <div className="boot">Loading...</div>;
  }

  if (!user) {
    return <Auth initialError={error} onAuthenticated={setUser} />;
  }

  return (
    <Layout
      state={state}
      loading={loadingState}
      rank={currentRank}
      onRefresh={() => loadState()}
      onSignOut={onSignOut}
    >
      {error && <div className="notice error">{error}</div>}
      {!state && loadingState ? (
        <div className="boot">Loading tournament...</div>
      ) : (
        <Routes>
          <Route path="/" element={<Navigate to="/schedule" replace />} />
          <Route path="/schedule" element={<Schedule state={state} />} />
          <Route path="/picks" element={<Picks state={state} busyMatch={busyMatch} onPick={onPick} />} />
          <Route path="/leaderboard" element={<Leaderboard state={state} />} />
          {state?.profile?.isAdmin && (
            <Route
              path="/admin"
              element={<Admin state={state} onSaveRounds={onSaveRounds} onSyncScores={onSyncScores} />}
            />
          )}
          <Route path="*" element={<Navigate to="/schedule" replace />} />
        </Routes>
      )}
    </Layout>
  );
}
