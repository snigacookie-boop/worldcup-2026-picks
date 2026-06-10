import { useState } from 'react';
import { CircleUserRound, LockKeyhole, Mail, UserPlus, ArrowLeft } from 'lucide-react';
import { authMessage, requestPasswordReset, signIn, signUp } from '../authClient.js';

export default function Auth({ initialError = '', onAuthenticated }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [info, setInfo] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const name = username.trim();
        if (name.length < 3) throw new Error('Username must be at least 3 characters.');
        const user = await signUp(email, password, name);
        if (user?.emailVerified) {
          onAuthenticated(user);
        } else {
          setInfo('Check your email to confirm the account, then sign in.');
          setMode('signin');
        }
      } else if (mode === 'forgot') {
        await requestPasswordReset(email.trim());
        setInfo('Reset link sent. Check your email and click the link to choose a new password.');
      } else {
        onAuthenticated(await signIn(email, password));
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand auth-brand"><span className="badge">26</span> World Cup Pick'em</div>

        {mode !== 'forgot' && (
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')} type="button">
              <LockKeyhole size={16} /> Sign in
            </button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')} type="button">
              <UserPlus size={16} /> Sign up
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="auth-tabs" role="tablist" aria-label="Reset password">
            <button className="active" type="button">
              <Mail size={16} /> Reset password
            </button>
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Username
              <span className="input-wrap">
                <CircleUserRound size={18} />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={24}
                />
              </span>
            </label>
          )}
          <label>
            Email
            <span className="input-wrap">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </span>
          </label>
          {mode !== 'forgot' && (
            <label>
              Password
              <span className="input-wrap">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                />
              </span>
            </label>
          )}
          {error && <div className="notice error">{error}</div>}
          {info && <div className="notice ok">{info}</div>}
          <button className="primary action-button" disabled={busy} type="submit">
            {mode === 'signup' ? <UserPlus size={17} /> : mode === 'forgot' ? <Mail size={17} /> : <LockKeyhole size={17} />}
            {busy ? 'Working...' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>

          {mode === 'signin' && (
            <button className="auth-link" type="button" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
          )}
          {mode === 'forgot' && (
            <button className="auth-link" type="button" onClick={() => switchMode('signin')}>
              <ArrowLeft size={14} /> Back to sign in
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
