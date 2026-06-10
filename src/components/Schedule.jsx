import { useMemo, useState } from 'react';
import { Clock, MapPin, Goal } from 'lucide-react';
import { fmtKickoff, groupByRound, roundById } from '../lib/format.js';
import { flagUrl, flagSrcSet } from '../lib/flags.js';

export default function Schedule({ state }) {
  const [filter, setFilter] = useState('ALL');
  const rounds = state?.rounds || [];
  const matches = state?.matches || [];
  const filtered = useMemo(() => {
    if (filter === 'ALL') return matches;
    if (filter === 'OPEN') return matches.filter((match) => match.status === 'SCHEDULED' && new Date(match.kickoff) > new Date());
    return matches.filter((match) => match.status === filter);
  }, [filter, matches]);

  const grouped = groupByRound(filtered, rounds);

  return (
    <section className="view">
      <div className="view-head">
        <h2>Schedule</h2>
        <div className="segments" aria-label="Schedule filter">
          {['ALL', 'OPEN', 'LIVE', 'FINISHED'].map((item) => (
            <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} type="button">
              {item === 'ALL' ? 'All' : item[0] + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="empty-panel">No matches have been synced yet.</div>
      ) : grouped.length === 0 ? (
        <div className="empty-panel">No matches match this view.</div>
      ) : (
        grouped.map(({ round, matches: roundMatches }) => (
          <section className="round-panel" key={round.id}>
            <div className="round-head">
              <h3>{round.name}</h3>
              <span>{round.pointsPerCorrect} pts</span>
            </div>
            <div className="match-list">
              {roundMatches.map((match) => (
                <MatchRow key={match.id} match={match} round={roundById(rounds)[match.roundId]} />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}

function MatchRow({ match, round }) {
  const showScore = match.status === 'LIVE' || match.status === 'FINISHED';
  const venue = [match.venue, match.city].filter(Boolean).join(', ');
  const goals = Array.isArray(match.goals) ? match.goals : [];
  const homeGoals = goals.filter((g) => g.team === 'HOME');
  const awayGoals = goals.filter((g) => g.team === 'AWAY');

  return (
    <article className="match-row">
      <TeamBlock name={match.homeTeam} code={match.homeCode} />
      <div className="match-center">
        {showScore ? (
          <div className="score">{match.homeScore ?? 0} - {match.awayScore ?? 0}</div>
        ) : (
          <div className="kickoff"><Clock size={14} /> {fmtKickoff(match.kickoff)}</div>
        )}
        <span className={`status ${match.status.toLowerCase()}`}>
          {match.status}{match.elapsed ? ` ${match.elapsed}'` : ''}
        </span>
        {venue && <span className="venue"><MapPin size={13} /> {venue}</span>}
        <span className="round-points">{round?.pointsPerCorrect || 0} pts</span>
      </div>
      <TeamBlock name={match.awayTeam} code={match.awayCode} align="right" />
      {goals.length > 0 && (
        <div className="scorers">
          <ScorerList side="left" goals={homeGoals} />
          <div className="scorers-sep"><Goal size={14} /></div>
          <ScorerList side="right" goals={awayGoals} />
        </div>
      )}
    </article>
  );
}

function TeamBlock({ name, code, align = 'left' }) {
  const url = flagUrl(code, 40);
  return (
    <div className={`team ${align === 'right' ? 'right' : ''}`}>
      {url && (
        <img className="flag" src={url} srcSet={flagSrcSet(code, 40)} alt={`${name} flag`} width="32" height="22" loading="lazy" />
      )}
      <strong>{name}</strong>
      <small>{code || 'TBD'}</small>
    </div>
  );
}

function ScorerList({ side, goals }) {
  if (goals.length === 0) return <ul className={`scorer-list ${side}`}><li className="muted">—</li></ul>;
  return (
    <ul className={`scorer-list ${side}`}>
      {goals.map((g, i) => (
        <li key={i}>
          <span className="scorer-name">{g.player}</span>
          <span className="scorer-min">{g.minute}'{g.penalty ? ' (P)' : ''}{g.ownGoal ? ' (OG)' : ''}</span>
        </li>
      ))}
    </ul>
  );
}
