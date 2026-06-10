// Mock data so the UI can be previewed without Netlify Identity or API-Football set up.
// Activated only when import.meta.env.VITE_DEMO === '1'.

const day = (offsetDays, hour = 15) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
};

// Goal events: { team: 'HOME'|'AWAY', player, minute, assist?, penalty?, ownGoal? }
export const demoState = {
  profile: { userId: 'demo-user', username: 'demo_admin', isAdmin: true },
  rounds: [
    { id: 'group',   name: 'Group Stage',    pointsPerCorrect: 1,  displayOrder: 10 },
    { id: 'r32',     name: 'Round of 32',    pointsPerCorrect: 2,  displayOrder: 20 },
    { id: 'r16',     name: 'Round of 16',    pointsPerCorrect: 3,  displayOrder: 30 },
    { id: 'quarter', name: 'Quarter-finals', pointsPerCorrect: 5,  displayOrder: 40 },
    { id: 'semi',    name: 'Semi-finals',    pointsPerCorrect: 8,  displayOrder: 50 },
    { id: 'third',   name: 'Third-place',    pointsPerCorrect: 10, displayOrder: 55 },
    { id: 'final',   name: 'Final',          pointsPerCorrect: 15, displayOrder: 60 },
  ],
  matches: [
    {
      id: 'm1', roundId: 'group',
      homeTeam: 'Mexico', awayTeam: 'Poland', homeCode: 'MEX', awayCode: 'POL',
      kickoff: day(-3, 18), homeScore: 2, awayScore: 1, status: 'FINISHED', winner: 'HOME',
      venue: 'Estadio Azteca', city: 'Mexico City',
      goals: [
        { team: 'HOME', player: 'R. Jiménez', minute: 18 },
        { team: 'AWAY', player: 'R. Lewandowski', minute: 42, penalty: true },
        { team: 'HOME', player: 'H. Lozano', minute: 67 },
      ],
    },
    {
      id: 'm2', roundId: 'group',
      homeTeam: 'Canada', awayTeam: 'Belgium', homeCode: 'CAN', awayCode: 'BEL',
      kickoff: day(-2, 19), homeScore: 1, awayScore: 1, status: 'FINISHED', winner: 'DRAW',
      venue: 'BMO Field', city: 'Toronto',
      goals: [
        { team: 'AWAY', player: 'K. De Bruyne', minute: 12 },
        { team: 'HOME', player: 'A. Davies', minute: 73, assist: 'J. David' },
      ],
    },
    {
      id: 'm3', roundId: 'group',
      homeTeam: 'USA', awayTeam: 'England', homeCode: 'USA', awayCode: 'ENG',
      kickoff: day(0, 0), homeScore: 1, awayScore: 0, status: 'LIVE', winner: null,
      venue: 'MetLife Stadium', city: 'East Rutherford', elapsed: 58,
      goals: [
        { team: 'HOME', player: 'C. Pulisic', minute: 34 },
      ],
    },
    { id: 'm4', roundId: 'group', homeTeam: 'Brazil',   awayTeam: 'Argentina', homeCode: 'BRA', awayCode: 'ARG', kickoff: day(1, 20), homeScore: null, awayScore: null, status: 'SCHEDULED', winner: null, venue: 'SoFi Stadium', city: 'Inglewood', goals: [] },
    { id: 'm5', roundId: 'group', homeTeam: 'France',   awayTeam: 'Germany',   homeCode: 'FRA', awayCode: 'GER', kickoff: day(2, 18), homeScore: null, awayScore: null, status: 'SCHEDULED', winner: null, venue: 'AT&T Stadium', city: 'Arlington', goals: [] },
    { id: 'm6', roundId: 'group', homeTeam: 'Spain',    awayTeam: 'Portugal',  homeCode: 'ESP', awayCode: 'POR', kickoff: day(3, 21), homeScore: null, awayScore: null, status: 'SCHEDULED', winner: null, venue: 'Lumen Field', city: 'Seattle', goals: [] },
    { id: 'm7', roundId: 'r16',   homeTeam: 'Netherlands', awayTeam: 'Croatia', homeCode: 'NED', awayCode: 'CRO', kickoff: day(8, 17), homeScore: null, awayScore: null, status: 'SCHEDULED', winner: null, venue: 'Gillette Stadium', city: 'Foxborough', goals: [] },
    { id: 'm8', roundId: 'final', homeTeam: 'TBD', awayTeam: 'TBD', homeCode: 'TBD', awayCode: 'TBD', kickoff: day(30, 20), homeScore: null, awayScore: null, status: 'SCHEDULED', winner: null, venue: 'MetLife Stadium', city: 'East Rutherford', goals: [] },
  ],
  picks: {
    m1: 'HOME',
    m2: 'HOME',
    m3: 'HOME',
    m4: 'AWAY',
    m5: 'DRAW',
  },
  leaderboard: [
    { userId: 'u-ana',    username: 'ana_g',       points: 14, picksMade: 7, picksSettled: 6 },
    { userId: 'u-jon',    username: 'jonny42',     points: 12, picksMade: 7, picksSettled: 6 },
    { userId: 'demo-user',username: 'demo_admin',  points: 9,  picksMade: 5, picksSettled: 2 },
    { userId: 'u-priya',  username: 'priyak',      points: 8,  picksMade: 6, picksSettled: 6 },
    { userId: 'u-sam',    username: 'samurai_sam', points: 5,  picksMade: 4, picksSettled: 4 },
  ],
  totals: { open: 5, live: 1 },
};
