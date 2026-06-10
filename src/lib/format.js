export function fmtKickoff(iso) {
  if (!iso) return 'TBD';
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function roundById(rounds = []) {
  return Object.fromEntries(rounds.map((round) => [round.id, round]));
}

export function groupByRound(matches = [], rounds = []) {
  const roundsById = roundById(rounds);
  const grouped = new Map();
  for (const match of matches) {
    const round = roundsById[match.roundId] || { id: 'other', name: 'Unscheduled', displayOrder: 999, pointsPerCorrect: 0 };
    if (!grouped.has(round.id)) grouped.set(round.id, { round, matches: [] });
    grouped.get(round.id).matches.push(match);
  }
  return [...grouped.values()].sort((a, b) => a.round.displayOrder - b.round.displayOrder);
}

export function isLocked(match) {
  if (!match) return true;
  if (match.status !== 'SCHEDULED') return true;
  return new Date(match.kickoff).getTime() <= Date.now();
}
