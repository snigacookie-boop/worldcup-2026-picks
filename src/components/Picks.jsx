import { useMemo } from 'react';
import { Check, Lock } from 'lucide-react';
import { fmtKickoff, groupByRound, isLocked, roundById } from '../lib/format.js';
import { flagUrl, flagSrcSet } from '../lib/flags.js';

export default function Picks({ state, busyMatch, onPick }) {
  const rounds = state?.rounds || [];
  const matches = state?.matches || [];
  const picks = state?.picks || {};
  const grouped = useMemo(() => groupByRound(matches, rounds), [matches, rounds]);
  const roundMap = roundById(rounds);

  if (matches.length === 0) return <div className="empty-panel">No matches have been synced yet.</div>;

  return (
    <section className="view">
      <div className="view-head">
        <h2>My Picks</h2>
        <span className="muted">{Object.keys(picks).length} submitted</span>
      </div>

      {grouped.map(({ round, matches: roundMatches }) => (
        <section className="round-panel" key={round.id}>
          <div className="round-head">
            <h3>{round.name}</h3>
            <span>{round.pointsPerCorrect} pts</span>
          </div>
          <div className="match-list">
            {roundMatches.map((match) => (
              <PickRow
                key={match.id}
                match={match}
                round={roundMap[match.roundId]}
                current={picks[match.id]}
                busy={busyMatch === match.id}
                onPick={onPick}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function PickRow({ match, round, current, busy, onPick }) {
  const locked = isLocked(match);
  const settled = Boolean(match.winner);
  const earned = settled && current === match.winner ? round?.pointsPerCorrect || 0 : 0;
  const goals = Array.isArray(match.goals) ? match.goals : [];

  return (
    <article className="pick-row">
      <div className="pick-meta">
        <div className="pick-teams">
          <Flag code={match.homeCode} name={match.homeTeam} />
          <strong>{match.homeTeam}</strong>
          <span className="pick-vs">vs</span>
          <strong>{match.awayTeam}</strong>
          <Flag code={match.awayCode} name={match.awayTeam} />
        </div>
        <small>{fmtKickoff(match.kickoff)}</small>
        {goals.length > 0 && (
          <small className="pick-scorers">
            {goals.map((g, i) => (
              <span key={i}>
                {g.player} {g.minute}'{g.penalty ? '(P)' : ''}{i < goals.length - 1 ? ', ' : ''}
              </span>
            ))}
          </small>
        )}
      </div>
      <div className="pick-options" aria-label={`${match.homeTeam} vs ${match.awayTeam} pick options`}>
        <PickButton label={match.homeCode || 'Home'} flagCode={match.homeCode} selected={current === 'HOME'} disabled={locked || busy} onClick={() => onPick(match.id, 'HOME')} />
        <PickButton label="Draw" selected={current === 'DRAW'} disabled={locked || busy} onClick={() => onPick(match.id, 'DRAW')} />
        <PickButton label={match.awayCode || 'Away'} flagCode={match.awayCode} selected={current === 'AWAY'} disabled={locked || busy} onClick={() => onPick(match.id, 'AWAY')} />
      </div>
      <div className="pick-result">
        {locked ? <Lock size={15} /> : <Check size={15} />}
        <span>{settled ? `${earned} pts` : locked ? 'Locked' : 'Open'}</span>
      </div>
    </article>
  );
}

function Flag({ code, name }) {
  const url = flagUrl(code, 40);
  if (!url) return null;
  return <img className="flag flag-sm" src={url} srcSet={flagSrcSet(code, 40)} alt={`${name} flag`} width="24" height="16" loading="lazy" />;
}

function PickButton({ label, flagCode, selected, disabled, onClick }) {
  const url = flagCode ? flagUrl(flagCode, 40) : '';
  return (
    <button className={selected ? 'selected' : ''} disabled={disabled} onClick={onClick} type="button">
      {url && <img className="flag flag-sm" src={url} srcSet={flagSrcSet(flagCode, 40)} alt="" width="20" height="14" />}
      {label}
    </button>
  );
}
