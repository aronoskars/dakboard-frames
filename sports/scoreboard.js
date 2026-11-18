const leagues = {
  epl: 'EPL', ucl: 'Champions League', besta: 'Besta deildin',
  liga: 'La Liga', nba: 'NBA', subway: 'Subway-deildin',
};
const priority = { live: 0, final: 1, upcoming: 2 };
const format = new Intl.DateTimeFormat('is-IS', {
  timeZone: 'Atlantic/Reykjavik', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const gamesList = document.querySelector('#games');
const modeLabel = document.querySelector('#mode');
const updated = document.querySelector('#updated');
const pageLabel = document.querySelector('#page');
const coverage = document.querySelector('#coverage');
const queryMode = new URLSearchParams(location.search).get('mode');
const forceDemo = location.protocol === 'file:' || queryMode === 'demo';
const pageSize = 4;
const staleAfter = 100 * 60 * 1000;
let snapshot;
let page = 0;
let loading = false;
let fetchFailed = false;

function node(tag, value, className) {
  const item = document.createElement(tag);
  item.textContent = value;
  if (className) item.className = className;
  return item;
}

function gameRow(game, stale) {
  const row = node('li', '');
  const meta = node('div', '', 'meta');
  const live = game.status === 'live';
  const label = {
    live: stale ? 'Var í gangi' : 'Í gangi',
    final: 'Lokið',
    upcoming: format.format(new Date(game.startsAt)),
  };
  meta.append(node('span', leagues[game.league]), node('span', label[game.status], live && !stale ? 'live' : ''));
  row.append(meta);
  for (const [team, score] of [[game.home, game.homeScore], [game.away, game.awayScore]]) {
    const line = node('div', '', 'teams');
    const name = node('span', team, 'team');
    name.title = team;
    line.append(name, node('span', game.status === 'upcoming' ? '–' : score ?? '–', 'score'));
    row.append(line);
  }
  return row;
}

function render(advance = false) {
  const feeds = Object.values(snapshot?.feeds ?? {});
  const demo = forceDemo || (!feeds.length && queryMode !== 'live');
  const games = [...(demo ? demoGames : feeds.flatMap(feed => feed.games))];
  games.sort((a, b) => priority[a.status] - priority[b.status] ||
    (Date.parse(a.startsAt) - Date.parse(b.startsAt)) * (a.status === 'upcoming' ? 1 : -1));
  const pages = Math.ceil(games.length / pageSize);
  page = pages ? (page + Number(advance)) % pages : 0;
  const feedIsStale = feed => fetchFailed || feed.stale ||
    (!feed.manual && Date.now() - Date.parse(feed.updatedAt) > staleAfter);
  const stale = !demo && (fetchFailed || feeds.some(feedIsStale));
  gamesList.replaceChildren(...games.slice(page * pageSize, (page + 1) * pageSize)
    .map(game => gameRow(game, !demo && feedIsStale(snapshot.feeds[game.league]))));
  if (!games.length) gamesList.append(node('li', feeds.length ? 'Engir leikir á tímabilinu' : 'Engin leikjagögn tiltæk'));
  modeLabel.textContent = demo ? 'SÝNIDÆMI' : stale ? 'GÖGN GETA VERIÐ ÚRELT' : '';
  const latest = demo ? demoTime : Math.max(...feeds.map(feed => Date.parse(feed.updatedAt)));
  updated.textContent = Number.isFinite(latest)
    ? (demo ? 'Sýnidæmi búið til ' : 'Síðast sótt ') + format.format(latest)
    : 'Uppfært —';
  pageLabel.textContent = pages > 1 ? `${page + 1} / ${pages}` : '';
  const missing = Object.keys(leagues).filter(league => !snapshot?.feeds[league]);
  coverage.hidden = demo || !missing.length;
  coverage.textContent = 'Vantar gögn: ' + missing.map(league => leagues[league]).join(', ');
  document.querySelector('#credit').hidden = demo ||
    !['epl', 'ucl', 'liga'].some(league => snapshot?.feeds[league]);
}

async function refresh() {
  if (forceDemo || loading) return;
  loading = true;
  try {
    const response = await fetch('./scores.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cache unavailable');
    const data = await response.json();
    if (data.version !== 1 || !data.feeds || typeof data.feeds !== 'object') {
      throw new Error('Invalid cache');
    }
    snapshot = data;
    fetchFailed = false;
  } catch {
    fetchFailed = true;
  } finally {
    loading = false;
    render();
  }
}

render();
refresh();
setInterval(() => render(true), 12000);
setInterval(refresh, 120000);

