// scraper-utils.js

import { parseUniversalDate, calculateShortResultFromScore } from './utils.js';

export const SITE_CONFIG = {
  'badmintonvlaanderen.be': {
    name: 'Badminton Vlaanderen',
    selectors: {
      matchRows: 'table.ruler tr, table.matches tr, table.k-grid-table tr, table.match-list tr, #content table tr, div[class*="content"] table tr, table tr',
      dateCell: 'td:nth-child(1)',
      eventCell: 'td:nth-child(2)',
      opponentCell: 'td:nth-child(3) a[href*="player"], td:nth-child(3)',
      scoreCell: 'td:nth-child(4), td:nth-child(5)',
      durationCell: 'td:nth-child(6)'
    },
    dateFormat: 'DD/MM/YYYY'
  },
  'toernooi.nl': {
    name: 'Toernooi.nl',
    selectors: {
      matchRows: 'table.matches tr, table.ruler tr, .match-row, tr[data-match-id]',
      dateCell: 'td:nth-child(1), .match-date',
      eventCell: 'td:nth-child(2), .tournament-name',
      opponentCell: 'td:nth-child(3) a, .opponent-name',
      scoreCell: 'td:nth-child(4), .match-score',
      durationCell: 'td:nth-child(5), .match-duration'
    },
    dateFormat: 'DD-MM-YYYY'
  }
};

export function cleanName(name) {
  if (!name) return '';
  return name.replace(/\s*\[\d+\]\s*$/g, '').trim();
}

export function detectCurrentSite(hostname) {
  if (hostname.includes('badmintonvlaanderen.be')) return 'badmintonvlaanderen.be';
  if (hostname.includes('toernooi.nl') || hostname.includes('lfbb.tournamentsoftware.com')) return 'toernooi.nl';
  return null;
}

export function getDisciplineFromUrl(url) {
  if (url.includes('ranktype=2')) return 'D';
  if (url.includes('ranktype=3')) return 'M';
  return 'S';
}

export function extractCurrentPlayerName(doc, siteType, url) {
  if (siteType === 'toernooi.nl') {
    const toernooiSelectors = [
      'h2 .nav-link__value',
      '.page-header__title',
      'h2.title',
      '.profile-header .player-name',
      'h1',
      'title'
    ];
    for (const selector of toernooiSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        let name = text.replace(/Badminton\s*-\s*/i, '')
                       .replace(/\s*-\s*Toernooi\.nl/i, '')
                       .trim();
        if (name) return cleanName(name);
      }
    }
    const breadcrumbs = doc.querySelector('.breadcrumb');
    if (breadcrumbs) {
      const nameMatch = breadcrumbs.textContent.match(/Speler:?\s*([^\n]+)/i);
      if (nameMatch && nameMatch[1]) return cleanName(nameMatch[1].trim());
    }
    return null;
  } else {
    const selectors = [
      '.profiledata .title h3[title]',
      '.profiledata .title h3',
      'h3[title]',
      '.player-name',
      '#playerName',
      '.profile-header h1',
      '.profile-title h1',
      '.content h2',
      '.page-title h1',
      'h1.page-header__title'
    ];
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const nameFromTitle = element.getAttribute('title');
        if (nameFromTitle && nameFromTitle.trim()) return cleanName(nameFromTitle.trim());
        const textContent = element.textContent.trim();
        if (textContent) return cleanName(textContent);
      }
    }
    const breadcrumb = doc.querySelector('.breadcrumb, nav.breadcrumbs');
    if (breadcrumb) {
      const breadText = breadcrumb.textContent;
      const match = breadText.match(/Speler:?\s*([^\n]+)/i) || breadText.match(/>\s*([^>]+)\s*$/);
      if (match && match[1]) return cleanName(match[1].trim());
    }
    const path = new URL(url).pathname;
    const urlMatch = path.match(/\/speler\/([^\/]+)/i) || path.match(/\/player\/([^\/]+)/i);
    if (urlMatch && urlMatch[1]) return cleanName(urlMatch[1].replace(/-/g, ' '));
    return null;
  }
}

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeName(name) {
  if (!name) return '';
  return removeDiacritics(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

export function fuzzyMatchName(name1, name2) {
  if (!name1 || !name2) return false;
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  if (norm1 === norm2) return true;
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen <= 3) return false;
  const distance = levenshteinDistance(norm1, norm2);
  return distance <= Math.floor(maxLen * 0.5);
}

export function normalizeForComparison(text) {
  if (!text) return '';
  return removeDiacritics(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

export function setsEqual(set1, set2) {
  if (set1.size !== set2.size) return false;
  for (let item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

function normalizeScore(scoreStr) {
  if (!scoreStr) return '';
  const sets = scoreStr.match(/\d+-\d+/g);
  return sets ? sets.join(' ') : '';
}

function scoresEqual(score1, score2) {
  const norm1 = normalizeScore(score1);
  const norm2 = normalizeScore(score2);
  return norm1 === norm2;
}

export function findDuplicateIndex(existingList, scraped) {
  return existingList.findIndex(ex => {
    if (ex.Datum !== scraped.Datum) return false;
    if (!scoresEqual(ex.Result, scraped.Result)) return false;

    const exOpp = ex.Tegenstander || '';
    const scOpp = scraped.Tegenstander || '';
    const discipline = scraped.discipline || 'S';

    if (discipline === 'S') {
      return fuzzyMatchName(exOpp, scOpp);
    } else {
      const exPlayers = exOpp.split('&').map(s => normalizeForComparison(s.trim())).filter(Boolean);
      const scPlayers = scOpp.split('&').map(s => normalizeForComparison(s.trim())).filter(Boolean);
      if (exPlayers.length !== 2 || scPlayers.length !== 2) return false;

      const exSet = new Set(exPlayers);
      const scSet = new Set(scPlayers);
      if (exSet.size === 2 && scSet.size === 2 && exPlayers.every(p => scSet.has(p))) return true;

      const exWords = exPlayers.map(p => new Set(p.split(' ')));
      const scWords = scPlayers.map(p => new Set(p.split(' ')));
      let used = [false, false];
      let wordSetMatch = true;
      for (let i = 0; i < 2; i++) {
        let found = false;
        for (let j = 0; j < 2; j++) {
          if (!used[j] && setsEqual(exWords[i], scWords[j])) {
            used[j] = true;
            found = true;
            break;
          }
        }
        if (!found) {
          wordSetMatch = false;
          break;
        }
      }
      if (wordSetMatch) return true;

      const directMatch = fuzzyMatchName(exPlayers[0], scPlayers[0]) && fuzzyMatchName(exPlayers[1], scPlayers[1]);
      const swappedMatch = fuzzyMatchName(exPlayers[0], scPlayers[1]) && fuzzyMatchName(exPlayers[1], scPlayers[0]);
      if (directMatch || swappedMatch) return true;

      const exSorted = [...exPlayers].sort().join(' ');
      const scSorted = [...scPlayers].sort().join(' ');
      return fuzzyMatchName(exSorted, scSorted);
    }
  });
}

async function scrapeBadmintonVlaanderenEnhanced(doc, currentPlayerName, pageUrl) {
  const scripts = doc.querySelectorAll('script');
  let apiUrl = null;
  for (const script of scripts) {
    const scriptContent = script.textContent || '';
    const matches = scriptContent.match(/\/api\/Profile\/Matches\?[^"'\s]+/);
    if (matches) {
      apiUrl = 'https://www.badmintonvlaanderen.be' + matches[0];
      break;
    }
    const dataUrlMatch = scriptContent.match(/data-url=["']([^"']+)["']/);
    if (dataUrlMatch) {
      apiUrl = dataUrlMatch[1];
      if (!apiUrl.startsWith('http')) apiUrl = 'https://www.badmintonvlaanderen.be' + apiUrl;
      break;
    }
  }
  if (!apiUrl) {
    const dataUrlElement = doc.querySelector('[data-url*="matches"], [data-url*="profile"]');
    if (dataUrlElement) {
      const dataUrl = dataUrlElement.getAttribute('data-url');
      if (dataUrl) apiUrl = dataUrl.startsWith('http') ? dataUrl : 'https://www.badmintonvlaanderen.be' + dataUrl;
    }
  }

  if (apiUrl) {
    try {
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        const matches = data.map((item, index) => {
          const discipline = item.discipline === 'S' ? 'S' : (item.discipline === 'D' ? 'D' : 'M');
          return {
            Datum: item.date || '',
            Fase: item.tournament || '',
            Tegenstander: discipline === 'S' ? item.opponent : (item.opponents ? item.opponents.join(' & ') : ''),
            Jij: item.myLevel || 12,
            Hij: item.oppLevel || 12,
            Result: item.score || '',
            ResultShort: calculateShortResultFromScore(item.score || ''),
            Duur: '',
            Time: item.time || '',
            discipline: discipline,
            scrapedTime: item.time || '',
            typeExtra: item.extra || '',
            teammateName: discipline !== 'S' ? (item.teammate || '') : '',
            opponent1: discipline !== 'S' ? (item.opponents?.[0] || '') : '',
            opponent2: discipline !== 'S' ? (item.opponents?.[1] || '') : '',
            teammateLevel: discipline !== 'S' ? (item.teammateLevel || 12) : 12,
            opponent1Level: discipline !== 'S' ? (item.opponentLevels?.[0] || 12) : 12,
            opponent2Level: discipline !== 'S' ? (item.opponentLevels?.[1] || 12) : 12,
            isWalkover: item.walkover || false,
            excludeFromRanking: false,
            source: 'scraped',
            id: Date.now() + Math.random() + index,
            currentPlayerName: currentPlayerName
          };
        });
        console.log('[BV Enhanced] API succeeded, returning', matches.length, 'matches');
        return matches;
      }
    } catch (e) {}
  }
  console.log('[BV Enhanced] API failed, falling back to HTML');
  return scrapeBadmintonVlaanderenHTML(doc, currentPlayerName, pageUrl);
}

function scrapeBadmintonVlaanderenHTML(doc, currentPlayerName, pageUrl) {
  const matches = [];
  const rows = doc.querySelectorAll('table tr');
  let currentEvent = '';

  rows.forEach((row, index) => {
    try {
      const tournamentHeader = row.querySelector('th a[href*="tournament.aspx"]');
      if (tournamentHeader) {
        currentEvent = tournamentHeader.textContent.trim();
        return;
      }

      const dateCell = row.querySelector('td.plannedtime');
      if (!dateCell) return;
      if (row.querySelectorAll('td').length < 5) return;

      let date = '', time = '';
      const dateText = dateCell.textContent.trim();
      const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!dateMatch) return;
      date = `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].slice(-2)}`;
      const timeSpan = dateCell.querySelector('.time');
      if (timeSpan) time = timeSpan.textContent.trim();
      else {
        const timeMatch = dateText.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) time = timeMatch[1];
      }

      const playerLinks = row.querySelectorAll('a[href*="player.aspx"]');
      if (playerLinks.length === 0) return;

      const playerTables = row.querySelectorAll('table');
      let isDoubles = false;
      if (playerTables.length >= 2) {
        const t1 = playerTables[0].querySelectorAll('a[href*="player.aspx"]').length;
        const t2 = playerTables[1].querySelectorAll('a[href*="player.aspx"]').length;
        if (t1 === 2 || t2 === 2) isDoubles = true;
      } else {
        isDoubles = playerLinks.length >= 4;
      }

      const allPlayers = Array.from(playerLinks).map(link => ({
        name: cleanName(link.textContent.trim()),
        element: link
      }));

      let ourPlayers = [], opponentPlayers = [];

      if (playerTables.length >= 2) {
        const team1 = Array.from(playerTables[0].querySelectorAll('a[href*="player.aspx"]')).map(link => cleanName(link.textContent.trim()));
        const team2 = Array.from(playerTables[1].querySelectorAll('a[href*="player.aspx"]')).map(link => cleanName(link.textContent.trim()));

        if (currentPlayerName) {
          const t1Has = team1.some(p => fuzzyMatchName(p, currentPlayerName));
          const t2Has = team2.some(p => fuzzyMatchName(p, currentPlayerName));
          if (t1Has && !t2Has) { ourPlayers = team1; opponentPlayers = team2; }
          else if (t2Has && !t1Has) { ourPlayers = team2; opponentPlayers = team1; }
          else { ourPlayers = team1; opponentPlayers = team2; }
        } else {
          ourPlayers = team1; opponentPlayers = team2;
        }
      } else {
        if (isDoubles) {
          ourPlayers = allPlayers.slice(0, 2).map(p => p.name);
          if (allPlayers.length >= 4) opponentPlayers = allPlayers.slice(2, 4).map(p => p.name);
          else return;
        } else {
          ourPlayers = [allPlayers[0].name];
          if (allPlayers.length >= 2) opponentPlayers = [allPlayers[1].name];
        }
      }

      const isWalkoverScore = row.textContent.includes('21-0 21-0') || row.textContent.includes('0-21 0-21');
      if (isDoubles && isWalkoverScore && (ourPlayers.length < 2 || opponentPlayers.length < 2)) return;

      let scoreText = '';
      const scoreCell = row.querySelector('td .score, span.score');
      if (scoreCell) {
        const spans = scoreCell.querySelectorAll('span');
        if (spans.length) {
          scoreText = Array.from(spans).map(s => s.textContent.trim()).filter(t => t.match(/\d+-\d+/)).join(' ');
        } else {
          const cellText = scoreCell.textContent.trim();
          if (cellText.match(/(\d+-\d+\s*)+/)) scoreText = cellText;
        }
      }
      if (!scoreText) return;

      const sets = scoreText.split(' ').filter(s => s.match(/\d+-\d+/));
      let myWins = 0, oppWins = 0;
      sets.forEach(set => {
        const [a, b] = set.split('-').map(Number);
        if (a > b) myWins++; else if (b > a) oppWins++;
      });
      const resultShort = `${myWins}-${oppWins}`;

      let discipline = isDoubles ? 'D' : 'S';
      const lowerEvent = (currentEvent || '').toLowerCase();
      if (isDoubles && (lowerEvent.includes('mixed') || lowerEvent.includes('gemengd'))) discipline = 'M';

      let opponentText = '';
      if (discipline === 'S') opponentText = opponentPlayers[0] || '';
      else opponentText = `${opponentPlayers[0] || ''} & ${opponentPlayers[1] || ''}`;

      const ourLevels = ourPlayers.map(() => 12);
      const opponentLevels = opponentPlayers.map(() => 12);

      allPlayers.forEach(player => {
        const playerText = player.element.textContent.trim();
        const levelMatch = playerText.match(/\((\d+)\)/);
        if (levelMatch) {
          const level = parseInt(levelMatch[1]);
          if (level >= 1 && level <= 12) {
            const pName = cleanName(playerText.replace(/\(\d+\)/, '').trim());
            const oIdx = ourPlayers.findIndex(p => fuzzyMatchName(p, pName));
            const oppIdx = opponentPlayers.findIndex(p => fuzzyMatchName(p, pName));
            if (oIdx !== -1) ourLevels[oIdx] = level;
            else if (oppIdx !== -1) opponentLevels[oppIdx] = level;
          }
        }
      });

      let currentPlayerLevel = 12;
      let teammateName = '';
      if (currentPlayerName && ourPlayers.length) {
        const idx = ourPlayers.findIndex(p => fuzzyMatchName(p, currentPlayerName));
        if (idx !== -1) {
          currentPlayerLevel = ourLevels[idx];
          if (discipline !== 'S' && ourPlayers.length > 1) {
            teammateName = idx === 0 ? ourPlayers[1] : ourPlayers[0];
          }
        } else {
          currentPlayerLevel = ourLevels[0] || 12;
          if (discipline !== 'S' && ourPlayers.length > 1) teammateName = ourPlayers[1];
        }
      } else {
        currentPlayerLevel = ourLevels[0] || 12;
        if (discipline !== 'S' && ourPlayers.length > 1) teammateName = ourPlayers[1];
      }

      let avgOppLevel = 12;
      if (opponentLevels.length) {
        const sum = opponentLevels.reduce((a, b) => a + b, 0);
        avgOppLevel = Math.round(sum / opponentLevels.length);
      }

      const hasNoResult = row.textContent.includes('Geen resultaat toegekend') ||
                          row.textContent.includes('geen resultaat') ||
                          row.textContent.includes('no result awarded');
      const excludeFromRanking = hasNoResult || isWalkoverScore;

      matches.push({
        Datum: date,
        Fase: currentEvent || 'Unknown Tournament',
        Tegenstander: opponentText,
        Jij: currentPlayerLevel,
        Hij: discipline === 'S' ? (opponentLevels[0] || 12) : avgOppLevel,
        Result: scoreText,
        ResultShort: resultShort,
        Duur: '',
        Time: time,
        discipline: discipline,
        id: Date.now() + Math.random() + index,
        teammateName,
        opponent1: opponentPlayers[0] || '',
        opponent2: opponentPlayers[1] || '',
        teammateLevel: ourPlayers.length > 1 ? (ourLevels[1] || 12) : 12,
        opponent1Level: opponentLevels[0] || 12,
        opponent2Level: opponentLevels[1] || 12,
        scrapedDate: new Date().toISOString(),
        source: 'scraped',
        currentPlayerVerified: !!currentPlayerName && ourPlayers.some(p => fuzzyMatchName(p, currentPlayerName)),
        isWalkover: isWalkoverScore || hasNoResult,
        excludeFromRanking,
        scrapedTime: time,
        typeExtra: '',
        currentPlayerName: currentPlayerName
      });
    } catch (error) {}
  });

  return matches;
}

function normalizeYear(yearStr) {
  let year = parseInt(yearStr, 10);
  if (yearStr.length === 2) {
    const currentYear = new Date().getFullYear();
    const century = Math.floor(currentYear / 100) * 100;
    year = century + year;
    if (year > currentYear + 50) year -= 100;
  }
  return year;
}

const RETIREMENT_TERMS = ['opgave', 'walkover', 'abandon', 'forfait', 'retired'];

async function scrapeToernooiEnhanced(doc, currentPlayerName, pageUrl) {
  const html = doc.documentElement.outerHTML;
  const apiRegex = /\/player-profile\/[a-z0-9\-]+\/rating\/[a-z0-9\-]+\/RatingMatchList\?[^"'\s\\]+/gi;
  const rawUrls = html.match(apiRegex) || [];
  const uniqueUrls = [...new Set(rawUrls)].map(url => url.replace(/&amp;/g, '&'));

  console.log('[Toernooi] Found API URLs:', uniqueUrls.length ? uniqueUrls : 'none');

  let allMatches = [];
  if (uniqueUrls.length > 0) {
    for (const endpoint of uniqueUrls) {
      const fullUrl = new URL(endpoint, pageUrl).href;
      let expectedDiscipline = 'S';
      if (fullUrl.includes('ranktype=2')) expectedDiscipline = 'D';
      if (fullUrl.includes('ranktype=3')) expectedDiscipline = 'M';

      try {
        const response = await fetch(fullUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (response.ok) {
          const apiData = await response.text();
          const tempDoc = new DOMParser().parseFromString(apiData, 'text/html');
          const matches = parseToernooiMatchesFromDoc(tempDoc, currentPlayerName, expectedDiscipline);
          console.log(`[Toernooi] API ${fullUrl} returned ${matches.length} matches`);
          allMatches.push(...matches);
        } else {
          console.warn(`[Toernooi] API fetch failed for ${fullUrl}: ${response.status}`);
        }
      } catch (e) {
        console.error('[Toernooi] API fetch error:', e);
      }
    }
  }

  if (allMatches.length > 0) {
    console.log('[Toernooi] Using API data, total matches:', allMatches.length);
    return allMatches;
  }

  console.log('[Toernooi] Falling back to HTML scraping');
  return scrapeToernooiHTML(doc, currentPlayerName, pageUrl);
}

function scrapeToernooiHTML(doc, currentPlayerName, pageUrl) {
  const matches = [];
  const matchElements = doc.querySelectorAll('.match-group__item .match, .match-group .match, .match');
  console.log('[Toernooi HTML] Found', matchElements.length, 'match elements');

  matchElements.forEach((matchDiv, index) => {
    try {
      let date = '';
      const dateEl = matchDiv.querySelector('.match__footer .nav-link__value');
      if (dateEl) {
        const dateMatch = dateEl.textContent.trim().match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
        if (dateMatch) {
          let day = dateMatch[1].padStart(2, '0');
          let month = dateMatch[2].padStart(2, '0');
          let year = normalizeYear(dateMatch[3]);
          date = `${day}/${month}/${String(year).slice(-2)}`;
        }
      }
      if (!date) return;

      let duration = '';
      const durEl = matchDiv.querySelector('.match__header-aside .tag--placeholder time');
      if (durEl) {
        const durText = durEl.textContent.trim();
        const iso = durEl.getAttribute('datetime');
        if (durText) {
          const minMatch = durText.match(/(\d+)\s*m/i);
          if (minMatch) duration = `${minMatch[1]} min`;
          else if (durText.includes(':')) {
            const [h, m] = durText.split(':').map(Number);
            duration = `${h * 60 + m} min`;
          } else if (durText.toLowerCase().includes('h')) {
            const h = durText.match(/(\d+)\s*h/i)?.[1] || 0;
            const m = durText.match(/(\d+)\s*m/i)?.[1] || 0;
            duration = `${parseInt(h) * 60 + parseInt(m)} min`;
          }
        } else if (iso) {
          const isoMatch = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
          if (isoMatch) {
            const h = isoMatch[1] ? parseInt(isoMatch[1]) : 0;
            const m = isoMatch[2] ? parseInt(isoMatch[2]) : 0;
            duration = `${h * 60 + m} min`;
          }
        }
      }

      let eventName = '', typeExtra = '';
      const headerItems = matchDiv.querySelectorAll('.match__header-title-item .nav-link__value');
      if (headerItems.length) {
        eventName = headerItems[0].textContent.trim();
        if (headerItems.length > 1) typeExtra = Array.from(headerItems).slice(1).map(el => el.textContent.trim()).join(' – ');
      }

      const playerRows = matchDiv.querySelectorAll('.match__row');
      const players = [], levels = [];

      playerRows.forEach(row => {
        const values = row.querySelectorAll('.match__row-title-value');
        if (values.length) {
          values.forEach(v => {
            const nameEl = v.querySelector('.nav-link__value');
            const levelEl = v.querySelector('.match__row-title-aside');
            if (nameEl) {
              players.push(cleanName(nameEl.textContent));
              const lvl = levelEl?.textContent.match(/\((\d+)\)/)?.[1];
              levels.push(lvl ? Math.min(Math.max(parseInt(lvl), 1), 12) : 12);
            }
          });
        } else {
          const nameEl = row.querySelector('.nav-link__value');
          const levelEl = row.querySelector('.match__row-title-aside');
          if (nameEl) {
            players.push(cleanName(nameEl.textContent));
            const lvl = levelEl?.textContent.match(/\((\d+)\)/)?.[1];
            levels.push(lvl ? Math.min(Math.max(parseInt(lvl), 1), 12) : 12);
          }
        }
      });

      if (players.length < 2) return;

      const urlDiscipline = getDisciplineFromUrl(pageUrl);
      let determinedDiscipline = 'S';
      if (players.length === 4) {
        const lowerEvent = (eventName || '').toLowerCase();
        if (lowerEvent.includes('gemengd') || lowerEvent.includes('mixed')) {
          determinedDiscipline = 'M';
        } else {
          determinedDiscipline = 'D';
        }
      } else if (players.length !== 2) {
        return;
      }

      if (urlDiscipline !== determinedDiscipline) {
        console.log(`[Toernooi HTML] Match ${index}: player count ${players.length}, URL discipline = ${urlDiscipline}, determined = ${determinedDiscipline}`);
      }

      let discipline = determinedDiscipline;

      const setScores = [];
      matchDiv.querySelectorAll('.match__result .points').forEach(pointsList => {
        const pts = pointsList.querySelectorAll('.points__cell');
        if (pts.length >= 2) {
          setScores.push(`${parseInt(pts[0].textContent) || 0}-${parseInt(pts[1].textContent) || 0}`);
        }
      });

      let hasOpgave = false, hasNoResult = false;
      const opgaveEl = matchDiv.querySelector('.match__message');
      if (opgaveEl) {
        const msg = opgaveEl.textContent.toLowerCase();
        if (RETIREMENT_TERMS.some(term => msg.includes(term))) hasOpgave = true;
      }
      let containsOpgaveInScore = false;
      matchDiv.querySelectorAll('.match__result .points').forEach(el => {
        const text = el.textContent.toLowerCase();
        if (RETIREMENT_TERMS.some(term => text.includes(term))) containsOpgaveInScore = true;
      });
      const noResultTag = matchDiv.querySelector('.tag--soft');
      if (noResultTag) {
        const title = noResultTag.getAttribute('title') || '';
        if (title.includes('Geen resultaat toegekend') || title.toLowerCase().includes('no result awarded')) hasNoResult = true;
      }

      const isWalkover = (hasOpgave || containsOpgaveInScore) && setScores.length === 0;
      const excludeFromRanking = (hasOpgave && setScores.length === 0) || hasNoResult;

      let weWonRetirement = false, weWonWalkover = false;
      const winningRow = matchDiv.querySelector('.match__row.has-won');
      if (winningRow) {
        const winnerNames = Array.from(winningRow.querySelectorAll('.nav-link__value')).map(el => cleanName(el.textContent));
        if (winnerNames.some(n => fuzzyMatchName(n, currentPlayerName))) {
          weWonRetirement = true;
          weWonWalkover = true;
        }
      }

      const isSingles = (players.length === 2);

      let ourRowIdx = -1;
      for (let rIdx = 0; rIdx < playerRows.length; rIdx++) {
        const row = playerRows[rIdx];
        const names = Array.from(row.querySelectorAll('.nav-link__value')).map(el => cleanName(el.textContent));
        if (names.some(n => fuzzyMatchName(n, currentPlayerName))) {
          ourRowIdx = rIdx;
          break;
        }
      }
      if (ourRowIdx === -1) ourRowIdx = 1;

      if (isSingles) {
        let ourIdx = -1;
        if (currentPlayerName) ourIdx = players.findIndex(p => fuzzyMatchName(p, currentPlayerName));
        if (ourIdx === -1) ourIdx = 0;
        const oppIdx = ourIdx === 0 ? 1 : 0;

        let finalScoreText = setScores.join(' ');
        if (ourIdx === 1 && setScores.length) {
          finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
        }

        let ourWins = 0, oppWins = 0;
        finalScoreText.split(' ').forEach(s => {
          const [a, b] = s.split('-').map(Number);
          if (a > b) ourWins++; else if (b > a) oppWins++;
        });

        const isWin = hasOpgave ? weWonRetirement : (isWalkover ? weWonWalkover : (ourWins > oppWins));

        matches.push({
          Datum: date,
          Fase: eventName,
          Tegenstander: players[oppIdx] || '',
          Jij: levels[ourIdx] || 12,
          Hij: levels[oppIdx] || 12,
          Result: finalScoreText,
          ResultShort: `${ourWins}-${oppWins}`,
          Duur: duration,
          discipline: 'S',
          isWin,
          isWalkover,
          excludeFromRanking,
          id: Date.now() + Math.random() + index,
          source: 'scraped',
          typeExtra,
          scrapedTime: '',
          teammateName: '',
          teammateLevel: 12,
          opponent1: '',
          opponent2: '',
          opponent1Level: 12,
          opponent2Level: 12,
          currentPlayerName: currentPlayerName
        });
      } else {
        if (players.length < 4) return;

        let ourTeam = [], oppTeam = [], ourLvls = [], oppLvls = [];

        if (ourRowIdx === 0) {
          ourTeam = [players[0], players[1]];
          oppTeam = [players[2], players[3]];
          ourLvls = [levels[0], levels[1]];
          oppLvls = [levels[2], levels[3]];
        } else {
          ourTeam = [players[2], players[3]];
          oppTeam = [players[0], players[1]];
          ourLvls = [levels[2], levels[3]];
          oppLvls = [levels[0], levels[1]];
        }

        const isMeFirst = fuzzyMatchName(ourTeam[0], currentPlayerName);
        const teammateName = isMeFirst ? ourTeam[1] : ourTeam[0];
        const teammateLevel = isMeFirst ? ourLvls[1] : ourLvls[0];
        const myLevel = isMeFirst ? ourLvls[0] : ourLvls[1];

        let finalScoreText = '';
        let ourWins = 0, oppWins = 0;

        if (isWalkover) {
          if (weWonWalkover) {
            ourWins = 2; oppWins = 0;
            finalScoreText = setScores.length ? setScores.join(' ') : '21-0 21-0';
            if (ourRowIdx === 1 && setScores.length) {
              finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
            }
          } else {
            ourWins = 0; oppWins = 2;
            finalScoreText = setScores.length ? setScores.join(' ') : '0-21 0-21';
            if (ourRowIdx === 0 && setScores.length) {
              finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
            }
          }
        } else {
          finalScoreText = setScores.join(' ');
          if (ourRowIdx === 1 && setScores.length) {
            finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
          }
          finalScoreText.split(' ').forEach(s => {
            const [a, b] = s.split('-').map(Number);
            if (a > b) ourWins++; else if (b > a) oppWins++;
          });
        }

        const isWin = hasOpgave ? weWonRetirement : (isWalkover ? weWonWalkover : (ourWins > oppWins));

        matches.push({
          Datum: date,
          Fase: eventName,
          Tegenstander: oppTeam.filter(Boolean).join(' & ') || 'Unknown',
          Jij: myLevel,
          Hij: Math.round(((oppLvls[0]||12) + (oppLvls[1]||12)) / 2),
          Result: finalScoreText,
          ResultShort: `${ourWins}-${oppWins}`,
          Duur: duration,
          discipline: discipline,
          teammateName,
          opponent1: oppTeam[0] || '',
          opponent2: oppTeam[1] || '',
          teammateLevel,
          opponent1Level: oppLvls[0] || 12,
          opponent2Level: oppLvls[1] || 12,
          isWin,
          isWalkover,
          excludeFromRanking,
          id: Date.now() + Math.random() + index,
          source: 'scraped',
          typeExtra,
          scrapedTime: '',
          currentPlayerName: currentPlayerName
        });
      }
    } catch (err) {
      console.error('[Toernooi HTML] Error parsing match:', err);
    }
  });

  console.log('[Toernooi HTML] Total matches scraped:', matches.length);
  return matches;
}

function parseToernooiMatchesFromDoc(doc, currentPlayerName, expectedDiscipline) {
  const matchElements = doc.querySelectorAll('.match-group__item .match, .match-group .match, .match');
  console.log('[Toernooi API Parser] Found', matchElements.length, 'match elements');
  const matches = [];

  matchElements.forEach((matchDiv, index) => {
    try {
      let date = '';
      const dateElement = matchDiv.querySelector('.match__footer .nav-link__value');
      if (dateElement) {
        const dateMatch = dateElement.textContent.trim().match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
        if (dateMatch) {
          let day = dateMatch[1].padStart(2, '0');
          let month = dateMatch[2].padStart(2, '0');
          let year = normalizeYear(dateMatch[3]);
          date = `${day}/${month}/${String(year).slice(-2)}`;
        }
      }
      if (!date) return;

      let duration = '';
      const durationElement = matchDiv.querySelector('.match__header-aside .tag--placeholder time');
      if (durationElement) {
        duration = durationElement.textContent.trim();
        const datetimeAttr = durationElement.getAttribute('datetime');
        if (datetimeAttr) {
          const isoMatch = datetimeAttr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
          if (isoMatch) {
            const hours = isoMatch[1] ? parseInt(isoMatch[1]) : 0;
            const mins = isoMatch[2] ? parseInt(isoMatch[2]) : 0;
            duration = `${hours * 60 + mins} min`;
          }
        }
      }

      let eventName = '', typeExtra = '';
      const headerItems = matchDiv.querySelectorAll('.match__header-title-item .nav-link__value');
      if (headerItems.length > 0) {
        eventName = headerItems[0].textContent.trim();
        if (headerItems.length > 1) typeExtra = Array.from(headerItems).slice(1).map(el => el.textContent.trim()).join(' – ');
      }

      const playerRows = matchDiv.querySelectorAll('.match__row');
      const players = [], levels = [];

      playerRows.forEach(row => {
        const playerValues = row.querySelectorAll('.match__row-title-value');
        if (playerValues.length > 0) {
          playerValues.forEach(valueEl => {
            const nameEl = valueEl.querySelector('.nav-link__value');
            const levelEl = valueEl.querySelector('.match__row-title-aside');
            if (nameEl) {
              players.push(cleanName(nameEl.textContent));
              const lvlMatch = levelEl ? levelEl.textContent.match(/\((\d+)\)/) : null;
              levels.push(lvlMatch ? Math.min(Math.max(parseInt(lvlMatch[1]), 1), 12) : 12);
            }
          });
        } else {
          const nameEl = row.querySelector('.nav-link__value');
          const levelEl = row.querySelector('.match__row-title-aside');
          if (nameEl) {
            players.push(cleanName(nameEl.textContent));
            const lvlMatch = levelEl ? levelEl.textContent.match(/\((\d+)\)/) : null;
            levels.push(lvlMatch ? Math.min(Math.max(parseInt(lvlMatch[1]), 1), 12) : 12);
          }
        }
      });

      if (players.length < 2) return;

      let discipline = expectedDiscipline;
      if (players.length === 2) {
        discipline = 'S';
      } else if (players.length === 4) {
        const lowerEvent = (eventName || '').toLowerCase();
        if (lowerEvent.includes('gemengd') || lowerEvent.includes('mixed')) {
          discipline = 'M';
        } else {
          discipline = 'D';
        }
      } else {
        return;
      }

      if (expectedDiscipline !== discipline) {
        console.log(`[Toernooi API Parser] Match ${index}: player count ${players.length}, API discipline = ${expectedDiscipline}, overridden to ${discipline}`);
      }

      const setScores = [];
      matchDiv.querySelectorAll('.match__result .points').forEach(pointsList => {
        const pts = pointsList.querySelectorAll('.points__cell');
        if (pts.length >= 2) {
          setScores.push(`${parseInt(pts[0].textContent) || 0}-${parseInt(pts[1].textContent) || 0}`);
        }
      });

      let hasOpgave = false, hasNoResult = false;
      const opgaveElement = matchDiv.querySelector('.match__message');
      if (opgaveElement) {
        const msg = opgaveElement.textContent.toLowerCase();
        if (RETIREMENT_TERMS.some(term => msg.includes(term))) hasOpgave = true;
      }
      let containsOpgaveInScore = false;
      matchDiv.querySelectorAll('.match__result .points').forEach(el => {
        const text = el.textContent.toLowerCase();
        if (RETIREMENT_TERMS.some(term => text.includes(term))) containsOpgaveInScore = true;
      });
      const noResultTag = matchDiv.querySelector('.tag--soft');
      if (noResultTag) {
        const title = noResultTag.getAttribute('title') || '';
        if (title.includes('Geen resultaat toegekend') || title.toLowerCase().includes('no result awarded')) hasNoResult = true;
      }

      if (setScores.length === 0 && !hasOpgave && !containsOpgaveInScore) return;

      const isWalkover = (hasOpgave || containsOpgaveInScore) && setScores.length === 0;
      const excludeFromRanking = (hasOpgave && setScores.length === 0) || hasNoResult;

      let weWonRetirement = false, weWonWalkover = false;
      const winningRow = matchDiv.querySelector('.match__row.has-won');
      if (winningRow) {
        const winnerNames = Array.from(winningRow.querySelectorAll('.nav-link__value')).map(el => cleanName(el.textContent));
        if (winnerNames.some(n => fuzzyMatchName(n, currentPlayerName))) {
          weWonRetirement = true;
          weWonWalkover = true;
        }
      }

      const isSingles = (players.length === 2);

      let ourRowIdx = -1;
      for (let rIdx = 0; rIdx < playerRows.length; rIdx++) {
        const row = playerRows[rIdx];
        const names = Array.from(row.querySelectorAll('.nav-link__value')).map(el => cleanName(el.textContent));
        if (names.some(n => fuzzyMatchName(n, currentPlayerName))) {
          ourRowIdx = rIdx;
          break;
        }
      }
      if (ourRowIdx === -1) ourRowIdx = 1;

      if (isSingles) {
        let ourIdx = -1;
        if (currentPlayerName) ourIdx = players.findIndex(p => fuzzyMatchName(p, currentPlayerName));
        if (ourIdx === -1) ourIdx = 0;
        const oppIdx = ourIdx === 0 ? 1 : 0;

        let finalScoreText = setScores.join(' ');
        if (ourIdx === 1 && setScores.length > 0) {
          finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
        }

        let ourWins = 0, oppWins = 0;
        finalScoreText.split(' ').forEach(s => {
          const [a, b] = s.split('-').map(Number);
          if (a > b) ourWins++; else if (b > a) oppWins++;
        });

        const isWin = hasOpgave ? weWonRetirement : (isWalkover ? weWonWalkover : (ourWins > oppWins));

        matches.push({
          Datum: date,
          Fase: eventName,
          Tegenstander: players[oppIdx] || '',
          Jij: levels[ourIdx],
          Hij: levels[oppIdx],
          Result: finalScoreText,
          ResultShort: `${ourWins}-${oppWins}`,
          Duur: duration,
          discipline: 'S',
          isWin,
          isWalkover,
          excludeFromRanking,
          id: Date.now() + Math.random() + index,
          source: 'scraped',
          typeExtra
        });
      } else {
        if (players.length < 4) return;

        let ourTeam = [], oppTeam = [], ourLvls = [], oppLvls = [];

        if (ourRowIdx === 0) {
          ourTeam = [players[0], players[1]];
          oppTeam = [players[2], players[3]];
          ourLvls = [levels[0], levels[1]];
          oppLvls = [levels[2], levels[3]];
        } else {
          ourTeam = [players[2], players[3]];
          oppTeam = [players[0], players[1]];
          ourLvls = [levels[2], levels[3]];
          oppLvls = [levels[0], levels[1]];
        }

        const isMeFirst = fuzzyMatchName(ourTeam[0], currentPlayerName);
        const teammateName = isMeFirst ? ourTeam[1] : ourTeam[0];
        const teammateLevel = isMeFirst ? ourLvls[1] : ourLvls[0];
        const myLevel = isMeFirst ? ourLvls[0] : ourLvls[1];

        let finalScoreText = '';
        let ourWins = 0, oppWins = 0;

        if (isWalkover) {
          if (weWonWalkover) {
            ourWins = 2; oppWins = 0;
            finalScoreText = setScores.length > 0 ? setScores.join(' ') : '21-0 21-0';
            if (ourRowIdx === 1 && setScores.length > 0) {
              finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
            }
          } else {
            ourWins = 0; oppWins = 2;
            finalScoreText = setScores.length > 0 ? setScores.join(' ') : '0-21 0-21';
            if (ourRowIdx === 0 && setScores.length > 0) {
              finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
            }
          }
        } else {
          finalScoreText = setScores.join(' ');
          if (ourRowIdx === 1 && setScores.length > 0) {
            finalScoreText = setScores.map(s => `${s.split('-')[1]}-${s.split('-')[0]}`).join(' ');
          }
          finalScoreText.split(' ').forEach(s => {
            const [a, b] = s.split('-').map(Number);
            if (a > b) ourWins++; else if (b > a) oppWins++;
          });
        }

        const isWin = hasOpgave ? weWonRetirement : (isWalkover ? weWonWalkover : (ourWins > oppWins));

        matches.push({
          Datum: date,
          Fase: eventName,
          Tegenstander: oppTeam.join(' & ') || 'Unknown',
          Jij: myLevel,
          Hij: Math.round(((oppLvls[0]||12) + (oppLvls[1]||12)) / 2),
          Result: finalScoreText,
          ResultShort: `${ourWins}-${oppWins}`,
          Duur: duration,
          discipline: discipline,
          teammateName,
          opponent1: oppTeam[0] || '',
          opponent2: oppTeam[1] || '',
          teammateLevel,
          opponent1Level: oppLvls[0] || 12,
          opponent2Level: oppLvls[1] || 12,
          isWin,
          isWalkover,
          excludeFromRanking,
          id: Date.now() + Math.random() + index,
          source: 'scraped',
          typeExtra
        });
      }
    } catch (err) {
      console.error('[Toernooi API Parser] Error parsing match:', err);
    }
  });
  console.log('[Toernooi API Parser] Total matches scraped:', matches.length);
  return matches;
}

export async function scrapeMatchesFromDocument(siteType, doc, url, playerName = null) {
  if (!playerName) {
    playerName = extractCurrentPlayerName(doc, siteType, url);
  }

  if (siteType === 'badmintonvlaanderen.be') {
    return await scrapeBadmintonVlaanderenEnhanced(doc, playerName, url);
  } else if (siteType === 'toernooi.nl') {
    return await scrapeToernooiEnhanced(doc, playerName, url);
  }
  return [];
}