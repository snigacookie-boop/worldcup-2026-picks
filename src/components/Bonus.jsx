import { useMemo, useState } from 'react';
import { Sparkles, Lock, Check } from 'lucide-react';
import { saveBonusAnswer } from '../api.js';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function isLocked(question, now = Date.now()) {
  if (!question.lockAt) return false;
  return new Date(question.lockAt).getTime() <= now;
}

export default function Bonus({ state, onSaved }) {
  const questions = state?.bonusQuestions || [];
  const answers = state?.bonusAnswers || {};
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Earliest lock_at — shown as the global "open until" note.
  const openUntil = useMemo(() => {
    const dates = questions.map((q) => q.lockAt).filter(Boolean).map((d) => new Date(d).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates)).toISOString();
  }, [questions]);

  const allLocked = questions.length > 0 && questions.every((q) => isLocked(q));

  const setDraft = (qid, value) => setDrafts((d) => ({ ...d, [qid]: value }));

  const save = async (q) => {
    setBusyId(q.id); setError(''); setOk('');
    const value = (drafts[q.id] ?? answers[q.id] ?? '').trim();
    if (!value) { setError('Pick an answer first.'); setBusyId(''); return; }
    try {
      await saveBonusAnswer(q.id, value);
      setOk(`Saved: ${q.prompt}`);
      if (onSaved) onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId('');
    }
  };

  if (questions.length === 0) {
    return (
      <section className="view">
        <div className="view-head"><h2>Bonus picks</h2></div>
        <div className="empty-panel">No bonus questions yet. Ask the admin to add some.</div>
      </section>
    );
  }

  return (
    <section className="view">
      <div className="view-head">
        <h2><Sparkles size={20} style={{ verticalAlign: '-3px', marginRight: 6 }} /> Bonus picks</h2>
        <span className="muted">{Object.keys(answers).length} / {questions.length} answered</span>
      </div>

      <div className="notice ok" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Sparkles size={16} />
        {allLocked
          ? <span>Bonus picks are locked. Final answers settle when the admin marks them correct.</span>
          : openUntil
            ? <span>Bonus picks are open until the knockout round begins — <strong>{fmtDate(openUntil)}</strong>. You can change your answers any time before then.</span>
            : <span>Bonus picks are open. You can change your answers any time before the lock.</span>}
      </div>

      {error && <div className="notice error">{error}</div>}
      {ok && <div className="notice ok">{ok}</div>}

      <div className="match-list">
        {questions.map((q) => {
          const locked = isLocked(q);
          const current = drafts[q.id] ?? answers[q.id] ?? '';
          const saved = answers[q.id];
          const settled = q.correctAnswer != null;
          const wasCorrect = settled && saved && saved === q.correctAnswer;
          return (
            <article className="round-panel" key={q.id}>
              <div className="round-head">
                <div>
                  <h3 style={{ margin: 0 }}>{q.prompt}</h3>
                  <small className="muted">Worth {q.points} pts · locks {fmtDate(q.lockAt)}</small>
                </div>
                <div>
                  {locked
                    ? <span className="status finished" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={13} /> Locked</span>
                    : <span className="status" style={{ background: '#dff1e5', color: '#127844' }}>Open</span>}
                </div>
              </div>

              {q.options && q.options.length > 0 ? (
                <div className="pick-options" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={locked || busyId === q.id}
                      className={current === opt ? 'selected' : ''}
                      onClick={() => setDraft(q.id, opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Type your answer..."
                  value={current}
                  disabled={locked || busyId === q.id}
                  onChange={(e) => setDraft(q.id, e.target.value)}
                />
              )}

              <div className="row" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="muted">
                  {saved ? <>Your answer: <strong>{saved}</strong></> : <em>No answer yet</em>}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {settled && (
                    <span className={`status ${wasCorrect ? 'finished' : 'postponed'}`}>
                      {wasCorrect ? `+${q.points} pts` : `Correct: ${q.correctAnswer}`}
                    </span>
                  )}
                  {!locked && (
                    <button
                      className="primary action-button"
                      type="button"
                      disabled={busyId === q.id || !current || current === saved}
                      onClick={() => save(q)}
                    >
                      <Check size={16} /> {busyId === q.id ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
