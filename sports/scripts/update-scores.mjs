import { readFile, writeFile } from 'node:fs/promises';

const cachePath = 'sports/scores.json';
const cache = JSON.parse(await readFile(cachePath, 'utf8'));
const iceland = JSON.parse(await readFile('data/iceland.json', 'utf8'));
const now = Date.now();
const updatedAt = new Date(now).toISOString();
const day = 86400000;
const date = offset => new Date(now + offset * day).toISOString().slice(0, 10);
const startDate = date(-6);
const endDate = date(5);
const footballKey = process.env.FOOTBALL_DATA_TOKEN;
const nbaKey = process.env.BALLDONTLIE_API_KEY;

async function getJson(url, headers) {
  const response = await fetch(url, {
    headers, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Provider request failed');
  return response.json();
}

function normalize(league, { home, away, startsAt, status, homeScore, awayScore }) {
  if (!status) return null;
  if (![home, away].every(name => typeof name === 'string' && name.trim()) ||
      typeof startsAt !== 'string' || !Number.isFinite(Date.parse(startsAt)) ||
      !['live', 'final', 'upcoming'].includes(status)) {
    throw new Error('Invalid game');
  }
  return {
    league, home: home.trim(), away: away.trim(), status,
    startsAt: new Date(startsAt).toISOString(),
    homeScore: Number.isInteger(homeScore) && homeScore >= 0 ? homeScore : null,
    awayScore: Number.isInteger(awayScore) && awayScore >= 0 ? awayScore : null,
  };
}

function selectGames(games) {
  const valid = games.filter(Boolean).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return [
    ...valid.filter(game => game.status === 'live'),
    ...valid.filter(game => game.status === 'final').slice(-2),
    ...valid.filter(game => game.status === 'upcoming' && Date.parse(game.startsAt) >= now).slice(0, 2),
  ];
}

async function update(league, load) {
  try {
    cache.feeds[league] = { updatedAt, games: selectGames(await load()) };
  } catch {
    if (cache.feeds[league]) cache.feeds[league].stale = true;
    // Log only the league ID. Provider responses and request details are private.
    console.warn(`::warning::Could not refresh ${league}; using last available snapshot.`);
  }
}

async function football(league, competition) {
  const params = new URLSearchParams({ dateFrom: startDate, dateTo: date(6) });
  const { matches } = await getJson(
    `https://api.football-data.org/v4/competitions/${competition}/matches?${params}`,
    { 'X-Auth-Token': footballKey },
  );
  const statuses = {
    IN_PLAY: 'live', PAUSED: 'live', FINISHED: 'final', SCHEDULED: 'upcoming', TIMED: 'upcoming',
  };
  return matches.map(match => normalize(league, {
    home: match.homeTeam.shortName || match.homeTeam.name,
    away: match.awayTeam.shortName || match.awayTeam.name,
    startsAt: match.utcDate, status: statuses[match.status],
    homeScore: match.score.fullTime.home, awayScore: match.score.fullTime.away,
  }));
}

async function nba() {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate, per_page: '100' });
  const games = [];
  const statuses = { final: 'final', in_progress: 'live', scheduled: 'upcoming' };
  // Cap pagination to keep every scheduled run within the free request limit.
  for (let page = 0; page < 2; page++) {
    const { data, meta } = await getJson(
      `https://api.balldontlie.io/v1/games?${params}`,
      { Authorization: nbaKey },
    );
    for (const match of data) {
      if (match.postponed) continue;
      const status = statuses[match.status_state];
      // Only display times backed by an actual timestamp.
      if (!match.datetime) continue;
      games.push(normalize('nba', {
        home: match.home_team.full_name, away: match.visitor_team.full_name,
        startsAt: match.datetime, status,
        homeScore: match.home_team_score, awayScore: match.visitor_team_score,
      }));
    }
    if (meta?.next_cursor == null) return games;
    params.set('cursor', meta.next_cursor);
  }
  throw new Error('NBA pagination exceeded request budget');
}

for (const [league, competition] of [['epl', 'PL'], ['ucl', 'CL'], ['liga', 'PD']]) {
  if (footballKey) await update(league, () => football(league, competition));
  else delete cache.feeds[league];
}
if (nbaKey) await update('nba', nba);
else delete cache.feeds.nba;

for (const league of ['besta', 'subway']) {
  const entry = iceland[league];
  if (entry == null) {
    delete cache.feeds[league];
    continue;
  }
  if (!Number.isFinite(Date.parse(entry.updatedAt)) || !Array.isArray(entry.games) ||
      entry.games.some(game => !['final', 'upcoming'].includes(game.status) ||
        !/(?:Z|[+-]\d\d:\d\d)$/.test(game.startsAt))) {
    throw new Error(`Invalid manual data for ${league}`);
  }
  const games = entry.games.map(game => normalize(league, game))
    .filter(game => game.status !== 'final' || Date.parse(game.startsAt) >= now - 6 * day);
  cache.feeds[league] = { manual: true, updatedAt: entry.updatedAt, games: selectGames(games) };
}

await writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n');

