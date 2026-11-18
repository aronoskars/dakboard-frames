// Tilbúin dæmi með liðanöfnum. Tímar miðast við opnun síðunnar.
const demoTime = Date.now();
const demoGames = [
  ['epl', 'Arsenal', 'Liverpool', 'live', -65, 2, 1],
  ['nba', 'Boston Celtics', 'New York Knicks', 'live', -84, 81, 76],
  ['besta', 'Víkingur R.', 'Breiðablik', 'final', -160, 2, 2],
  ['liga', 'Real Madrid', 'Real Sociedad', 'final', -215, 3, 1],
  ['subway', 'Keflavík', 'Njarðvík', 'final', -240, 94, 88],
  ['ucl', 'Inter', 'Bayern München', 'final', -1440, 1, 2],
  ['ucl', 'Paris Saint-Germain', 'Barcelona', 'upcoming', 130],
  ['subway', 'Valur', 'KR', 'upcoming', 345],
  ['besta', 'Valur', 'Stjarnan', 'upcoming', 1490],
  ['nba', 'Boston Celtics', 'Miami Heat', 'upcoming', 1960],
  ['liga', 'Atlético Madrid', 'Villarreal', 'upcoming', 2200],
  ['epl', 'Chelsea', 'Newcastle United', 'upcoming', 2400],
].map(([league, home, away, status, minutes, homeScore, awayScore]) => ({
  league, home, away, status, startsAt: new Date(demoTime + minutes * 60000).toISOString(),
  homeScore, awayScore,
}));

