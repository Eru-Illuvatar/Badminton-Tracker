document.addEventListener('DOMContentLoaded', async () => {
  try {
    initTheme();
    initDate();
    await initDisciplineSelector();
    attachEventListeners();
    initScrapingHint();
    chrome.storage.local.get(['tourState'], (result) => {
      const tourState = result.tourState || { completed: false };
      if (!tourState.completed && tourState.step !== -1) {
        chrome.tabs.create({ url: 'dashboard.html' });
      }
    });

  } catch (error) {
    console.error('Popup init error:', error);
    alert('Error loading form. Please refresh.');
  }
});

function initTheme() {
  const themeBtn = document.getElementById('popupThemeBtn');
  const savedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
    document.body.classList.add('dark-mode');
    themeBtn.innerText = '☀️';
  } else {
    themeBtn.innerText = '🌙';
  }
  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeBtn.innerText = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

function initDate() {
  const dateInput = document.getElementById('date');
  if (!dateInput) return;
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yy = String(today.getFullYear()).slice(-2);
  dateInput.value = `${dd}/${mm}/${yy}`;
  dateInput.addEventListener('blur', validateDateInput);
}

async function initDisciplineSelector() {
  const icons = document.querySelectorAll('.discipline-icon-popup');
  const singlesForm = document.getElementById('singlesForm');
  const doublesForm = document.getElementById('doublesForm');
  const levelNote = document.getElementById('levelNote');

  const { currentDiscipline = 'singles' } = await chrome.storage.local.get('currentDiscipline');

  icons.forEach(icon => {
    const discLetter = icon.dataset.discipline;
    const discipline = { S: 'singles', D: 'doubles', M: 'mixed' }[discLetter] || 'singles';
    if (discipline === currentDiscipline) {
      icon.classList.add('active');
      toggleForms(discipline, singlesForm, doublesForm, levelNote);
    }
    icon.addEventListener('click', () => {
      icons.forEach(i => i.classList.remove('active'));
      icon.classList.add('active');
      toggleForms(discipline, singlesForm, doublesForm, levelNote);
      chrome.storage.local.set({ currentDiscipline: discipline });
    });
  });
}

function toggleForms(discipline, singlesForm, doublesForm, levelNote) {
  if (discipline === 'singles') {
    singlesForm.classList.add('active');
    doublesForm.classList.remove('active');
    if (levelNote) levelNote.style.display = 'none';
  } else {
    singlesForm.classList.remove('active');
    doublesForm.classList.add('active');
    if (levelNote) levelNote.style.display = 'block';
  }
}

function validateDateInput(e) {
  const input = e.target;
  const value = input.value.trim();
  if (!value) return;
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
  if (!dateRegex.test(value) || !isValidDate(value)) {
    input.style.borderColor = '#dc3545';
    return false;
  }
  input.style.borderColor = '';
  return true;
}

function isValidDate(dateStr) {
  const [d, m, y] = dateStr.split('/').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y < 100 ? 2000 + y : y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1;
}

function attachEventListeners() {
  document.getElementById('saveBtn').addEventListener('click', saveMatch);
  document.getElementById('openDashBtn').addEventListener('click', openDashboard);
  document.getElementById('scrapeBtn').addEventListener('click', scrapeCurrentPage);
  setupScoreNavigation();
  setupKeyboardShortcuts();
}

function setupScoreNavigation() {
  const inputs = ['s1_me', 's1_opp', 's2_me', 's2_opp', 's3_me', 's3_opp']
    .map(id => document.getElementById(id))
    .filter(i => i);
  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      if (input.value.length >= 2 && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    input.addEventListener('keydown', e => {
      if (!/[0-9]|Backspace|Delete|Arrow|Tab/.test(e.key)) e.preventDefault();
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('saveBtn').click();
    }
    if (e.key === 'Escape') e.target.blur();
  });
}

function openDashboard() {
  chrome.tabs.create({ url: 'dashboard.html' });
}

function saveMatch() {
  try {
    const dateInput = document.getElementById('date');
    const eventInput = document.getElementById('event');
    const durationInput = document.getElementById('duration');

    const s1_me = document.getElementById('s1_me').value.trim();
    const s1_opp = document.getElementById('s1_opp').value.trim();
    const s2_me = document.getElementById('s2_me').value.trim();
    const s2_opp = document.getElementById('s2_opp').value.trim();
    const s3_me = document.getElementById('s3_me').value.trim();
    const s3_opp = document.getElementById('s3_opp').value.trim();

    const activeIcon = document.querySelector('.discipline-icon-popup.active');
    const discLetter = activeIcon.getAttribute('data-discipline');
    const discipline = { S: 'singles', D: 'doubles', M: 'mixed' }[discLetter] || 'singles';

    if (!dateInput.value) {
      alert('Please enter a date');
      dateInput.focus();
      return;
    }
    const dateRegex = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/;
    if (!dateRegex.test(dateInput.value.trim())) {
      alert('Please use dd/mm/yy format (e.g., 14/12/24)');
      dateInput.focus();
      return;
    }
    const dateParts = dateInput.value.split(/[\/.-]/);
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    let year = parseInt(dateParts[2]);
    if (year < 100) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = century + year;
      if (year > currentYear + 50) year -= 100;
    }
    const selectedDate = new Date(year, month - 1, day);
    if (isNaN(selectedDate.getTime())) {
      alert('Invalid date');
      dateInput.focus();
      return;
    }
    if (month < 1 || month > 12) {
      alert('Month must be between 1 and 12');
      dateInput.focus();
      return;
    }
    if (day < 1 || day > 31) {
      alert('Day must be between 1 and 31');
      dateInput.focus();
      return;
    }
    const lastDay = new Date(year, month, 0).getDate();
    if (day > lastDay) {
      alert(`Invalid day for ${month}/${year}. Maximum day is ${lastDay}`);
      dateInput.focus();
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate > today && !confirm('Date is in the future. Are you sure?')) {
      dateInput.focus();
      return;
    }

    if ((!s1_me || !s1_opp) && (!s2_me || !s2_opp)) {
      alert('Please fill in at least the first two sets.');
      if (!s1_me || !s1_opp) document.getElementById('s1_me').focus();
      else document.getElementById('s2_me').focus();
      return;
    }
    const validationErrors = [];
    const validateSet = (me, opp, label) => {
      if (!me && !opp) return true;
      if (!me || !opp) {
        validationErrors.push(`${label}: Please fill both scores or leave both empty`);
        return false;
      }
      const m = parseInt(me);
      const o = parseInt(opp);
      if (isNaN(m) || isNaN(o)) {
        validationErrors.push(`${label}: Scores must be numbers`);
        return false;
      }
      if (m < 0 || o < 0) {
        validationErrors.push(`${label}: Scores cannot be negative`);
        return false;
      }
      if (m < 21 && o < 21) {
        validationErrors.push(`${label}: At least one player must reach 21 points`);
        return false;
      }
      if (m >= 21 && o >= 21) {
        const diff = Math.abs(m - o);
        if (diff !== 2 && !(m === 30 && o === 29) && !(o === 30 && m === 29)) {
          validationErrors.push(`${label}: Must win by 2 points`);
          return false;
        }
      }
      if (m > 30 || o > 30) {
        validationErrors.push(`${label}: Maximum score is 30`);
        return false;
      }
      return true;
    };
    validateSet(s1_me, s1_opp, 'Set 1');
    validateSet(s2_me, s2_opp, 'Set 2');
    validateSet(s3_me, s3_opp, 'Set 3');
    if (validationErrors.length) {
      alert('Score validation errors:\n\n' + validationErrors.join('\n'));
      return;
    }

    let resultStr = '';
    if (s1_me && s1_opp) resultStr += `${s1_me}-${s1_opp}`;
    if (s2_me && s2_opp) resultStr += ` ${s2_me}-${s2_opp}`;
    if (s3_me && s3_opp) resultStr += ` ${s3_me}-${s3_opp}`;

    let mySets = 0, oppSets = 0;
    const countSet = (m, o) => {
      const mNum = parseInt(m);
      const oNum = parseInt(o);
      if (mNum > oNum) mySets++; else if (oNum > mNum) oppSets++;
    };
    if (s1_me && s1_opp) countSet(s1_me, s1_opp);
    if (s2_me && s2_opp) countSet(s2_me, s2_opp);
    if (s3_me && s3_opp) countSet(s3_me, s3_opp);

    let matchData;
    if (discipline === 'singles') {
      const opponent = document.getElementById('opponent').value.trim();
      const myLevel = parseInt(document.getElementById('myLevel').value) || 12;
      const oppLevel = parseInt(document.getElementById('oppLevel').value) || 12;
      if (!opponent) {
        alert('Please enter opponent name');
        document.getElementById('opponent').focus();
        return;
      }
      matchData = {
        Datum: dateInput.value.trim(),
        Tegenstander: opponent,
        Jij: myLevel,
        Hij: oppLevel,
        Result: resultStr,
        ResultShort: `${mySets}-${oppSets}`,
        Duur: durationInput.value ? parseInt(durationInput.value) : '',
        Fase: eventInput.value.trim(),
        discipline: 'S',
        id: Date.now() + Math.random(),
        source: 'manual',
        scrapedTime: '',
        typeExtra: ''
      };
    } else {
      const teammate = document.getElementById('teammate').value.trim();
      const opp1 = document.getElementById('opponent1').value.trim();
      const opp2 = document.getElementById('opponent2').value.trim();
      const myLevel = parseInt(document.getElementById('myLevelDouble').value) || 12;
      const teammateLevel = parseInt(document.getElementById('teammateLevel').value) || 12;
      const opp1Level = parseInt(document.getElementById('opp1Level').value) || 12;
      const opp2Level = parseInt(document.getElementById('opp2Level').value) || 12;

      if (!teammate) {
        alert('Please enter teammate name');
        document.getElementById('teammate').focus();
        return;
      }
      if (!opp1 || !opp2) {
        alert('Please enter both opponent names');
        if (!opp1) document.getElementById('opponent1').focus();
        else document.getElementById('opponent2').focus();
        return;
      }
      const avgOppLevel = Math.round((opp1Level + opp2Level) / 2);
      matchData = {
        Datum: dateInput.value.trim(),
        Tegenstander: `${opp1} & ${opp2}`,
        Jij: myLevel,
        Hij: avgOppLevel,
        Result: resultStr,
        ResultShort: `${mySets}-${oppSets}`,
        Duur: durationInput.value ? parseInt(durationInput.value) : '',
        Fase: eventInput.value.trim(),
        discipline: discLetter,
        teammateName: teammate,
        teammateLevel: teammateLevel,
        opponent1: opp1,
        opponent1Level: opp1Level,
        opponent2: opp2,
        opponent2Level: opp2Level,
        id: Date.now() + Math.random(),
        source: 'manual',
        scrapedTime: '',
        typeExtra: ''
      };
    }

    saveMatchToStorage(matchData, discipline);
  } catch (error) {
    console.error('Save error:', error);
    alert('An unexpected error occurred. Check console.');
  }
}

function saveMatchToStorage(matchData, discipline) {
  const storageKey = `badminton${discipline.charAt(0).toUpperCase() + discipline.slice(1)}Matches`;
  chrome.storage.local.get([storageKey], (result) => {
    const matches = result[storageKey] || [];
    matches.push(matchData);
    chrome.storage.local.set({ [storageKey]: matches }, () => {
      if (chrome.runtime.lastError) {
        alert('Error saving match: ' + chrome.runtime.lastError.message);
        return;
      }
      alert(`Match saved to ${discipline}!`);
      clearForm(discipline);
      const today = new Date();
      document.getElementById('date').value = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getFullYear()).slice(-2)}`;
      document.getElementById('s1_me').focus();
    });
  });
}

function clearForm(discipline) {
  document.getElementById('event').value = '';
  document.getElementById('duration').value = '';
  document.getElementById('s1_me').value = '';
  document.getElementById('s1_opp').value = '';
  document.getElementById('s2_me').value = '';
  document.getElementById('s2_opp').value = '';
  document.getElementById('s3_me').value = '';
  document.getElementById('s3_opp').value = '';
  if (discipline === 'singles') {
    document.getElementById('opponent').value = '';
  } else {
    document.getElementById('teammate').value = '';
    document.getElementById('opponent1').value = '';
    document.getElementById('opponent2').value = '';
  }
}

async function scrapeCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return alert('Cannot access current tab.');

  if (!tab.url.includes('badmintonvlaanderen.be') && !tab.url.includes('toernooi.nl') && !tab.url.includes('lfbb.tournamentsoftware.com')) {
    return alert('Please navigate to a Badminton Vlaanderen, Toernooi.nl, or lfbb.tournamentsoftware.com profile page.');
  }

  const btn = document.getElementById('scrapeBtn');
  const original = btn.innerHTML;
  btn.innerHTML = '⏳ Scraping...';
  btn.disabled = true;

  try {
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
    } catch (err) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 200));
      response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
    }

    if (response.success) {
      await handleScrapingSuccess(response, tab);
    } else {
      throw new Error(response.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Scraping failed:', error);
    showScrapingResult('error', `Scraping failed: ${error.message}\n\nPlease refresh the page and try again.`);
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

async function handleScrapingSuccess(response, tab) {
  const saveResult = await saveScrapedMatches(response.data);
  if (saveResult.total > 0) {
    let msg = `Successfully scraped ${response.data.length} matches!\nSaved ${saveResult.total} new matches.`;
    if (saveResult.breakdown) msg += `\n(${saveResult.breakdown})`;
    showScrapingResult('success', msg);
    setTimeout(() => {
      if (confirm('Open dashboard to review imported matches?')) openDashboard();
    }, 2000);
  } else {
    showScrapingResult('info', `Found ${response.data.length} matches, but no new matches were imported.`);
  }
}

function showScrapingResult(type, message) {
  const existing = document.getElementById('scrapeResult');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'scrapeResult';
  div.className = `scrape-result ${type}`;
  div.innerHTML = `
    <div class="scrape-result-header">
      <span class="scrape-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <strong>${type === 'success' ? 'Success!' : type === 'error' ? 'Error' : 'Info'}</strong>
      <button class="close-result" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
    <div class="scrape-result-body">${message.replace(/\n/g, '<br>')}</div>
  `;
  document.getElementById('scrapeBtn').parentNode.insertBefore(div, document.getElementById('scrapeBtn').nextSibling);
  if (type !== 'error') setTimeout(() => div.remove?.(), 10000);
}

function initScrapingHint() {
  if (document.getElementById('scrapeHint')) return;
  const hint = document.createElement('div');
  hint.id = 'scrapeHint';
  hint.className = 'scrape-hint';
  hint.innerHTML = 'Navigate to your match history page first, then click to scrape';
  document.getElementById('scrapeBtn').parentNode.insertBefore(hint, document.getElementById('scrapeBtn').nextSibling);
}

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeName(name) {
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

function fuzzyMatchName(name1, name2) {
  if (!name1 || !name2) return false;
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  if (norm1 === norm2) return true;
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen <= 3) return false;
  const distance = levenshteinDistance(norm1, norm2);
  return distance <= Math.floor(maxLen * 0.5);
}

async function saveScrapedMatches(scrapedMatches) {
  const keys = ['badmintonSinglesMatches', 'badmintonDoublesMatches', 'badmintonMixedMatches'];
  const stored = await chrome.storage.local.get(keys);
  const existing = {
    singles: stored.badmintonSinglesMatches || [],
    doubles: stored.badmintonDoublesMatches || [],
    mixed: stored.badmintonMixedMatches || []
  };

  const updated = {
    singles: [...existing.singles],
    doubles: [...existing.doubles],
    mixed: [...existing.mixed]
  };

  let newCount = 0;

  scrapedMatches.forEach(scraped => {
    const targetDisc = scraped.discipline === 'S' ? 'singles' : (scraped.discipline === 'D' ? 'doubles' : 'mixed');

    let found = false;
    for (const disc of ['singles', 'doubles', 'mixed']) {
      const index = findDuplicateIndex(existing[disc], scraped);
      if (index !== -1) {
        const existingMatch = updated[disc][index];
        const merged = mergeMatch(existingMatch, scraped);
        if (merged !== existingMatch) {
          updated[disc][index] = merged;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      updated[targetDisc].push(scraped);
      newCount++;
    }
  });

  const toSave = {};
  if (updated.singles.length !== existing.singles.length || JSON.stringify(updated.singles) !== JSON.stringify(existing.singles)) {
    toSave.badmintonSinglesMatches = updated.singles;
  }
  if (updated.doubles.length !== existing.doubles.length || JSON.stringify(updated.doubles) !== JSON.stringify(existing.doubles)) {
    toSave.badmintonDoublesMatches = updated.doubles;
  }
  if (updated.mixed.length !== existing.mixed.length || JSON.stringify(updated.mixed) !== JSON.stringify(existing.mixed)) {
    toSave.badmintonMixedMatches = updated.mixed;
  }

  if (Object.keys(toSave).length > 0) {
    await chrome.storage.local.set(toSave);
  }

  const savedCounts = {};
  savedCounts.singles = updated.singles.length - existing.singles.length;
  savedCounts.doubles = updated.doubles.length - existing.doubles.length;
  savedCounts.mixed = updated.mixed.length - existing.mixed.length;

  const total = Object.values(savedCounts).reduce((a, b) => a + b, 0);
  let breakdown = Object.entries(savedCounts)
    .filter(([_, count]) => count > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  return { total, breakdown };
}

function findDuplicateIndex(existingList, scraped) {
  return existingList.findIndex(ex => {
    if (ex.Datum !== scraped.Datum) return false;

    const exOpp = ex.Tegenstander || '';
    const scOpp = scraped.Tegenstander || '';
    const discipline = scraped.discipline || 'S';

    if (discipline === 'S') {
      return fuzzyMatchName(exOpp, scOpp);
    } else {
      const exPlayers = exOpp.split('&').map(s => normalizeName(s.trim())).filter(Boolean);
      const scPlayers = scOpp.split('&').map(s => normalizeName(s.trim())).filter(Boolean);
      if (exPlayers.length !== 2 || scPlayers.length !== 2) return false;

      const exSet = new Set(exPlayers);
      const scSet = new Set(scPlayers);
      if (exSet.size === 2 && scSet.size === 2 && exPlayers.every(p => scSet.has(p))) {
        return true;
      }

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

function setsEqual(set1, set2) {
  if (set1.size !== set2.size) return false;
  for (let item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

function mergeMatch(existing, scraped) {
  let modified = false;
  const merged = { ...existing };

  const fieldsToUpdate = [
    'scrapedTime', 'Time', 'Duur', 'typeExtra',
    'teammateName', 'opponent1', 'opponent2',
    'teammateLevel', 'opponent1Level', 'opponent2Level',
    'Fase', 'Jij', 'Hij', 'excludeFromRanking'
  ];

  fieldsToUpdate.forEach(field => {
    const existingVal = existing[field];
    const scrapedVal = scraped[field];
    if (scrapedVal !== undefined && scrapedVal !== null && scrapedVal !== '' &&
        (existingVal === undefined || existingVal === null || existingVal === '' ||
         (field.includes('Level') && existingVal === 12) ||
         (field === 'Fase' && (existingVal === '' || existingVal === 'Unknown Tournament')) ||
         (field === 'Jij' && existingVal === 12) ||
         (field === 'Hij' && existingVal === 12) ||
         (field === 'excludeFromRanking' && existingVal !== true && scrapedVal === true))) {
      merged[field] = scrapedVal;
      modified = true;
    }
  });

  if (scraped.source === 'scraped') {
    merged.source = 'scraped';
    merged.scrapedDate = new Date().toISOString();
    modified = true;
  }

  return modified ? merged : existing;
}