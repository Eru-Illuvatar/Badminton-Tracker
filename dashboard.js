// dashboard.js
import { t, getCurrentLanguage, setCurrentLanguage, parseUniversalDate, calculateShortResultFromScore, safeDestroyChart } from './utils.js';
import { renderEvolutionChart, renderWinLossSummary, renderSetChart, renderShotPercentageChart, renderPointsCumulativeChart, renderCompetitionTournamentRadar } from './chart-manager.js';
import { openQuickSimulator, closeQuickSimulator, calculateSimulation, addSimulatorRow, removeSimulatorRow, openPathToLevel, closePathToLevel, adjustTargetLevel, updateExpectedLevelDisplay, setCurrentRankingPoints, setCurrentValidMatchesWindow, setUserExpectedLevel, initSimulationState } from './simulation-manager.js';
import {
    processMatchData, getFilterValues, extractUniqueYears, applyDataFilters,
    importFromCSV, exportToCSV, updateMatch, deleteMatchById, saveMatches, loadMatches,
    clearAllMatches, getDataState, updateFilteredData, switchDiscipline, getCurrentDiscipline,
    migrateOldData, importScrapedMatches, getRankingProgressionForDate, getMatchDateTime,
    clearAllMatchesAllDisciplines
} from './data-manager.js';
import { fetchAndProcessComparison, initComparisonListeners, handleCompareAction } from './comparison-manager.js';
import { cleanName, fuzzyMatchName, scrapeMatchesFromDocument } from './scraper-utils.js';
import { initTour, startTour } from './demo.js';

let winLossYearFilter = 'all';
let chartYearFilter = 'all';
let csvDelimiter = localStorage.getItem('csvDelimiter') || ';';
let currentLanguage = getCurrentLanguage();
let currentFilters = {
    year: 'all',
    type: '',
    myLvl: 'all',
    players: '',
    result: 'all'
};

let setYearFilter = 'all';
let setLevelFilter = 'all';
let setSetFilter = 'all';
let setTimeFilter = 'all';

let eventListenersAttached = false;
let currentPoints = 0;
let expectedLevel = 12;
let currentDiscipline = 'singles';
let initialized = false;
let currentSort = { field: 'date', direction: 'desc' };
let activeComparisonData = null;
let currentSecondChartType = 'ranking';
let currentThirdChartType = 'margins';

function safeElement(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element #${id} not found`);
    return el;
}

function safeQuery(selector) {
    const el = document.querySelector(selector);
    if (!el) console.warn(`Element "${selector}" not found`);
    return el;
}

function safeSetText(el, text) {
    if (el) el.textContent = text;
}

function safeSetHTML(el, html) {
    if (el) el.innerHTML = html;
}

function safeSetValue(el, val) {
    if (el) el.value = val;
}

function safeAddListener(el, event, handler) {
    if (el) el.addEventListener(event, handler);
}

function normalizeHyphens(str) {
    return str.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
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
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function sortData(data, field = 'date', direction = 'desc') {
    if (!data || data.length === 0) return [];
    const sorted = [...data];
    sorted.sort((a, b) => {
        let comparison = 0;
        switch(field) {
            case 'date':
                const dateA = getMatchDateTime(a);
                const dateB = getMatchDateTime(b);
                if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) comparison = 0;
                else if (isNaN(dateA.getTime())) comparison = 1;
                else if (isNaN(dateB.getTime())) comparison = -1;
                else comparison = dateA.getTime() - dateB.getTime();
                break;
            case 'type':
                const aType = (a.Fase || '').toLowerCase();
                const bType = (b.Fase || '').toLowerCase();
                if (aType < bType) comparison = -1;
                else if (aType > bType) comparison = 1;
                break;
            case 'result':
                if (a.isWin && !b.isWin) comparison = 1;
                else if (!a.isWin && b.isWin) comparison = -1;
                break;
            default:
                const defDateA = getMatchDateTime(a);
                const defDateB = getMatchDateTime(b);
                if (isNaN(defDateA.getTime()) && isNaN(defDateB.getTime())) comparison = 0;
                else if (isNaN(defDateA.getTime())) comparison = 1;
                else if (isNaN(defDateB.getTime())) comparison = -1;
                else comparison = defDateA.getTime() - defDateB.getTime();
        }
        if (direction === 'desc') comparison = -comparison;
        return comparison;
    });
    return sorted;
}

async function updateDashboardTitleWithUserName() {
    const titleH1 = document.querySelector('.header-left h1');
    if (!titleH1) return;
    try {
        const result = await chrome.storage.local.get('userFirstName');
        const name = result.userFirstName;
        if (name && name.trim()) {
            titleH1.textContent = `${name.trim()}'s Badminton Analysis`;
        } else {
            titleH1.textContent = t('dashboard.title');
        }
    } catch (error) {
        console.warn('Could not load user name:', error);
        titleH1.textContent = t('dashboard.title');
    }
}

function handleTourLanguageChange(lang) {
    setCurrentLanguage(lang);
    translateStaticContent();
    updateDashboardTitleWithUserName();
    const languageSelect = safeElement('languageSelect');
    if (languageSelect) languageSelect.value = lang;
    updateUILanguage();
}

function translateStaticContent() {
    const disciplineIcons = document.querySelectorAll('.discipline-icon');
    if (disciplineIcons.length >= 3) {
        disciplineIcons[0].title = t('discipline.tooltip.singles');
        disciplineIcons[1].title = t('discipline.tooltip.doubles');
        disciplineIcons[2].title = t('discipline.tooltip.mixed');
        const tooltips = document.querySelectorAll('.discipline-tooltip');
        if (tooltips.length >= 3) {
            tooltips[0].textContent = t('discipline.tooltip.singles');
            tooltips[1].textContent = t('discipline.tooltip.doubles');
            tooltips[2].textContent = t('discipline.tooltip.mixed');
        }
    }

    const statCards = document.querySelectorAll('.stats-container .card');
    if (statCards.length >= 4) {
        const card0h3 = statCards[0].querySelector('h3');
        if (card0h3) card0h3.textContent = t('dashboard.trophies');

        const card1h3 = statCards[1].querySelector('h3');
        if (card1h3) card1h3.textContent = t('dashboard.expectedLevel');
        const card1sub = statCards[1].querySelector('.sub-value');
        if (card1sub) card1sub.textContent = t('dashboard.currentRankingPoints');

        const card2h3 = statCards[2].querySelector('h3');
        if (card2h3) card2h3.textContent = t('dashboard.totalMatches');

        const card3h3 = statCards[3].querySelector('h3');
        if (card3h3) card3h3.textContent = t('dashboard.simulations');
    }

    const chartTitles = document.querySelectorAll('.chart-box h4');
    if (chartTitles.length >= 3) {
        chartTitles[0].textContent = t('chart.winLoss');
        chartTitles[1].textContent = t('chart.evolution');
        chartTitles[2].textContent = t('chart.margins');
    }

    const profileHeading = safeElement('profileScrapingProfilesHeading');
    safeSetText(profileHeading, t('profile.scrapingProfiles'));
    const bvLabel = safeElement('badmintonVlaanderenLabel');
    safeSetText(bvLabel, t('profile.badmintonVlaanderen'));
    const toernooiLabel = safeElement('toernooiLabel');
    safeSetText(toernooiLabel, t('profile.toernooi'));
    const profileNote = safeElement('profileNote');
    if (profileNote) profileNote.innerHTML = `<small>${t('profile.note')}</small>`;

    const dropdownSections = document.querySelectorAll('#settingsDropdown .dropdown-section');
    if (dropdownSections.length >= 4) {
        const langHeading = dropdownSections[0].querySelector('h5');
        if (langHeading) langHeading.textContent = t('settings.language');
        const csvHeading = dropdownSections[2].querySelector('h5');
        if (csvHeading) csvHeading.textContent = t('settings.csvFormat');
        const actionsHeading = dropdownSections[3].querySelector('h5');
        if (actionsHeading) actionsHeading.textContent = t('settings.actions');
    }
    const resetBtn = safeElement('resetSettingsBtn');
    safeSetText(resetBtn, t('button.resetSettings'));

    const importBtn = safeElement('importCSVBtn');
    safeSetText(importBtn, t('button.import'));
    const exportBtn = safeElement('exportBtn');
    safeSetText(exportBtn, t('button.export'));

    const quickSimBtn = safeElement('quickSimulatorBtn');
    if (quickSimBtn) quickSimBtn.title = t('simulation.quick');
    const pathBtn = safeElement('pathToLevelBtn');
    if (pathBtn) pathBtn.title = t('simulation.path');
    const compareBtn = safeElement('compareBtn');
    if (compareBtn) compareBtn.title = t('simulation.compare');

    const importTooltip = safeQuery('.import-tooltip');
    if (importTooltip) {
        const tooltipH4 = importTooltip.querySelector('h4');
        safeSetText(tooltipH4, t('tooltip.csvImport'));
        const formatSections = importTooltip.querySelectorAll('.format-section');
        if (formatSections.length >= 2) {
            const singH5 = formatSections[0].querySelector('h5');
            safeSetText(singH5, t('tooltip.csvSinglesFormat'));
            const doubH5 = formatSections[1].querySelector('h5');
            safeSetText(doubH5, t('tooltip.csvDoublesMixedFormat'));
            const singEx = formatSections[0].querySelector('.format-example');
            safeSetText(singEx, t('tooltip.csvSinglesExample'));
            const doubEx = formatSections[1].querySelector('.format-example');
            safeSetText(doubEx, t('tooltip.csvDoublesExample'));
        }
        const notes = importTooltip.querySelectorAll('.note');
        if (notes.length >= 2) {
            notes[0].innerHTML = `<span class="note-header">${t('tooltip.csvNoteHeader')}</span> ${t('tooltip.csvNoteColumns')}`;
            notes[1].textContent = t('tooltip.csvExtraNote');
        }
    }

    updateTableHeadersLanguage();
    updateModalsLanguage();
    translateThirdChartDropdown();
}

function translateThirdChartDropdown() {
    const thirdChartDropdown = document.getElementById('thirdChartDropdownMenu');
    if (!thirdChartDropdown) return;
    const items = thirdChartDropdown.querySelectorAll('.dropdown-item');
    if (items.length >= 2) {
        items[0].textContent = t('chart.margins');
        items[1].textContent = t('chart.shotPercentage');
    }
    const activeItem = thirdChartDropdown.querySelector('.dropdown-item.active');
    const titleEl = document.getElementById('thirdChartTitle');
    if (activeItem && titleEl) {
        titleEl.textContent = activeItem.textContent;
    }
}

function updateTableHeadersLanguage() {
    const singlesHeaders = {
        '.singles-col.date-col .header-title': t('table.date'),
        '.singles-col.type-col .header-title': t('table.type'),
        '.singles-col.mylvl-col .header-title': t('table.myLevel'),
        '.singles-col.opp-lvl-col .header-title': t('table.opponentLevel'),
        '.singles-col.opp-name-col .header-title': t('table.opponent'),
        '.singles-col.score-col .header-title': t('table.score'),
        '.singles-col.points-col .header-title': t('table.points'),
        '.singles-col.actions-col .header-title': ''
    };
    Object.entries(singlesHeaders).forEach(([selector, text]) => {
        const el = safeQuery(selector);
        if (el) el.textContent = text;
    });

    const doublesHeaders = {
        '.doubles-col.date-col .header-title': t('table.date'),
        '.doubles-col.type-col .header-title': t('table.type'),
        '.doubles-col.names-col .header-title': t('table.ourTeam'),
        '.doubles-col.levels-col .header-title': t('table.ourLvls'),
        '.doubles-col.opplevels-col .header-title': t('table.oppLvls'),
        '.doubles-col.oppnames-col .header-title': t('table.opponents'),
        '.doubles-col.score-col .header-title': t('table.score'),
        '.doubles-col.points-col .header-title': t('table.points'),
        '.doubles-col.actions-col .header-title': ''
    };
    Object.entries(doublesHeaders).forEach(([selector, text]) => {
        const el = safeQuery(selector);
        if (el) el.textContent = text;
    });

    const filterConfig = {
        'filterYear': { type: 'select', defaultOption: t('table.filterYear') },
        'filterType': { type: 'input', placeholder: t('table.filterType') },
        'filterMyLvl': { type: 'select', defaultOption: t('table.filterMyLvl') },
        'filterOppLvl': { type: 'select', defaultOption: t('table.filterOppLvl') },
        'filterOpponent': { type: 'input', placeholder: t('table.filterOpponent') },
        'filterResult': { type: 'select', defaultOption: t('table.filterResult') },
        'filterYearDoubles': { type: 'select', defaultOption: t('table.filterYear') },
        'filterTypeDoubles': { type: 'input', placeholder: t('table.filterType') },
        'filterTeam': { type: 'input', placeholder: t('table.filterTeammates') },
        'filterOurLevels': { type: 'select', defaultOption: t('table.filterOurLevels') },
        'filterOppLevels': { type: 'select', defaultOption: t('table.filterOppLevels') },
        'filterOpponentsDoubles': { type: 'input', placeholder: t('table.filterOpponentsDoubles') },
        'filterResultDoubles': { type: 'select', defaultOption: t('table.filterResultDoubles') }
    };

    Object.entries(filterConfig).forEach(([id, cfg]) => {
        const el = safeElement(id);
        if (!el) return;
        if (cfg.type === 'input') {
            el.placeholder = cfg.placeholder;
        } else if (cfg.type === 'select') {
            const firstOption = el.querySelector('option[value="all"]');
            if (firstOption) firstOption.textContent = cfg.defaultOption;
            if (id === 'filterResult' || id === 'filterResultDoubles') {
                const winOpt = el.querySelector('option[value="Win"]');
                const lossOpt = el.querySelector('option[value="Loss"]');
                if (winOpt) winOpt.textContent = t('table.filterWin');
                if (lossOpt) lossOpt.textContent = t('table.filterLoss');
            }
        }
    });
}

function updateModalsLanguage() {
    const quickSimTitle = safeQuery('#quickSimulatorModal h3');
    safeSetText(quickSimTitle, t('simulation.quick'));
    const quickSimDesc = safeQuery('#quickSimulatorModal .modal-body > p');
    safeSetText(quickSimDesc, t('simulation.calculateDesc'));

    const addRowBtn = safeElement('addRowBtn');
    if (addRowBtn) addRowBtn.innerHTML = `<span>${t('simulation.addLevel')}</span>`;
    const calcBtn = safeElement('calculateSimulation');
    safeSetText(calcBtn, t('button.calculate'));
    const closeQuickBtn = safeElement('closeQuickSimulatorBtn');
    safeSetText(closeQuickBtn, t('button.close'));

    const quickSpans = document.querySelectorAll('#quickSimulatorModal .simulator-row span');
    quickSpans.forEach(span => {
        const text = span.textContent.trim();
        if (text === 'If I win' || text === 'Als ik win' || text.includes('If I win')) span.textContent = t('simulation.ifWin');
        else if (text === 'match(es) against level' || text.includes('match(es)')) span.textContent = t('simulation.matchesAgainst');
        else if (text === 'and' || text === 'en' || text === 'et' || text === 'und') span.textContent = t('simulation.and');
    });

    const pathTitle = safeQuery('#pathToLevelModal h3');
    safeSetText(pathTitle, t('simulation.path'));
    const pathDesc = safeQuery('#pathToLevelModal .modal-body > p');
    safeSetText(pathDesc, t('simulation.pathDesc'));
    const closePathBtn = safeElement('closePathToLevelBtn');
    safeSetText(closePathBtn, t('button.close'));
    const modalNote = safeQuery('.modal-note');
    if (modalNote) {
        modalNote.innerHTML = `<strong>${t('simulation.note')}</strong> ${t('simulation.calculationNote')}`;
    }

    const compareTitle = safeQuery('#compareModal h3');
    safeSetText(compareTitle, t('simulation.compareTitle'));
    const compareDesc = safeQuery('#compareModal .modal-body > p');
    safeSetText(compareDesc, t('simulation.compareDesc'));
    const savedHeading = document.querySelectorAll('#compareModal h4');
    if (savedHeading.length >= 2) {
        savedHeading[0].textContent = t('simulation.savedPlayers');
        savedHeading[1].textContent = t('simulation.addNewRival');
    }
    const noSavedDiv = safeQuery('#savedPlayersList > div');
    if (noSavedDiv && noSavedDiv.textContent.includes('No saved players')) {
        noSavedDiv.textContent = t('simulation.noSavedPlayers');
    }
    const nameLabel = safeQuery('label[for="compareName"]');
    if (nameLabel) nameLabel.textContent = t('simulation.nameLabel');
    const toernooiLabel = safeQuery('label[for="compareToernooiUrl"]');
    if (toernooiLabel) toernooiLabel.textContent = t('simulation.urlLabel');
    const toernooiHint = safeQuery('#compareToernooiUrl ~ .input-hint');
    safeSetText(toernooiHint, t('simulation.urlHint'));
    const badmintonLabel = safeQuery('label[for="compareBadmintonUrl"]');
    if (badmintonLabel) badmintonLabel.textContent = t('simulation.badmintonUrlLabel');
    const badmintonHint = safeQuery('#compareBadmintonUrl ~ .input-hint');
    safeSetText(badmintonHint, t('simulation.badmintonUrlHint'));
    const loadBtn = safeElement('runCompareBtn');
    safeSetText(loadBtn, t('simulation.loadButton'));
    const closeCompareBtn = safeElement('closeCompareBtn');
    if (closeCompareBtn) closeCompareBtn.title = t('button.close');
}

function getPointsTooltip(match, t) {
    if (match.excludeFromRanking) {
        return t('points.tooltip.excluded');
    }
    if (!match.isValid) {
        return t('points.tooltip.invalid');
    }

    const { currentData } = getDataState();
    const matchIndex = currentData.findIndex(m => m.id === match.id);
    if (matchIndex !== -1) {
        const matchesUpToThis = currentData.slice(0, matchIndex + 1).map(m => ({
            ...m,
            DatumObj: getMatchDateTime(m)
        }));
        const calcDate = getMatchDateTime(match);
        const progression = getRankingProgressionForDate(matchesUpToThis, calcDate);
        if (progression.length > 0) {
            let tooltip = (t('points.tooltip.progression') || 'Point calculation:') + '\n';
            progression.forEach((item, idx) => {
                const dateStr = item.match.Datum;
                tooltip += ` ${idx+1}. | ${dateStr} | ${item.points} pts | ${item.runningAvg.toFixed(1)}\n`;
            });
            const finalAvg = progression[progression.length-1].runningAvg;
            tooltip += (t('points.tooltip.finalAverage') || 'Final average') + `: ${finalAvg.toFixed(1)}`;
            return tooltip;
        }
    }
    return '';
}

function handleComparisonData(comparisonData) {
    activeComparisonData = comparisonData;
    const { currentData } = getDataState();
    if (currentSecondChartType === 'ranking') {
        renderSecondChart();
    }
    showStatusMessage(`Loaded comparison data for ${comparisonData.name}`, 'info');
}

document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        if (initialized) return;
        initialized = true;

        try {
            await migrateOldData();

            initThemeToggle();
            initSettingsDropdown();
            const restartBtn = document.getElementById('restartTourBtn');
            if (restartBtn) {
                restartBtn.addEventListener('click', () => {
                    startTour(handleTourLanguageChange);
                    document.getElementById('settingsDropdown')?.classList.remove('show');
                });
            }
            initLanguageSelector();
            initDelimiterSelector();
            initProfileInputs();
            initEventListeners();
            initDisciplineSelector();
            initSecondChartDropdown();
            initThirdChartDropdown();
            initTour(handleTourLanguageChange);

            initComparisonListeners(handleComparisonData);

            translateStaticContent();
            updateUILanguage();
            await updateDashboardTitleWithUserName();

            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === "showNotification") {
                    showStatusMessage(request.message, 'info');
                    setTimeout(loadAndRender, 2000);
                    if (sendResponse) sendResponse({ received: true });
                }
                if (request.action === "updateDashboard") {
                    loadAndRender();
                    if (sendResponse) sendResponse({ updated: true });
                }
                return true;
            });

            await loadAndRender();

            initHoverZoom();

        } catch (error) {
            console.error('Dashboard init error:', error);
            showStatusMessage(t('error.loadingData'), 'error');
        }
    }, 0);
});

function initThemeToggle() {
    const themeBtn = safeElement('themeBtn');
    if (!themeBtn) return;
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.body.classList.add('dark-mode');
        themeBtn.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        themeBtn.textContent = '🌙';
    }
    themeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, { capture: true });
}

function initSettingsDropdown() {
    const settingsBtn = safeElement('settingsBtn');
    const dropdown = safeElement('settingsDropdown');
    const resetSettingsBtn = safeElement('resetSettingsBtn');
    if (!settingsBtn || !dropdown) return;

    settingsBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        document.querySelectorAll('.dropdown-content.show').forEach(el => {
            if (el !== dropdown) el.classList.remove('show');
        });
        dropdown.classList.toggle('show');
        return false;
    }, { capture: true });

    document.addEventListener('click', function(e) {
        if (dropdown && dropdown.classList.contains('show') &&
            !dropdown.contains(e.target) && !settingsBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }, { capture: true });

    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            resetSettings();
        });
    }
    initProfileInputs();
}

function initLanguageSelector() {
    const languageSelect = safeElement('languageSelect');
    if (!languageSelect) return;
    languageSelect.value = currentLanguage;
    languageSelect.addEventListener('change', (e) => {
        currentLanguage = e.target.value;
        setCurrentLanguage(currentLanguage);
        translateStaticContent();
        updateUILanguage();
        updateExpectedLevelDisplay(currentPoints, expectedLevel);
        showStatusMessage(`Language changed to ${currentLanguage.toUpperCase()}`, 'info');
    });
}

function updateUILanguage() {
    document.documentElement.lang = currentLanguage;
    translateStaticContent();
    updateDashboardTitleWithUserName();
}

function initDelimiterSelector() {
    const delimiterSelect = safeElement('delimiterSelect');
    if (!delimiterSelect) return;
    delimiterSelect.value = csvDelimiter;
    delimiterSelect.addEventListener('change', (e) => {
        csvDelimiter = e.target.value;
        localStorage.setItem('csvDelimiter', csvDelimiter);
        showStatusMessage(`CSV delimiter set to "${csvDelimiter}"`, 'info');
    });
}

function initProfileInputs() {
    const badmintonProfileInput = safeElement('badmintonVlaanderenProfile');
    const toernooiProfileInput = safeElement('toernooiProfile');
    if (!badmintonProfileInput || !toernooiProfileInput) return;

    chrome.storage.local.get(['badmintonVlaanderenProfile', 'toernooiProfile'], (result) => {
        if (result.badmintonVlaanderenProfile) badmintonProfileInput.value = result.badmintonVlaanderenProfile;
        if (result.toernooiProfile) toernooiProfileInput.value = result.toernooiProfile;
    });

    badmintonProfileInput.addEventListener('blur', (e) => saveProfileUrl('badmintonVlaanderenProfile', e.target.value));
    toernooiProfileInput.addEventListener('blur', (e) => saveProfileUrl('toernooiProfile', e.target.value));
}

function saveProfileUrl(key, url) {
    if (!url || url.trim() === '') {
        chrome.storage.local.remove([key]);
        return;
    }
    const cleanUrl = url.trim();
    let isValid = false;
    if (key === 'badmintonVlaanderenProfile') {
        isValid = cleanUrl.includes('badmintonvlaanderen.be') && (cleanUrl.includes('/profile/') || cleanUrl.includes('/speler/'));
    } else if (key === 'toernooiProfile') {
        isValid = (cleanUrl.includes('toernooi.nl') || cleanUrl.includes('tournamentsoftware.com')) && (cleanUrl.includes('/player-profile/') || cleanUrl.includes('/speler/'));
    }
    if (!isValid) {
        showStatusMessage(`Invalid ${key.replace('Profile', '')} profile URL.`, 'error');
        return;
    }
    chrome.storage.local.set({ [key]: cleanUrl }, () => showStatusMessage('Profile URL saved', 'info'));
}

function resetSettings() {
    if (confirm(t('confirm.clearAll'))) {
        localStorage.removeItem('csvDelimiter');
        localStorage.removeItem('badmintonLanguage');
        localStorage.removeItem('theme');
        chrome.storage.local.remove(['badmintonVlaanderenProfile', 'toernooiProfile', 'lastCompareName', 'lastCompareUrl'], () => {
            csvDelimiter = ';';
            currentLanguage = 'en';
            activeComparisonData = null;
            location.reload();
        });
    }
}

function initDisciplineSelector() {
    const disciplineIcons = document.querySelectorAll('.discipline-icon');
    disciplineIcons.forEach(icon => {
        const discLetter = icon.getAttribute('data-discipline');
        let discipline;
        switch(discLetter) {
            case 'S': discipline = 'singles'; break;
            case 'D': discipline = 'doubles'; break;
            case 'M': discipline = 'mixed'; break;
            default: return;
        }
        if (discipline === currentDiscipline) icon.classList.add('active');

        icon.addEventListener('click', async () => {
            if (discipline === currentDiscipline) return;
            disciplineIcons.forEach(i => i.classList.remove('active'));
            icon.classList.add('active');
            await switchDiscipline(discipline);
            currentDiscipline = discipline;
            updateTableLayout(discipline);
            updatePlayersColumnTitle();
            activeComparisonData = null;
            await loadAndRender();
            showStatusMessage(`Switched to ${discipline} discipline`, 'info');
        });
    });
}

function updateDisciplineSelector() {
    const disciplineIcons = document.querySelectorAll('.discipline-icon');
    disciplineIcons.forEach(icon => {
        const discLetter = icon.getAttribute('data-discipline');
        let discipline;
        switch(discLetter) {
            case 'S': discipline = 'singles'; break;
            case 'D': discipline = 'doubles'; break;
            case 'M': discipline = 'mixed'; break;
            default: return;
        }
        if (discipline === currentDiscipline) icon.classList.add('active');
        else icon.classList.remove('active');
    });
}

function initSecondChartDropdown() {
    const titleContainer = document.getElementById('secondChartTitleContainer');
    const dropdownMenu = document.getElementById('secondChartDropdownMenu');
    const titleEl = document.getElementById('secondChartTitle');

    if (!titleContainer || !dropdownMenu || !titleEl) {
        console.error('initSecondChartDropdown: missing elements');
        return;
    }

    titleContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!titleContainer.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    dropdownMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;

        const chartType = item.dataset.chart;
        if (!chartType) return;

        document.querySelectorAll('#secondChartDropdownMenu .dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        titleEl.textContent = item.textContent;

        dropdownMenu.classList.remove('show');

        currentSecondChartType = chartType;
        renderSecondChart();
    });
}

function initThirdChartDropdown() {
    const titleContainer = document.getElementById('thirdChartTitleContainer');
    const dropdownMenu = document.getElementById('thirdChartDropdownMenu');
    const titleEl = document.getElementById('thirdChartTitle');
    if (!titleContainer || !dropdownMenu || !titleEl) {
        console.error('initThirdChartDropdown: missing elements');
        return;
    }

    titleContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!titleContainer.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    dropdownMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;

        const chartType = item.dataset.chart;
        if (!chartType) return;

        document.querySelectorAll('#thirdChartDropdownMenu .dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        titleEl.textContent = item.textContent;

        dropdownMenu.classList.remove('show');

        currentThirdChartType = chartType;
        renderThirdChart();

        const chartBox = document.querySelector('.chart-box:has(#setChart)');
        if (chartBox && chartBox.classList.contains('zoomed')) {
            chartBox.classList.remove('zoomed');
        }
    });
}

function renderSecondChart() {
    const { currentData } = getDataState();
    const yearFilter = document.getElementById('chartYearFilter')?.value || 'all';
    const rivalSelector = document.getElementById('rivalSelector');

    if (currentSecondChartType === 'ranking') {
        if (rivalSelector) rivalSelector.style.display = '';
        renderEvolutionChart(currentData, yearFilter, null, activeComparisonData);
    } else {
        if (rivalSelector) rivalSelector.style.display = 'none';
        renderPointsCumulativeChart(currentData, yearFilter);
    }
}

function renderThirdChart() {
    const { currentData } = getDataState();
    const filters = {
        year: document.getElementById('setYearFilter')?.value || 'all',
        level: document.getElementById('setLevelFilter')?.value || 'all',
        set: document.getElementById('setSetFilter')?.value || 'all',
        time: document.getElementById('setTimeFilter')?.value || 'all'
    };

    const canvas = document.getElementById('setChart');
    const chartBox = document.querySelector('.chart-box:has(#setChart)');
    if (canvas) canvas.classList.remove('zoomed-canvas');
        const overlay = document.getElementById('zoomOverlay');
        if (overlay) overlay.style.display = 'none';
    if (chartBox) chartBox.classList.remove('zoomed-container');
    const errorEl = document.getElementById('chartErrorSet');
    const explanationEl = document.getElementById('shotPercentageExplanation');
    const filterGroup = document.getElementById('thirdChartFilters');
    
    if (!canvas || !errorEl || !explanationEl) return;

    if (filterGroup) {
        filterGroup.style.display = (currentThirdChartType === 'competition-tournament') ? 'none' : 'contents';
    }

    switch (currentThirdChartType) {
        case 'margins':
            explanationEl.style.display = 'none';
            renderSetChart(currentData, filters);
            break;
        case 'shot-percentage':
            explanationEl.style.display = 'block';
            renderShotPercentageChart(currentData, filters);
            break;
        case 'competition-tournament':
            explanationEl.style.display = 'none';
            renderCompetitionTournamentRadar(currentData);
            break;
        default:
            explanationEl.style.display = 'none';
            renderSetChart(currentData, filters);
    }
}

function initEventListeners() {
    if (eventListenersAttached) return;
    eventListenersAttached = true;

    const csvInput = safeElement('csvInput');
    const importCSVBtn = safeElement('importCSVBtn');
    if (importCSVBtn && csvInput) {
        importCSVBtn.addEventListener('click', (e) => { e.preventDefault(); csvInput.click(); });
        csvInput.addEventListener('change', handleCSVImport);
    }

    const exportBtn = safeElement('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', handleExport);

    const scrapeAllBtn = safeElement('scrapeAllBtn');
    if (scrapeAllBtn) scrapeAllBtn.addEventListener('click', handleScrapeAll);

    const clearAllDisciplinesBtn = safeElement('clearAllDisciplinesBtn');
    if (clearAllDisciplinesBtn) clearAllDisciplinesBtn.addEventListener('click', handleClearAllDisciplines);

    const clearAllSinglesBtn = safeElement('clearAllSinglesBtn');
    if (clearAllSinglesBtn) clearAllSinglesBtn.addEventListener('click', handleClearAll);
    const clearAllDoublesBtn = safeElement('clearAllDoublesBtn');
    if (clearAllDoublesBtn) clearAllDoublesBtn.addEventListener('click', handleClearAll);

    const expectedLevelInput = safeElement('expectedLevelInput');
    if (expectedLevelInput) {
        expectedLevelInput.addEventListener('change', async (e) => {
            const newLevel = parseInt(e.target.value);
            if (newLevel >= 1 && newLevel <= 12) {
                const discipline = await getCurrentDiscipline();
                const manualLevelKey = `manualExpectedLevel${discipline.charAt(0).toUpperCase() + discipline.slice(1)}`;
                sessionStorage.setItem(manualLevelKey, newLevel);
                setUserExpectedLevel(newLevel);
                expectedLevel = newLevel;
                updateExpectedLevelDisplay(currentPoints, newLevel);
            }
        });
    }

    const quickSimulatorBtn = safeElement('quickSimulatorBtn');
    if (quickSimulatorBtn) quickSimulatorBtn.addEventListener('click', openQuickSimulator);

    const pathToLevelBtn = safeElement('pathToLevelBtn');
    if (pathToLevelBtn) pathToLevelBtn.addEventListener('click', openPathToLevel);

    const closeQuick = safeElement('closeQuickSimulator');
    if (closeQuick) closeQuick.addEventListener('click', closeQuickSimulator);
    const closeQuickBtn = safeElement('closeQuickSimulatorBtn');
    if (closeQuickBtn) closeQuickBtn.addEventListener('click', closeQuickSimulator);
    const quickOverlay = safeElement('quickSimulatorOverlay');
    if (quickOverlay) quickOverlay.addEventListener('click', closeQuickSimulator);

    const calculateSimulationBtn = safeElement('calculateSimulation');
    if (calculateSimulationBtn) calculateSimulationBtn.addEventListener('click', calculateSimulation);

    const addRowBtn = safeElement('addRowBtn');
    if (addRowBtn) addRowBtn.addEventListener('click', addSimulatorRow);

    document.addEventListener('click', (e) => {
        if (e.target.id === 'removeRow1') removeSimulatorRow(1);
        else if (e.target.id === 'removeRow2') removeSimulatorRow(2);
        else if (e.target.id === 'removeRow3') removeSimulatorRow(3);
    });

    const closePath = safeElement('closePathToLevel');
    if (closePath) closePath.addEventListener('click', closePathToLevel);
    const closePathBtn = safeElement('closePathToLevelBtn');
    if (closePathBtn) closePathBtn.addEventListener('click', closePathToLevel);
    const pathOverlay = safeElement('pathToLevelOverlay');
    if (pathOverlay) pathOverlay.addEventListener('click', closePathToLevel);
    const incBtn = safeElement('increaseLevel');
    if (incBtn) incBtn.addEventListener('click', () => adjustTargetLevel(1));
    const decBtn = safeElement('decreaseLevel');
    if (decBtn) decBtn.addEventListener('click', () => adjustTargetLevel(-1));

    const matchTable = safeElement('matchTable');
    if (matchTable) {
        matchTable.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.btn-del');
            if (delBtn) {
                const id = delBtn.getAttribute('data-id');
                if (id) handleDeleteMatch(id);
            }
            const toggleBtn = e.target.closest('.btn-toggle-discipline');
            if (toggleBtn) {
                const id = toggleBtn.getAttribute('data-id');
                const disc = toggleBtn.getAttribute('data-discipline');
                if (id && disc) handleToggleDiscipline(id, disc);
            }
            const sortHeader = e.target.closest('.sortable-header');
            if (sortHeader) {
                const sortField = sortHeader.getAttribute('data-sort');
                if (sortField) handleSortClick(sortField);
            }
        });
        matchTable.addEventListener('change', (e) => {
            if (e.target.classList.contains('row-input')) handleInlineEdit(e.target);
        });
    }

    setupFilterListeners();

    const wlYearFilter = safeElement('wlYearFilter');
    if (wlYearFilter) {
        wlYearFilter.addEventListener('change', () => {
            winLossYearFilter = wlYearFilter.value;
            const { currentData } = getDataState();
            renderWinLossSummary(currentData, winLossYearFilter);
        });
    }

    const chartYearFilterEl = safeElement('chartYearFilter');
    if (chartYearFilterEl) chartYearFilterEl.addEventListener('change', renderSecondChart);

    const setYearEl = safeElement('setYearFilter');
    if (setYearEl) setYearEl.addEventListener('change', renderThirdChart);
    const setLevelEl = safeElement('setLevelFilter');
    if (setLevelEl) setLevelEl.addEventListener('change', renderThirdChart);
    const setSetEl = safeElement('setSetFilter');
    if (setSetEl) setSetEl.addEventListener('change', renderThirdChart);
    const setTimeEl = safeElement('setTimeFilter');
    if (setTimeEl) setTimeEl.addEventListener('change', renderThirdChart);

    const rivalSelector = document.getElementById('rivalSelector');
    if (rivalSelector) {
        rivalSelector.addEventListener('change', async (e) => {
            const selectedId = e.target.value;
            if (selectedId === 'me') {
                activeComparisonData = null;
                renderSecondChart();
                return;
            }
            chrome.storage.local.get(['savedComparisonPlayers'], (result) => {
                const saved = result.savedComparisonPlayers || [];
                const player = saved.find(p => p.id === selectedId);
                if (player) {
                    const currentDiscipline = document.querySelector('.discipline-icon.active')?.getAttribute('data-discipline') || 'S';
                    const disciplineMap = { S: 'singles', D: 'doubles', M: 'mixed' };
                    handleCompareAction(
                        {
                            name: player.name,
                            toernooiUrl: player.toernooiUrl || '',
                            badmintonUrl: player.badmintonUrl || ''
                        },
                        (data) => {
                            activeComparisonData = data;
                            renderSecondChart();
                        },
                        disciplineMap[currentDiscipline] || 'singles'
                    );
                }
            });
        });
    }
}

async function handleClearAllDisciplines() {
    if (!confirm(t('confirm.clearAll'))) return;
    try {
        await clearAllMatchesAllDisciplines();
        showStatusMessage(t('success.cleared'), 'info');
        loadAndRender();
    } catch (error) {
        showStatusMessage('Error clearing all data', 'error');
    }
}

function handleSortClick(sortField) {
    if (currentSort.field === sortField) currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    else { currentSort.field = sortField; currentSort.direction = 'desc'; }
    updateSortIndicators();
    const { currentData } = getDataState();
    const sorted = sortData([...currentData], currentSort.field, currentSort.direction);
    updateFilteredData(sorted);
    renderTable(sorted);
}

function updateSortIndicators() {
    document.querySelectorAll('.sortable-header .sort-indicator').forEach(i => i.className = 'sort-indicator');
    const activeHeader = safeQuery(`.sortable-header[data-sort="${currentSort.field}"]`);
    if (activeHeader) {
        const indicator = activeHeader.querySelector('.sort-indicator');
        if (indicator) indicator.className = `sort-indicator ${currentSort.direction}`;
    }
}

function setupFilterListeners() {
    const filterIds = ['filterYear', 'filterType', 'filterMyLvl', 'filterOppLvl', 'filterOpponent', 'filterResult'];
    filterIds.forEach(id => {
        const element = safeElement(id);
        if (element) {
            element.addEventListener('input', applyFilters);
            element.addEventListener('change', applyFilters);
        }
    });

    const doublesFilterIds = [
        'filterYearDoubles', 'filterTypeDoubles', 'filterTeam', 'filterOurLevels',
        'filterOppLevels', 'filterOpponentsDoubles', 'filterResultDoubles'
    ];
    doublesFilterIds.forEach(id => {
        const element = safeElement(id);
        if (element) {
            element.addEventListener('input', applyFilters);
            element.addEventListener('change', applyFilters);
        }
    });
}

function applyFilters() {
    try {
        if (currentDiscipline === 'singles') {
            currentFilters = {
                year: safeElement('filterYear')?.value || 'all',
                type: (safeElement('filterType')?.value || '').toLowerCase(),
                myLvl: safeElement('filterMyLvl')?.value || 'all',
                oppLvl: safeElement('filterOppLvl')?.value || 'all',
                opponent: (safeElement('filterOpponent')?.value || '').toLowerCase(),
                result: safeElement('filterResult')?.value || 'all'
            };
        } else {
            currentFilters = {
                year: safeElement('filterYearDoubles')?.value || 'all',
                type: (safeElement('filterTypeDoubles')?.value || '').toLowerCase(),
                team: (safeElement('filterTeam')?.value || '').toLowerCase(),
                ourLevels: safeElement('filterOurLevels')?.value || 'all',
                oppLevels: safeElement('filterOppLevels')?.value || 'all',
                opponents: (safeElement('filterOpponentsDoubles')?.value || '').toLowerCase(),
                result: safeElement('filterResultDoubles')?.value || 'all'
            };
        }

        const { currentData } = getDataState();
        const filtered = applyDataFilters(currentData, currentFilters);
        const sorted = sortData([...filtered], currentSort.field, currentSort.direction);
        updateFilteredData(sorted);
        renderTable(sorted);
    } catch (error) {
        console.error('Filter error:', error);
    }
}

function populateFilters(data) {
    const filterValues = getFilterValues(data);

    const fillSelect = (id, values, sortDesc = true) => {
        const sel = safeElement(id);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = `<option value="all">${t('table.filterAll')}</option>`;
        const sorted = values.sort((a, b) => sortDesc ? b - a : a - b);
        sorted.forEach(val => {
            sel.innerHTML += `<option value="${val}">${val}</option>`;
        });
        if (currentVal && currentVal !== 'all') sel.value = currentVal;
    };

    try {
        fillSelect('filterYear', filterValues.years, true);
        fillSelect('filterYearDoubles', filterValues.years, true);
        fillSelect('filterMyLvl', filterValues.myLvls, false);
        fillSelect('filterOppLvl', filterValues.oppLvls, false);

        const list = safeElement('oppList');
        if (list) {
            list.innerHTML = '';
            filterValues.players.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                list.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Populate filters error:', error);
    }
}

function populateYearFilters(data) {
    const years = extractUniqueYears(data);

    const wlFilter = safeElement('wlYearFilter');
    if (wlFilter) {
        const currentWlVal = wlFilter.value;
        wlFilter.innerHTML = '<option value="all">' + t('table.filterAllYears') + '</option>';
        years.forEach(year => wlFilter.innerHTML += `<option value="${year}">${year}</option>`);
        if (currentWlVal && currentWlVal !== 'all' && years.includes(parseInt(currentWlVal))) wlFilter.value = currentWlVal;
        winLossYearFilter = wlFilter.value;
    }

    const chartFilter = safeElement('chartYearFilter');
    if (chartFilter) {
        const currentChartVal = chartFilter.value;
        chartFilter.innerHTML = '<option value="all">' + t('table.filterAllYears') + '</option>';
        years.forEach(year => chartFilter.innerHTML += `<option value="${year}">${year}</option>`);
        if (currentChartVal && currentChartVal !== 'all' && years.includes(parseInt(currentChartVal))) chartFilter.value = currentChartVal;
        chartYearFilter = chartFilter.value;
    }

    const setYearEl = safeElement('setYearFilter');
    if (setYearEl) {
        const currentSetVal = setYearEl.value;
        setYearEl.innerHTML = '<option value="all">' + t('table.filterAllYears') + '</option>';
        years.forEach(year => setYearEl.innerHTML += `<option value="${year}">${year}</option>`);
        if (currentSetVal && currentSetVal !== 'all' && years.includes(parseInt(currentSetVal))) setYearEl.value = currentSetVal;
        setYearFilter = setYearEl.value;
    }
}

function showStatusMessage(message, type = 'info') {
    const statusEl = safeElement('statusMsg');
    if (!statusEl) {
        console.log(`Status (${type}): ${message}`);
        return;
    }
    statusEl.textContent = message;
    statusEl.className = `status-${type}`;
    if (type !== 'error') setTimeout(() => { if (statusEl) { statusEl.textContent = ''; statusEl.className = ''; } }, 3000);
}

function updateTrophiesDisplay(history) {
    const goldMatches = [];
    const silverMatches = [];
    const bronzeMatches = [];
    const countedIds = new Set();

    const roundOf16Regex = /\b(8e|8ème|8ste|huitième|eighth)[- ]?de?[- ]?finale?\b/i;
    const quarterFinalRegex = /\b(kwartfinale?|quarter-?finale?|quart[- ]?de[- ]?finale?)\b/i;
    const semiFinalRegex = /\b(halve finale|semi-?finale?|demi[- ]?finale?)\b/i;
    const finalRegex = /\b(finale?|final)\b/i;

    history.forEach(m => {
        if (countedIds.has(m.id)) return;
        const extra = (m.typeExtra || '').toLowerCase();
        const isWin = m.isWin;

        if (!extra) return;

        if (roundOf16Regex.test(extra)) return;
        if (quarterFinalRegex.test(extra)) return;

        if (semiFinalRegex.test(extra)) {
            if (!isWin) {
                bronzeMatches.push(m);
                countedIds.add(m.id);
            }
            return;
        }

        if (finalRegex.test(extra)) {
            if (isWin) goldMatches.push(m);
            else silverMatches.push(m);
            countedIds.add(m.id);
            return;
        }
    });

    document.getElementById('goldCount').textContent = goldMatches.length;
    document.getElementById('silverCount').textContent = silverMatches.length;
    document.getElementById('bronzeCount').textContent = bronzeMatches.length;

    const cleanExtra = (text) => {
        if (!text) return '';
        let cleaned = text.replace(/\b(finale?|halve|kwart|demi|quart|8e|8ème|huitième)\b/gi, '');
        cleaned = cleaned.replace(/[–—]/g, '');
        return cleaned.replace(/\s+/g, ' ').trim();
    };

    const buildTooltip = (matches, label) => {
        if (matches.length === 0) return 'None';
        let html = `${label}:<br>`;
        matches.forEach(m => {
            const extra = cleanExtra(m.typeExtra || '');
            const tournament = m.Fase || 'Unknown';
            html += `${tournament} (${extra})<br>`;
        });
        return html.slice(0, -4);
    };

    document.getElementById('goldTooltip').innerHTML = buildTooltip(goldMatches, t('trophies.firstPlace'));
    document.getElementById('silverTooltip').innerHTML = buildTooltip(silverMatches, t('trophies.secondPlace'));
    document.getElementById('bronzeTooltip').innerHTML = buildTooltip(bronzeMatches, t('trophies.thirdFourthPlace'));
}

async function loadAndRender() {
    try {
        currentDiscipline = await getCurrentDiscipline();
        updateDisciplineSelector();
        updateTableLayout(currentDiscipline);
        updatePlayersColumnTitle();

        const { matches } = await loadMatches();
        const { history, currentPoints: newCurrentPoints, expectedLevel: newExpectedLevel, currentValidMatchesWindow, stats } = processMatchData(matches);

        initSimulationState(newCurrentPoints, currentValidMatchesWindow, newExpectedLevel, history);

        currentPoints = newCurrentPoints;
        const discipline = await getCurrentDiscipline();
        const manualLevelKey = `manualExpectedLevel${discipline.charAt(0).toUpperCase() + discipline.slice(1)}`;
        const manualLevel = sessionStorage.getItem(manualLevelKey);
        expectedLevel = manualLevel ? parseInt(manualLevel) : newExpectedLevel;

        setCurrentRankingPoints(currentPoints);
        setCurrentValidMatchesWindow(currentValidMatchesWindow);
        setUserExpectedLevel(expectedLevel);

        updateTrophiesDisplay(history);

        populateFilters(history);
        populateYearFilters(history);
        updateStatsDisplay(stats, currentPoints, expectedLevel);

        renderTable(history);
        renderSecondChart();
        renderWinLossSummary(history, winLossYearFilter || 'all');
        renderThirdChart();
    } catch (error) {
        console.error('Load and render error:', error);
        showStatusMessage(t('error.loadingData'), 'error');
    }
}

function updateTableLayout(discipline) {
    const table = safeElement('matchTable');
    if (!table) return;

    const allCols = table.querySelectorAll('th, td');
    allCols.forEach(col => col.style.display = '');

    if (discipline === 'singles') {
        table.querySelectorAll('.doubles-col').forEach(col => col.style.display = 'none');
        table.style.minWidth = '1000px';
    } else {
        table.querySelectorAll('.singles-col').forEach(col => col.style.display = 'none');
        table.style.minWidth = '1100px';
    }
    table.style.width = '100%';
    updatePlayersColumnTitle();
}

function updatePlayersColumnTitle() {
    const playersTitle = safeElement('playersColumnTitle');
    if (!playersTitle) return;
    if (currentDiscipline === 'singles') playersTitle.textContent = t('table.opponent');
    else playersTitle.textContent = t('table.ourTeam');
}

function updateStatsDisplay(stats, currentPoints, expectedLevel) {
    const { totalMatches, recentMatches } = stats;
    updateExpectedLevelDisplay(currentPoints, expectedLevel);
    const totalEl = safeElement('totalMatches');
    if (totalEl) totalEl.innerText = totalMatches;
    const recentEl = safeElement('recentMatches');
    if (recentEl) recentEl.innerText = recentMatches;
    const expectedInput = safeElement('expectedLevelInput');
    if (expectedInput) expectedInput.value = expectedLevel;
}

function renderTable(data) {
    const tbody = document.querySelector('#matchTable tbody');
    if (!tbody) return;

    const sortedData = sortData([...data], currentSort.field, currentSort.direction);
    tbody.innerHTML = '';
    const discipline = currentDiscipline;

    sortedData.forEach(m => {
        try {
            const tr = document.createElement('tr');
            tr.className = m.isWin ? 'win-row' : 'loss-row';
            if (!m.isRecent) tr.classList.add('excluded-row');
            if (m.excludeFromRanking) tr.classList.add('no-ranking-row');
            if (!m.isValid && !m.excludeFromRanking) tr.classList.add('invalid-match-row');

            let dateVal = m.Datum || "";
            const d = parseUniversalDate(dateVal);
            if (!isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                dateVal = `${dd}/${mm}/${yy}`;
            }

            const myRank = Math.min(Math.max(parseInt(m.Jij || 12), 1), 12);
            const oppRank = Math.min(Math.max(parseInt(m.Hij || 12), 1), 12);
            const extraPoints = m.ptsReceived || 0;
            let extraPointsDisplay = `+(${extraPoints})`;
            if (m.excludeFromRanking || !m.isValid) extraPointsDisplay = '-';

            if (discipline === 'singles') {
                tr.innerHTML = `
                    <td class="singles-col date-col" style="width: 10%; text-align: left;">
                        <div class="date-cell-container">
                            <input type="text" class="row-input input-date" data-id="${m.id}" data-field="Datum" value="${dateVal}" placeholder="${t('table.date')}">
                            <input type="text" class="row-input input-scraped-time" data-id="${m.id}" data-field="scrapedTime" value="${m.scrapedTime || ''}" placeholder="Time (HH:MM)">
                        </div>
                        \t
                    <td class="singles-col type-col" style="width: 20%; text-align: left;">
                        <div class="type-cell-container">
                            <input type="text" class="row-input input-type" data-id="${m.id}" data-field="Fase" value="${m.Fase || ''}" placeholder="${t('table.type')}">
                            <input type="text" class="row-input input-extra-type" data-id="${m.id}" data-field="typeExtra" value="${m.typeExtra || ''}" placeholder="Extra info">
                        </div>
                        \t
                    <td class="singles-col mylvl-col" style="width: 5%; text-align: center;">
                        <input type="number" class="row-input input-my-rank" data-id="${m.id}" data-field="Jij" value="${myRank}" min="1" max="12">
                        \t
                    <td class="singles-col opp-lvl-col" style="width: 5%;">
                        <div class="cell-flex justify-end">
                            <span class="paren">(</span>
                            <input type="number" class="row-input input-opp-rank" data-id="${m.id}" data-field="Hij" value="${oppRank}" min="1" max="12" style="text-align: right; width: 20px;">
                            <span class="paren">)</span>
                        </div>
                        \t
                    <td class="singles-col opp-name-col" style="width: 16%; text-align: left;">
                        <div class="opp-name-cell">
                            <input type="text" class="row-input input-opp-name" data-id="${m.id}" data-field="Tegenstander" value="${m.Tegenstander || ''}" placeholder="${t('table.opponent')}">
                        </div>
                        \t
                    <td class="singles-col score-col" style="width: 18%; text-align: right;">
                        <div class="cell-flex justify-end">
                            <input type="text" class="row-input input-score" data-id="${m.id}" data-field="Result" value="${m.Result || ''}" placeholder="${t('table.score')}">
                            <span class="paren">(</span>
                            <input type="text" class="row-input input-dur" data-id="${m.id}" data-field="Duur" value="${m.Duur || ''}" placeholder="${t('table.duration')}">
                            <span class="paren">)</span>
                        </div>
                        \t
                    <td class="singles-col points-col" style="width: 17%; text-align: center;">
                        <div class="stacked-points-container" title="${getPointsTooltip(m, t)}">
                            <div class="main-points-value"><strong>${m.newTotal || '0'}</strong></div>
                            <div class="extra-points-info scraped-info">${extraPointsDisplay}</div>
                        </div>
                        \t
                    <td class="singles-col actions-col" style="width: 7%; text-align: right;">
                        <button class="action-btn btn-del" data-id="${m.id}" title="${t('button.delete')}">🗑️</button>
                        \t
                `;
            } else {
                tr.innerHTML = `
                    <td class="doubles-col date-col" style="width: 8%; text-align: left;">
                        <div class="date-cell-container">
                            <input type="text" class="row-input input-date" data-id="${m.id}" data-field="Datum" value="${dateVal}" placeholder="${t('table.date')}">
                            <input type="text" class="row-input input-scraped-time" data-id="${m.id}" data-field="scrapedTime" value="${m.scrapedTime || ''}" placeholder="Time (HH:MM)">
                        </div>
                        \t
                    <td class="doubles-col type-col" style="width: 16%; text-align: left;">
                        <div class="type-cell-container">
                            <input type="text" class="row-input input-type" data-id="${m.id}" data-field="Fase" value="${m.Fase || ''}" placeholder="${t('table.type')}">
                            <input type="text" class="row-input input-extra-type" data-id="${m.id}" data-field="typeExtra" value="${m.typeExtra || ''}" placeholder="Extra info">
                        </div>
                        \t
                    <td class="doubles-col names-col" style="width: 17%; text-align: right;">
                        <div class="doubles-names-stacked">
                            <div>Me</div>
                            <input type="text" class="row-input" data-id="${m.id}" data-field="teammateName" value="${m.teammateName || ''}" placeholder="${t('table.ourTeam')}" style="width: 150px;">
                        </div>
                        \t
                    <td class="doubles-col levels-col" style="width: 5%; text-align: left;">
                       <div class="doubles-levels-stacked">
                            <input type="number" class="row-input input-my-rank" data-id="${m.id}" data-field="Jij" value="${myRank}" min="1" max="12" style="width: 30px; text-align: center;">
                            <input type="number" class="row-input" data-id="${m.id}" data-field="teammateLevel" value="${m.teammateLevel || 12}" min="1" max="12" style="width: 30px; text-align: center;">
                      </div>
                    \t
                  <td class="doubles-col opplevels-col" style="width: 5%; text-align: right;">
                     <div class="doubles-levels-stacked">
                          <input type="number" class="row-input" data-id="${m.id}" data-field="opponent1Level" value="${m.opponent1Level || 12}" min="1" max="12" style="width: 30px; text-align: center;">
                          <input type="number" class="row-input" data-id="${m.id}" data-field="opponent2Level" value="${m.opponent2Level || 12}" min="1" max="12" style="width: 30px; text-align: center;">
                      </div>
                      \t
                    <td class="doubles-col oppnames-col" style="width: 17%; text-align: left;">
                        <div class="doubles-names-stacked">
                            <input type="text" class="row-input" data-id="${m.id}" data-field="opponent1" value="${m.opponent1 || ''}" placeholder="${t('table.opponents')} 1" style="width: 150px; text-align: left;">
                            <input type="text" class="row-input" data-id="${m.id}" data-field="opponent2" value="${m.opponent2 || ''}" placeholder="${t('table.opponents')} 2" style="width: 150px; text-align: left;">
                        </div>
                        \t
                    <td class="doubles-col score-col" style="width: 15%; text-align: right;">
                        <div class="cell-flex justify-end">
                            <input type="text" class="row-input input-score" data-id="${m.id}" data-field="Result" value="${m.Result || ''}" placeholder="${t('table.score')}">
                            <span class="paren">(</span>
                            <input type="text" class="row-input input-dur" data-id="${m.id}" data-field="Duur" value="${m.Duur || ''}" placeholder="${t('table.duration')}">
                            <span class="paren">)</span>
                        </div>
                        \t
                    <td class="doubles-col points-col" style="width: 13%; text-align: center;">
                        <div class="stacked-points-container" title="${getPointsTooltip(m, t)}">
                            <div class="main-points-value"><strong>${m.newTotal || '0'}</strong></div>
                            <div class="extra-points-info scraped-info">${extraPointsDisplay}</div>
                        </div>
                        \t
                    <td class="doubles-col actions-col" style="width: 11%; text-align: right;">
                        <button class="action-btn btn-toggle-discipline" data-id="${m.id}" data-discipline="${m.discipline || 'D'}" title="${t('discipline.tooltip.doubles')}">🔄</button>
                        <button class="action-btn btn-del" data-id="${m.id}" title="${t('button.delete')}">🗑️</button>
                        \t
                `;
            }
            tbody.appendChild(tr);
        } catch (error) {
            console.error('Row render error:', error, m);
        }
    });
}

async function handleInlineEdit(inputEl) {
    try {
        const id = inputEl.getAttribute('data-id');
        const field = inputEl.getAttribute('data-field');
        const value = inputEl.value;
        const { matches } = await loadMatches();
        const updatedMatches = updateMatch(id, field, value, matches);
        await saveMatches(updatedMatches, currentDiscipline);
        showStatusMessage(t('success.saved'), 'info');
        loadAndRender();
    } catch (error) {
        showStatusMessage(error.message || 'Error updating match', 'error');
    }
}

async function handleDeleteMatch(id) {
    if (!confirm(t('confirm.deleteMatch'))) return;
    try {
        const { matches } = await loadMatches();
        const updatedMatches = deleteMatchById(id, matches);
        await saveMatches(updatedMatches, currentDiscipline);
        showStatusMessage(t('success.deleted'), 'info');
        loadAndRender();
    } catch (error) {
        showStatusMessage('Error deleting match', 'error');
    }
}

async function handleToggleDiscipline(id, currentDisciplineType) {
    try {
        const dashboardDiscipline = currentDiscipline;
        const { matches: currentMatches } = await loadMatches();
        const matchIndex = currentMatches.findIndex(m => m.id == id);
        if (matchIndex === -1) return;

        const match = currentMatches[matchIndex];
        const newDisciplineType = currentDisciplineType === 'D' ? 'M' : 'D';
        const newDiscipline = newDisciplineType === 'D' ? 'doubles' : 'mixed';

        match.discipline = newDisciplineType;
        const targetKey = `badminton${newDiscipline.charAt(0).toUpperCase() + newDiscipline.slice(1)}Matches`;
        const expectedLevelKey = `userExpectedLevel${newDiscipline.charAt(0).toUpperCase() + newDiscipline.slice(1)}`;

        chrome.storage.local.get([targetKey, expectedLevelKey], async (result) => {
            const targetMatches = result[targetKey] || [];
            currentMatches.splice(matchIndex, 1);
            targetMatches.push(match);
            const dataToSave = {};
            dataToSave[`badminton${dashboardDiscipline.charAt(0).toUpperCase() + dashboardDiscipline.slice(1)}Matches`] = currentMatches;
            dataToSave[targetKey] = targetMatches;
            if (!result[expectedLevelKey]) dataToSave[expectedLevelKey] = 12;

            chrome.storage.local.set(dataToSave, () => {
                showStatusMessage(`Match moved to ${newDiscipline}`, 'info');
                loadAndRender();
            });
        });
    } catch (error) {
        showStatusMessage('Error toggling discipline', 'error');
    }
}

async function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.toLowerCase().endsWith('.csv')) { showStatusMessage(t('error.csvOnly'), 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showStatusMessage(t('error.fileTooLarge'), 'error'); return; }

    try {
        const content = await readFileAsText(file);
        const result = importFromCSV(content, csvDelimiter, t);
        const { matches } = await loadMatches();
        const updatedMatches = [...matches, ...result.matches];
        await saveMatches(updatedMatches, currentDiscipline);
        let message = `${result.totalImported} ${t('success.imported')}`;
        if (result.totalErrors > 0) message += ` (${result.totalErrors} ${t('error.errorsFound')})`;
        showStatusMessage(message, 'info');
        loadAndRender();
    } catch (error) {
        showStatusMessage(error.message || t('error.importFailed'), 'error');
    }
}

async function handleExport() {
    try {
        const { matches, userExpectedLevel } = await loadMatches();
        if (matches.length === 0) { showStatusMessage(t('error.noData'), 'error'); return; }
        const { history } = processMatchData(matches, userExpectedLevel);
        const csvContent = exportToCSV(history, csvDelimiter, t);
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `badminton_${currentDiscipline}_ranking_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showStatusMessage(t('success.exported'), 'info');
    } catch (error) {
        showStatusMessage(error.message || t('error.exportFailed'), 'error');
    }
}

async function handleClearAll() {
    if (window.clearingInProgress) return;
    window.clearingInProgress = true;
    try {
        if (!confirm(t('confirm.clearAll'))) { window.clearingInProgress = false; return; }
        await clearAllMatches(currentDiscipline);
        showStatusMessage(t('success.cleared'), 'info');
        loadAndRender();
    } catch (error) {
        showStatusMessage('Error clearing data', 'error');
    } finally {
        setTimeout(() => { window.clearingInProgress = false; }, 1000);
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file, 'UTF-8');
    });
}

async function handleScrapeAll() {
    const statusEl = safeElement('statusMsg');
    if (!statusEl) return;

    statusEl.textContent = 'Scraping profiles...';
    statusEl.className = 'status-info';

    try {
        const { badmintonVlaanderenProfile, toernooiProfile } = await chrome.storage.local.get([
            'badmintonVlaanderenProfile', 'toernooiProfile'
        ]);

        const missing = [];
        if (!badmintonVlaanderenProfile) missing.push('Badminton Vlaanderen');
        if (!toernooiProfile) missing.push('Toernooi.nl');

        if (missing.length === 2) {
            showStatusMessage('No profile URLs configured. Please add them in Settings.', 'error');
            return;
        }

        const allMatches = [];
        const results = [];

        if (toernooiProfile) {
            statusEl.textContent = 'Scraping Toernooi.nl...';
            try {
                const html = await fetchWithHeaders(toernooiProfile);
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const tnMatches = await scrapeMatchesFromDocument('toernooi.nl', doc, toernooiProfile);
                allMatches.push(...tnMatches);
                results.push(`Toernooi.nl: ${tnMatches.length} matches found`);
            } catch (e) {
                console.error('Toernooi scrape error:', e);
                results.push(`Toernooi.nl: error - ${e.message}`);
                showStatusMessage(`Toernooi.nl error: ${e.message}`, 'error');
            }
        } else {
            results.push('Toernooi.nl: profile not configured');
        }

        if (badmintonVlaanderenProfile) {
            statusEl.textContent = 'Scraping Badminton Vlaanderen...';
            try {
                const html = await fetchWithHeaders(badmintonVlaanderenProfile);
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const bvMatches = await scrapeMatchesFromDocument('badmintonvlaanderen.be', doc, badmintonVlaanderenProfile);
                allMatches.push(...bvMatches);
                results.push(`Badminton Vlaanderen: ${bvMatches.length} matches found`);
            } catch (e) {
                console.error('BV scrape error:', e);
                results.push(`Badminton Vlaanderen: error - ${e.message}`);
                showStatusMessage(`Badminton Vlaanderen error: ${e.message}`, 'error');
            }
        } else {
            results.push('Badminton Vlaanderen: profile not configured');
        }

        if (allMatches.length === 0) {
            showStatusMessage('No matches found. ' + results.join(' | '), 'info');
            return;
        }

        statusEl.textContent = `Saving ${allMatches.length} matches...`;
        const { total, breakdown } = await importScrapedMatches(allMatches);
        const breakdownStr = [
            breakdown.singles ? `Singles: ${breakdown.singles}` : '',
            breakdown.doubles ? `Doubles: ${breakdown.doubles}` : '',
            breakdown.mixed ? `Mixed: ${breakdown.mixed}` : ''
        ].filter(Boolean).join(', ');

        const summary = `Scraped ${allMatches.length} matches total, saved ${total} new. ${breakdownStr}`;
        showStatusMessage(summary + ' ' + results.join(' | '), 'success');
        await loadAndRender();
    } catch (error) {
        console.error('Scrape all error:', error);
        showStatusMessage(`Scrape all failed: ${error.message}`, 'error');
    }
}

async function fetchWithHeaders(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache'
        }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
}

// -------------------------------------------------------------
// Hover Zoom for Competition vs Tournaments Chart
// -------------------------------------------------------------
function initHoverZoom() {
  const chartBox = document.querySelector('.chart-box:has(#setChart)');
  const canvas = document.getElementById('setChart');
  if (!chartBox || !canvas) return;

  let overlay = document.getElementById('zoomOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'zoomOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);
  }

  let zoomTimeout = null;

  const handleMouseEnter = () => {
    if (currentThirdChartType !== 'competition-tournament') return;
    if (zoomTimeout) clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
      overlay.style.display = 'block';
      chartBox.classList.add('zoomed-container');
      canvas.classList.add('zoomed-canvas');
      zoomTimeout = null;
    }, 2000);
  };

  const handleMouseLeave = () => {
    if (zoomTimeout) {
      clearTimeout(zoomTimeout);
      zoomTimeout = null;
    }
    overlay.style.display = 'none';
    chartBox.classList.remove('zoomed-container');
    canvas.classList.remove('zoomed-canvas');
  };

  chartBox.removeEventListener('mouseenter', handleMouseEnter);
  chartBox.removeEventListener('mouseleave', handleMouseLeave);
  chartBox.addEventListener('mouseenter', handleMouseEnter);
  chartBox.addEventListener('mouseleave', handleMouseLeave);
}