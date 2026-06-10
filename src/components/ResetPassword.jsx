import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { authMessage, updatePassword } from '../authClient.js';

// Renders the new-password form after Supabase redirects back from the reset email.
// At this point supabase-js has already established a session from the link's hash.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/schedule', { replace: true }), 1200);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand auth-brand"><span className="badge">26</span> World Cup Pick'em</div>
        <div className="auth-tabs" role="tablist" aria-label="Set new password">
          <button className="active" type="button">
            <ShieldCheck size={16} /> Choose a new password
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            New password
            <span className="input-wrap">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </span>
          </label>
          <label>
            Confirm password
            <span className="input-wrap">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </span>
          </label>
          {error && <div className="notice error">{error}</div>}
          {done && <div className="notice ok">Password updated. Taking you to the app...</div>}
          <button className="primary action-button" disabled={busy || done} type="submit">
            <ShieldCheck size={17} /> {busy ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  );
}
