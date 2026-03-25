// data-manager.js

import { POINTS_TABLE, PROMOTION_THRESHOLDS, parseUniversalDate, calculateShortResultFromScore } from './utils.js';
import { fuzzyMatchName, normalizeForComparison, setsEqual, findDuplicateIndex } from './scraper-utils.js';

const DEBUG_RANKING = false;

let currentData = [];
let filteredData = [];

export function getMatchDateTime(match) {
    const date = parseUniversalDate(match.Datum);
    if (isNaN(date.getTime())) return date;
    const timeStr = match.scrapedTime || match.Duur || '';
    if (timeStr) {
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            date.setHours(hours, minutes, 0, 0);
        } else {
            const minutes = parseInt(timeStr, 10);
            if (!isNaN(minutes) && minutes >= 0 && minutes < 1440) {
                date.setHours(0, minutes, 0, 0);
            }
        }
    }
    return date;
}

function isValidMatch(match) {
    if (match.excludeFromRanking) return false;

    const discipline = match.discipline || 'S';
    if (discipline === 'S') {
        const myRank = parseInt(match.Jij) || 12;
        const oppRank = parseInt(match.Hij) || 12;

        if (match.isWin) return true;

        if (oppRank > myRank) {
            return true;
        } else if (oppRank < myRank) {
            return (myRank - oppRank) <= 1;
        } else {
            return true;
        }
    } else {
        const myRank = parseInt(match.Jij) || 12;
        const teammateRank = parseInt(match.teammateLevel) || 12;
        const opp1Rank = parseInt(match.opponent1Level) || 12;
        const opp2Rank = parseInt(match.opponent2Level) || 12;
        const ourSum = myRank + teammateRank;
        const oppSum = opp1Rank + opp2Rank;

        if (match.isWin) return true;

        if (oppSum > ourSum) {
            return true;
        } else if (oppSum < ourSum) {
            return (ourSum - oppSum) <= 1;
        } else {
            return true;
        }
    }
}

function isWinMatch(match) {
    return match.isWin === true;
}

function getMatchPoints(match) {
    if (!match.isWin) return 0;
    const discipline = match.discipline || 'S';
    if (discipline === 'S') {
        const oppLevel = parseInt(match.Hij) || 12;
        return POINTS_TABLE[oppLevel] || 0;
    } else {
        const opp1Level = parseInt(match.opponent1Level) || 12;
        const opp2Level = parseInt(match.opponent2Level) || 12;
        const points1 = POINTS_TABLE[opp1Level] || 0;
        const points2 = POINTS_TABLE[opp2Level] || 0;
        return (points1 + points2) / 2;
    }
}

function getMatchLevelsString(match) {
    const discipline = match.discipline || 'S';
    if (discipline === 'S') {
        return `My: ${match.Jij || 12}, Opp: ${match.Hij || 12}`;
    } else {
        return `My: ${match.Jij || 12}, Teammate: ${match.teammateLevel || 12}, Opp1: ${match.opponent1Level || 12}, Opp2: ${match.opponent2Level || 12}`;
    }
}

function parseTimeString(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const trimmedTime = timeStr.trim();
    if (!trimmedTime) return 0;
    const match = trimmedTime.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return hours * 60 + minutes;
        }
    }
    if (trimmedTime.match(/^\d{1,2}[.:]\d{2}$/)) {
        const parts = trimmedTime.split(/[.:]/);
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 60 + minutes;
    }
    const num = parseInt(trimmedTime, 10);
    if (!isNaN(num) && num >= 0 && num <= 1440) {
        return num;
    }
    return 0;
}

export function sortMatchesChronologically(matches) {
    if (!matches || matches.length === 0) return [];
    return [...matches].sort((a, b) => {
        try {
            const dateA = getMatchDateTime(a);
            const dateB = getMatchDateTime(b);
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            return dateA.getTime() - dateB.getTime();
        } catch (e) {
            return 0;
        }
    });
}

async function loadAllMatches() {
    return new Promise((resolve, reject) => {
        const disciplineKeys = [
            'badmintonSinglesMatches',
            'badmintonDoublesMatches',
            'badmintonMixedMatches'
        ];
        chrome.storage.local.get(disciplineKeys, (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            const allMatches = [];
            disciplineKeys.forEach(key => {
                const matches = result[key] || [];
                let discipline = 'S';
                if (key.includes('Doubles')) discipline = 'D';
                else if (key.includes('Mixed')) discipline = 'M';
                matches.forEach(match => {
                    if (!match.discipline) {
                        match.discipline = discipline;
                    }
                    if (!match.id) {
                        match.id = Date.now() + Math.random();
                    }
                    allMatches.push(match);
                });
            });
            resolve(allMatches);
        });
    });
}

export function calculateOptimalRanking(matches, calculationDate = new Date()) {
    if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Calculation date: ${calculationDate.toISOString()}`);
    const oneYearAgo = new Date(calculationDate);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] One year ago: ${oneYearAgo.toISOString()}`);

    const validMatches = matches.filter(m => {
        const d = getMatchDateTime(m);
        const inWindow = d >= oneYearAgo && d <= calculationDate;
        const valid = isValidMatch(m);
        return inWindow && valid;
    });

    if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Valid matches in window: ${validMatches.length}`);

    if (validMatches.length === 0) {
        return { points: 0, includedIds: new Set() };
    }

    const sorted = [...validMatches].sort((a, b) => {
        return getMatchDateTime(b) - getMatchDateTime(a);
    });

    const recent20 = sorted.slice(0, 20);
    if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Most recent 20 matches count: ${recent20.length}`);

    if (recent20.length <= 7) {
        const sum = recent20.reduce((acc, m) => acc + getMatchPoints(m), 0);
        if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] ≤7 matches, sum=${sum}, divisor=7, avg=${sum/7}`);
        return { points: sum / 7, includedIds: new Set(recent20.map(m => m.id)) };
    }

    const losses = recent20.filter(m => !isWinMatch(m));
    const wins = recent20.filter(isWinMatch).map(m => ({
        ...m,
        points: getMatchPoints(m)
    }));
    wins.sort((a, b) => b.points - a.points);
    if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Losses: ${losses.length}, Wins: ${wins.length}`);

    const combined = [...losses, ...wins];

    let cumulative = 0;
    let count = 0;
    let prevAvg = 0;
    const includedIds = new Set();

    for (const m of combined) {
        const points = m.points !== undefined ? m.points : getMatchPoints(m);
        const newCumulative = cumulative + points;
        const newCount = count + 1;
        const newAvg = newCumulative / newCount;

        if (count > 0 && newAvg < prevAvg) {
            if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Stopping at match ${m.id} because newAvg ${newAvg.toFixed(2)} < prevAvg ${prevAvg.toFixed(2)}`);
            break;
        }

        if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Adding match ${m.id} (${isWinMatch(m) ? 'win' : 'loss'}) points=${points}, cumulative=${newCumulative}, count=${newCount}, avg=${newAvg.toFixed(2)}`);
        cumulative = newCumulative;
        count = newCount;
        prevAvg = newAvg;
        includedIds.add(m.id);
    }

    const finalAvg = cumulative / count;
    if (DEBUG_RANKING) console.log(`[calculateOptimalRanking] Final average: ${finalAvg.toFixed(2)} using ${count} matches.`);
    return { points: finalAvg, includedIds };
}

export function calculateRankingPointsForMatches(matches, calculationDate = new Date()) {
    return calculateOptimalRanking(matches, calculationDate);
}

export function getRankingProgressionForDate(matches, calculationDate) {
    const oneYearAgo = new Date(calculationDate);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const validMatches = matches.filter(m => {
        const d = getMatchDateTime(m);
        return d >= oneYearAgo && d <= calculationDate && isValidMatch(m);
    });

    if (validMatches.length === 0) {
        return [];
    }

    const sortedDesc = [...validMatches].sort((a, b) => getMatchDateTime(b) - getMatchDateTime(a));
    const recent20 = sortedDesc.slice(0, 20);

    if (recent20.length <= 7) {
        const losses = recent20.filter(m => !isWinMatch(m));
        const wins = recent20.filter(isWinMatch).map(m => ({
            match: m,
            points: getMatchPoints(m)
        }));
        wins.sort((a, b) => b.points - a.points);

        const combined = [
            ...losses.map(m => ({ match: m, points: getMatchPoints(m) })),
            ...wins
        ];

        const progression = [];
        let cumulative = 0;
        for (const item of combined) {
            cumulative += item.points;
            progression.push({
                match: item.match,
                points: item.points,
                runningAvg: cumulative / 7 
            });
        }
        return progression;
    }

    const losses = recent20.filter(m => !isWinMatch(m));
    const wins = recent20.filter(isWinMatch).map(m => ({
        match: m,
        points: getMatchPoints(m)
    }));
    wins.sort((a, b) => b.points - a.points);

    const combined = [
        ...losses.map(m => ({ match: m, points: getMatchPoints(m) })),
        ...wins
    ];

    const progression = [];
    let cumulative = 0;
    let count = 0;
    let prevAvg = 0;

    for (const item of combined) {
        const points = item.points;
        const newCumulative = cumulative + points;
        const newCount = count + 1;
        const newAvg = newCumulative / newCount;

        if (count > 0 && newAvg < prevAvg) {
            break;
        }

        cumulative = newCumulative;
        count = newCount;
        prevAvg = newAvg;
        progression.push({
            match: item.match,
            points: points,
            runningAvg: newAvg
        });
    }

    return progression;
}

export function processMatchData(matches) {
    const chronologicallySortedMatches = sortMatchesChronologically(matches);

    chronologicallySortedMatches.forEach(m => {
        if (m.Result && !m.ResultShort) {
            m.ResultShort = calculateShortResultFromScore(m.Result);
        }
        if (m.isWin === undefined) {
            const parts = (m.ResultShort || '0-0').split('-');
            m.isWin = parseInt(parts[0]) > parseInt(parts[1]);
        }
    });

    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const history = [];
    const allMatchesSoFar = [];

    for (let i = 0; i < chronologicallySortedMatches.length; i++) {
        const currentMatch = chronologicallySortedMatches[i];
        allMatchesSoFar.push(currentMatch);

        const calcDate = getMatchDateTime(currentMatch);
        const { points: newTotal, includedIds } = calculateRankingPointsForMatches(allMatchesSoFar, calcDate);

        const includedInRanking = includedIds.has(currentMatch.id);
        const ptsReceived = getMatchPoints(currentMatch);

        const processed = {
            ...currentMatch,
            newTotal: newTotal.toFixed(1),
            ptsReceived,
            includedInRanking,
            rankingContributed: includedInRanking ? ptsReceived : 0,
            isValid: isValidMatch(currentMatch),
            isRecent: getMatchDateTime(currentMatch) >= oneYearAgo
        };

        history.push(processed);
    }

    const currentPoints = history.length > 0 ? parseFloat(history[history.length - 1].newTotal) : 0;

    let expectedLevel = 12;
    for (const threshold of PROMOTION_THRESHOLDS) {
        if (currentPoints >= threshold.pts) {
            expectedLevel = threshold.lvl;
        } else {
            break;
        }
    }

    const currentValidMatchesWindow = history
        .filter(m => getMatchDateTime(m) >= oneYearAgo && isValidMatch(m))
        .slice(-20);

    const stats = calculateStatistics(history, oneYearAgo);

    currentData = history;
    filteredData = [...history];

    return {
        history,
        filteredData,
        currentPoints,
        expectedLevel,
        currentValidMatchesWindow,
        stats
    };
}

function calculateStatistics(data, oneYearAgo) {
    const totalMatches = data.length;
    const recentMatches = data.filter(h => h.isRecent).length;
    const wins = data.filter(h => h.isWin).length;
    const losses = totalMatches - wins;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
    return {
        totalMatches,
        recentMatches,
        wins,
        losses,
        winRate
    };
}

export function extractUniqueYears(data) {
    const years = new Set();
    data.forEach(m => {
        try {
            const d = parseUniversalDate(m.Datum);
            if (!isNaN(d.getFullYear())) {
                const dateStr = m.Datum;
                let year;
                const dateObj = parseUniversalDate(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    year = dateObj.getFullYear();
                } else {
                    const yearStr = dateStr.split('/')[2];
                    if (yearStr && yearStr.length === 2) {
                        const currentYear = new Date().getFullYear();
                        const century = Math.floor(currentYear / 100) * 100;
                        const twoDigitYear = parseInt(yearStr);
                        year = century + twoDigitYear;
                        if (year > currentYear + 50) {
                            year -= 100;
                        }
                    } else if (yearStr && yearStr.length === 4) {
                        year = parseInt(yearStr);
                    } else {
                        year = d.getFullYear();
                    }
                }
                if (year) years.add(year);
            }
        } catch (e) {}
    });
    return Array.from(years).sort((a, b) => b - a);
}

export function getFilterValues(data) {
    const years = new Set();
    const myLvls = new Set();
    const oppLvls = new Set();
    const players = new Set();

    data.forEach(m => {
        try {
            const d = parseUniversalDate(m.Datum);
            if (!isNaN(d.getFullYear())) {
                const dateStr = m.Datum;
                let year;
                const dateObj = parseUniversalDate(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    year = dateObj.getFullYear();
                } else {
                    const yearStr = dateStr.split('/')[2];
                    if (yearStr && yearStr.length === 2) {
                        const currentYear = new Date().getFullYear();
                        const century = Math.floor(currentYear / 100) * 100;
                        const twoDigitYear = parseInt(yearStr);
                        year = century + twoDigitYear;
                        if (year > currentYear + 50) {
                            year -= 100;
                        }
                    } else {
                        year = d.getFullYear();
                    }
                }
                if (year) years.add(year);
            }
            if (m.Jij) myLvls.add(m.Jij);
            const discipline = m.discipline || 'S';
            if (discipline === 'S') {
                if (m.Hij) oppLvls.add(m.Hij);
            } else {
                const opp1 = parseInt(m.opponent1Level) || 12;
                const opp2 = parseInt(m.opponent2Level) || 12;
                const avgOppLevel = Math.round((opp1 + opp2) / 2);
                oppLvls.add(avgOppLevel);
            }
            if (discipline === 'S') {
                if (m.Tegenstander && m.Tegenstander.trim()) players.add(m.Tegenstander.trim());
            } else {
                if (m.teammateName && m.teammateName.trim()) players.add(m.teammateName.trim());
                if (m.opponent1 && m.opponent1.trim()) players.add(m.opponent1.trim());
                if (m.opponent2 && m.opponent2.trim()) players.add(m.opponent2.trim());
            }
        } catch (e) {}
    });

    return {
        years: Array.from(years).sort((a, b) => b - a),
        myLvls: Array.from(myLvls).sort((a, b) => a - b),
        oppLvls: Array.from(oppLvls).sort((a, b) => a - b),
        players: Array.from(players).sort()
    };
}

export function applyDataFilters(data, filters) {
    return data.filter(m => {
        try {
            const dateObj = parseUniversalDate(m.Datum);
            let year;
            if (!isNaN(dateObj.getTime())) {
                year = dateObj.getFullYear();
            } else {
                const yearStr = m.Datum.split('/')[2];
                if (yearStr && yearStr.length === 2) {
                    const currentYear = new Date().getFullYear();
                    const century = Math.floor(currentYear / 100) * 100;
                    const twoDigitYear = parseInt(yearStr);
                    year = century + twoDigitYear;
                    if (year > currentYear + 50) {
                        year -= 100;
                    }
                } else {
                    year = dateObj.getFullYear();
                }
            }
            const discipline = m.discipline || 'S';
            if (discipline === 'S') {
                let yearMatch = true;
                if (filters.year && filters.year !== 'all') {
                    if (year) {
                        yearMatch = year.toString() === filters.year;
                    } else {
                        yearMatch = true;
                    }
                }
                let typeMatch = true;
                if (filters.type && filters.type.trim() !== '') {
                    const searchStr = filters.type.toLowerCase().trim();
                    if (m.Fase && m.Fase.trim() !== '') {
                        typeMatch = m.Fase.toLowerCase().includes(searchStr);
                    } else {
                        typeMatch = true;
                    }
                }
                let myMatch = true;
                if (filters.myLvl && filters.myLvl !== 'all') {
                    if (m.Jij) {
                        myMatch = m.Jij.toString() === filters.myLvl;
                    } else {
                        myMatch = true;
                    }
                }
                let oppMatch = true;
                if (filters.oppLvl && filters.oppLvl !== 'all') {
                    if (m.Hij) {
                        oppMatch = m.Hij.toString() === filters.oppLvl;
                    } else {
                        oppMatch = true;
                    }
                }
                let playerMatch = true;
                if (filters.opponent && filters.opponent.trim() !== '') {
                    const searchStr = filters.opponent.toLowerCase().trim();
                    if (m.Tegenstander && m.Tegenstander.trim() !== '') {
                        playerMatch = m.Tegenstander.toLowerCase().includes(searchStr);
                    } else {
                        playerMatch = true;
                    }
                }
                let resMatch = true;
                if (filters.result && filters.result !== 'all') {
                    if (m.isWin !== undefined) {
                        if (filters.result === 'Win') resMatch = m.isWin;
                        if (filters.result === 'Loss') resMatch = !m.isWin;
                    } else {
                        resMatch = true;
                    }
                }
                let validMatch = true;
                if (filters.valid && filters.valid === 'valid') {
                    if (m.isRecent !== undefined && m.isValid !== undefined) {
                        validMatch = (m.isRecent && m.isValid);
                    } else {
                        validMatch = true;
                    }
                }
                return yearMatch && typeMatch && myMatch && oppMatch && playerMatch && resMatch && validMatch;
            } else {
                let yearMatch = true;
                if (filters.year && filters.year !== 'all') {
                    if (year) {
                        yearMatch = year.toString() === filters.year;
                    } else {
                        yearMatch = true;
                    }
                }
                let typeMatch = true;
                if (filters.type && filters.type.trim() !== '') {
                    const searchStr = filters.type.toLowerCase().trim();
                    if (m.Fase && m.Fase.trim() !== '') {
                        typeMatch = m.Fase.toLowerCase().includes(searchStr);
                    } else {
                        typeMatch = true;
                    }
                }
                let teamMatch = true;
                if (filters.team && filters.team.trim() !== '') {
                    const searchStr = filters.team.toLowerCase().trim();
                    let found = false;
                    if (m.teammateName && m.teammateName.trim() !== '') {
                        found = m.teammateName.toLowerCase().includes(searchStr);
                    }
                    if (!found && m.Tegenstander && m.Tegenstander.trim() !== '') {
                        found = m.Tegenstander.toLowerCase().includes(searchStr);
                    }
                    teamMatch = (found || (!m.teammateName && !m.Tegenstander));
                }
                let ourLevelsMatch = true;
                if (filters.ourLevels && filters.ourLevels !== 'all') {
                    const targetLevel = parseInt(filters.ourLevels);
                    let found = false;
                    if (m.Jij) {
                        found = (parseInt(m.Jij) === targetLevel);
                    }
                    if (!found && m.teammateLevel) {
                        found = (parseInt(m.teammateLevel) === targetLevel);
                    }
                    ourLevelsMatch = (found || (!m.Jij && !m.teammateLevel));
                }
                let oppLevelsMatch = true;
                if (filters.oppLevels && filters.oppLevels !== 'all') {
                    const targetLevel = parseInt(filters.oppLevels);
                    let found = false;
                    if (m.opponent1Level) {
                        found = (parseInt(m.opponent1Level) === targetLevel);
                    }
                    if (!found && m.opponent2Level) {
                        found = (parseInt(m.opponent2Level) === targetLevel);
                    }
                    oppLevelsMatch = (found || (!m.opponent1Level && !m.opponent2Level));
                }
                let opponentsMatch = true;
                if (filters.opponents && filters.opponents.trim() !== '') {
                    const searchStr = filters.opponents.toLowerCase().trim();
                    let found = false;
                    if (m.opponent1 && m.opponent1.trim() !== '') {
                        found = m.opponent1.toLowerCase().includes(searchStr);
                    }
                    if (!found && m.opponent2 && m.opponent2.trim() !== '') {
                        found = m.opponent2.toLowerCase().includes(searchStr);
                    }
                    if (!found && m.Tegenstander && m.Tegenstander.trim() !== '') {
                        found = m.Tegenstander.toLowerCase().includes(searchStr);
                    }
                    opponentsMatch = (found || (!m.opponent1 && !m.opponent2 && !m.Tegenstander));
                }
                let resMatch = true;
                if (filters.result && filters.result !== 'all') {
                    if (m.isWin !== undefined) {
                        if (filters.result === 'Win') resMatch = m.isWin;
                        if (filters.result === 'Loss') resMatch = !m.isWin;
                    } else {
                        resMatch = true;
                    }
                }
                let validMatch = true;
                if (filters.valid && filters.valid === 'valid') {
                    if (m.isRecent !== undefined && m.isValid !== undefined) {
                        validMatch = (m.isRecent && m.isValid);
                    } else {
                        validMatch = true;
                    }
                }
                return yearMatch && typeMatch && teamMatch && ourLevelsMatch &&
                       oppLevelsMatch && opponentsMatch && resMatch && validMatch;
            }
        } catch (error) {
            return true;
        }
    });
}

function hasValidLevels(match) {
    if (match.discipline === 'S') {
        return (match.Jij && match.Jij !== 12) || (match.Hij && match.Hij !== 12);
    } else {
        return (match.Jij && match.Jij !== 12) ||
               (match.teammateLevel && match.teammateLevel !== 12) ||
               (match.opponent1Level && match.opponent1Level !== 12) ||
               (match.opponent2Level && match.opponent2Level !== 12);
    }
}

function mergeMatch(existing, scraped) {
    let modified = false;
    const merged = { ...existing };

    if (scraped.currentPlayerName && existing.teammateName) {
        const isExistingTeammateCurrentPlayer = fuzzyMatchName(existing.teammateName, scraped.currentPlayerName);
        if (isExistingTeammateCurrentPlayer) {
            merged.teammateName = existing.JijName || existing.teammateName;
            merged.Jij = existing.teammateLevel || existing.Jij;
            merged.teammateLevel = existing.Jij || existing.teammateLevel;
            if (scraped.teammateName) {
                merged.teammateName = scraped.teammateName;
            }
            if (scraped.Jij) {
                merged.Jij = scraped.Jij;
            }
            if (scraped.teammateLevel) {
                merged.teammateLevel = scraped.teammateLevel;
            }
            modified = true;
        }
    }

    const fieldsToUpdate = [
        'scrapedTime', 'Time', 'Duur', 'typeExtra',
        'opponent1', 'opponent2',
        'opponent1Level', 'opponent2Level',
        'Fase', 'Hij', 'excludeFromRanking'
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

export async function importScrapedMatches(scrapedMatches) {
    if (!scrapedMatches || scrapedMatches.length === 0) return { total: 0, breakdown: {} };

    const keys = {
        singles: 'badmintonSinglesMatches',
        doubles: 'badmintonDoublesMatches',
        mixed: 'badmintonMixedMatches'
    };
    const stored = await chrome.storage.local.get([keys.singles, keys.doubles, keys.mixed]);
    const existing = {
        singles: stored[keys.singles] || [],
        doubles: stored[keys.doubles] || [],
        mixed: stored[keys.mixed] || []
    };

    const updated = {
        singles: [...existing.singles],
        doubles: [...existing.doubles],
        mixed: [...existing.mixed]
    };

    let newCount = 0;

    scrapedMatches.forEach(scraped => {
        const targetDisc = scraped.discipline === 'S' ? 'singles' :
                          (scraped.discipline === 'D' ? 'doubles' : 'mixed');

        let found = false;
        for (const disc of ['singles', 'doubles', 'mixed']) {
            const index = findDuplicateIndex(updated[disc], scraped);
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
    if (JSON.stringify(updated.singles) !== JSON.stringify(existing.singles)) {
        toSave[keys.singles] = updated.singles;
    }
    if (JSON.stringify(updated.doubles) !== JSON.stringify(existing.doubles)) {
        toSave[keys.doubles] = updated.doubles;
    }
    if (JSON.stringify(updated.mixed) !== JSON.stringify(existing.mixed)) {
        toSave[keys.mixed] = updated.mixed;
    }

    if (Object.keys(toSave).length > 0) {
        await chrome.storage.local.set(toSave);
    }

    const savedCounts = {
        singles: updated.singles.length - existing.singles.length,
        doubles: updated.doubles.length - existing.doubles.length,
        mixed: updated.mixed.length - existing.mixed.length
    };
    const total = savedCounts.singles + savedCounts.doubles + savedCounts.mixed;
    const breakdown = Object.entries(savedCounts)
        .filter(([_, count]) => count > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

    return { total, breakdown };
}

export function importFromCSV(content, delimiter, t, targetDiscipline = 'singles') {
}

export function exportToCSV(data, delimiter, t) {
}

export function updateMatch(id, field, value, matches) {
}

export function deleteMatchById(id, matches) {
    return matches.filter(m => m.id != id);
}

export function saveMatches(matches, discipline = 'singles') {
    return new Promise((resolve, reject) => {
        const storageKey = `badminton${discipline.charAt(0).toUpperCase() + discipline.slice(1)}Matches`;
        chrome.storage.local.set({ [storageKey]: matches }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

export function loadMatches() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['currentDiscipline'], (disciplineResult) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            const currentDiscipline = disciplineResult.currentDiscipline || 'singles';
            const storageKey = `badminton${currentDiscipline.charAt(0).toUpperCase() + currentDiscipline.slice(1)}Matches`;
            chrome.storage.local.get([storageKey], (dataResult) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                const matches = dataResult[storageKey] || [];
                matches.forEach(match => {
                    if (!match.discipline) {
                        if (currentDiscipline === 'doubles') match.discipline = 'D';
                        else if (currentDiscipline === 'mixed') match.discipline = 'M';
                        else match.discipline = 'S';
                    }
                    if (!match.scrapedTime) match.scrapedTime = '';
                    if (!match.typeExtra) match.typeExtra = '';
                    if (!match.excludeFromRanking) match.excludeFromRanking = false;
                });
                resolve({
                    matches,
                    currentDiscipline
                });
            });
        });
    });
}

export function getCurrentDiscipline() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['currentDiscipline'], (res) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(res.currentDiscipline || 'singles');
            }
        });
    });
}

export function switchDiscipline(discipline) {
    return new Promise((resolve, reject) => {
        if (!['singles', 'doubles', 'mixed'].includes(discipline)) {
            reject(new Error('Invalid discipline'));
            return;
        }
        chrome.storage.local.set({ currentDiscipline: discipline }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

export function clearAllMatches(discipline = 'singles') {
    return new Promise((resolve, reject) => {
        const storageKey = `badminton${discipline.charAt(0).toUpperCase() + discipline.slice(1)}Matches`;
        chrome.storage.local.set({ [storageKey]: [] }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

export async function clearAllMatchesAllDisciplines() {
    const disciplines = ['singles', 'doubles', 'mixed'];
    const keys = disciplines.map(d => `badminton${d.charAt(0).toUpperCase() + d.slice(1)}Matches`);
    const update = {};
    keys.forEach(key => { update[key] = []; });
    await new Promise(resolve => chrome.storage.local.set(update, resolve));
}

export function getDataState() {
    return {
        currentData,
        filteredData
    };
}

export function updateFilteredData(data) {
    filteredData = data;
}

export async function migrateOldData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['badmintonMatches', 'dataMigrated'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            if (result.dataMigrated) {
                resolve(false);
                return;
            }
            if (result.badmintonMatches && result.badmintonMatches.length > 0) {
                const migratedMatches = result.badmintonMatches.map(match => ({
                    ...match,
                    scrapedTime: match.scrapedTime || '',
                    typeExtra: match.typeExtra || '',
                    excludeFromRanking: match.excludeFromRanking || false
                }));
                const data = {
                    badmintonSinglesMatches: migratedMatches,
                    currentDiscipline: 'singles',
                    dataMigrated: true
                };
                chrome.storage.local.remove('badmintonMatches', () => {
                    chrome.storage.local.set(data, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(true);
                        }
                    });
                });
            } else {
                chrome.storage.local.set({ dataMigrated: true }, () => {
                    resolve(false);
                });
            }
        });
    });
}

export { getMatchPoints };