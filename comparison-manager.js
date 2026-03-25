// ============================================
// comparison-manager.js
// ============================================

import { parseUniversalDate } from './utils.js';
import { calculateOptimalRanking, getMatchPoints } from './data-manager.js';
import { scrapeMatchesFromDocument, getDisciplineFromUrl, fuzzyMatchName } from './scraper-utils.js';

const STORAGE_KEY = 'savedComparisonPlayers';

let globalOnDataReady = null;

export function initComparisonListeners(onDataReady) {
    globalOnDataReady = onDataReady;

    const compareBtn = document.getElementById('compareBtn');
    const modal = document.getElementById('compareModal');
    const overlay = document.getElementById('compareOverlay');
    const closeBtn = document.getElementById('closeCompareBtn');
    const saveBtn = document.getElementById('runCompareBtn');

    if (!compareBtn) {
        setTimeout(() => {
            const retryBtn = document.getElementById('compareBtn');
            if (retryBtn) attachButtonListener(retryBtn, modal, overlay);
        }, 300);
        return;
    }

    attachButtonListener(compareBtn, modal, overlay);

    if (closeBtn) closeBtn.addEventListener('click', closeComparisonModal);
    if (overlay) overlay.addEventListener('click', closeComparisonModal);

    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleSaveAction();
        });
    }

    migrateSavedPlayers();
    loadSavedPlayersList();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[STORAGE_KEY]) {
            loadSavedPlayersList();
        }
    });
}

function attachButtonListener(btn, modal, overlay) {
    btn.addEventListener('click', () => {
        if (modal && overlay) {
            modal.classList.add('show');
            overlay.classList.add('show');
            loadSavedPlayersList();
        }
    });
}

function closeComparisonModal() {
    const modal = document.getElementById('compareModal');
    const overlay = document.getElementById('compareOverlay');
    if (modal) modal.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

function migrateSavedPlayers() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        let saved = result[STORAGE_KEY] || [];
        let changed = false;
        saved.forEach(player => {
            if (!player.id) {
                player.id = generateId();
                changed = true;
            }
            if (player.url && !player.toernooiUrl) {
                player.toernooiUrl = player.url;
                player.badmintonUrl = '';
                delete player.url;
                changed = true;
            }
            if (!player.toernooiUrl) player.toernooiUrl = '';
            if (!player.badmintonUrl) player.badmintonUrl = '';
        });
        if (changed) {
            chrome.storage.local.set({ [STORAGE_KEY]: saved }, () => {});
        }
    });
}

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

function savePlayer({ name, toernooiUrl, badmintonUrl }) {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let saved = result[STORAGE_KEY] || [];
            const exists = saved.some(p => p.name.toLowerCase() === name.toLowerCase());
            if (!exists) {
                const newPlayer = {
                    id: generateId(),
                    name: name.trim(),
                    toernooiUrl: toernooiUrl.trim(),
                    badmintonUrl: badmintonUrl.trim()
                };
                saved.push(newPlayer);
                chrome.storage.local.set({ [STORAGE_KEY]: saved }, resolve);
            } else {
                resolve();
            }
        });
    });
}

function deletePlayer(id) {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let saved = result[STORAGE_KEY] || [];
            saved = saved.filter(p => p.id !== id);
            chrome.storage.local.set({ [STORAGE_KEY]: saved }, () => {
                resolve();
            });
        });
    });
}

function updatePlayer(id, updates) {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            let saved = result[STORAGE_KEY] || [];
            const index = saved.findIndex(p => p.id === id);
            if (index !== -1) {
                saved[index] = { ...saved[index], ...updates };
                chrome.storage.local.set({ [STORAGE_KEY]: saved }, resolve);
            } else {
                resolve();
            }
        });
    });
}

async function handleSaveAction() {
    const name = document.getElementById('compareName').value.trim();
    const toernooiUrl = document.getElementById('compareToernooiUrl').value.trim();
    const badmintonUrl = document.getElementById('compareBadmintonUrl').value.trim();
    const statusEl = document.getElementById('compareStatus');

    if (!name) {
        statusEl.textContent = 'Please enter a name';
        statusEl.className = 'status-error';
        return;
    }
    if (!toernooiUrl && !badmintonUrl) {
        statusEl.textContent = 'Please enter at least one profile URL';
        statusEl.className = 'status-error';
        return;
    }

    statusEl.textContent = 'Saving player...';
    statusEl.className = 'status-info';
    const saveBtn = document.getElementById('runCompareBtn');
    if (saveBtn) saveBtn.disabled = true;

    try {
        await savePlayer({ name, toernooiUrl, badmintonUrl });
        statusEl.textContent = 'Player saved!';
        document.getElementById('compareName').value = '';
        document.getElementById('compareToernooiUrl').value = '';
        document.getElementById('compareBadmintonUrl').value = '';
        loadSavedPlayersList();
    } catch (error) {
        console.error('❌ Save error:', error);
        statusEl.textContent = 'Error: ' + error.message;
        statusEl.className = 'status-error';
    } finally {
        if (saveBtn) saveBtn.disabled = false;
        setTimeout(() => {
            if (statusEl.textContent === 'Player saved!') {
                statusEl.textContent = '';
            }
        }, 2000);
    }
}

function populateRivalSelector(savedPlayers) {
    const rivalSelect = document.getElementById('rivalSelector');
    if (!rivalSelect) return;

    const currentValue = rivalSelect.value;

    while (rivalSelect.options.length > 1) {
        rivalSelect.remove(1);
    }

    savedPlayers.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        option.dataset.toernooiUrl = player.toernooiUrl || '';
        option.dataset.badmintonUrl = player.badmintonUrl || '';
        rivalSelect.appendChild(option);
    });

    if (currentValue !== 'me' && savedPlayers.some(p => p.id === currentValue)) {
        rivalSelect.value = currentValue;
    } else {
        rivalSelect.value = 'me';
    }
}

function loadSavedPlayersList() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        const saved = result[STORAGE_KEY] || [];
        const container = document.getElementById('savedPlayersList');
        if (!container) return;

        populateRivalSelector(saved);

        if (saved.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">No saved players yet.</div>';
            return;
        }

        let html = '';
        saved.forEach((player) => {
            html += `
                <div class="saved-player-item" data-id="${escapeHTML(player.id)}">
                    <button class="compare-saved-btn" 
                            data-id="${escapeHTML(player.id)}" 
                            data-name="${escapeHTML(player.name)}"
                            data-toernooi-url="${escapeHTML(player.toernooiUrl || '')}"
                            data-badminton-url="${escapeHTML(player.badmintonUrl || '')}"
                            title="Compare now">
                        📊
                    </button>
                    
                    <div class="player-info-container">
                        <span class="player-name">${escapeHTML(player.name)}</span>
                        
                        <div class="player-edit-icons">
                            <button class="edit-name-btn" 
                                    data-id="${escapeHTML(player.id)}" 
                                    data-name="${escapeHTML(player.name)}"
                                    title="Edit name">
                                ✏️
                            </button>
                            <button class="edit-toernooi-btn" 
                                    data-id="${escapeHTML(player.id)}" 
                                    data-url="${escapeHTML(player.toernooiUrl || '')}"
                                    title="Edit Toernooi.nl URL">
                                <img src="icon-toernooi.png" alt="Toernooi.nl" class="icon-small">
                            </button>
                            <button class="edit-badminton-btn" 
                                    data-id="${escapeHTML(player.id)}" 
                                    data-url="${escapeHTML(player.badmintonUrl || '')}"
                                    title="Edit Badminton Vlaanderen URL">
                                <img src="icon-badmintonvlaanderen.png" alt="Badminton Vlaanderen" class="icon-small">
                            </button>
                        </div>
                    </div>

                    <button class="delete-saved-btn" data-id="${escapeHTML(player.id)}" title="Delete player">
                        🗑️
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;

        container.querySelectorAll('.compare-saved-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.name;
                const toernooiUrl = btn.dataset.toernooiUrl;
                const badmintonUrl = btn.dataset.badmintonUrl;
                const currentDiscipline = document.querySelector('.discipline-icon.active')?.getAttribute('data-discipline') || 'S';
                const disciplineMap = { S: 'singles', D: 'doubles', M: 'mixed' };
                handleCompareAction(
                    { name, toernooiUrl, badmintonUrl },
                    globalOnDataReady,
                    disciplineMap[currentDiscipline] || 'singles'
                );
            });
        });

        container.querySelectorAll('.delete-saved-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Are you sure you want to delete this player?')) {
                    await deletePlayer(id);
                    loadSavedPlayersList();
                }
            });
        });

        container.querySelectorAll('.edit-name-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const currentName = btn.dataset.name;
                const newName = prompt('Edit player name:', currentName);
                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                    await updatePlayer(id, { name: newName.trim() });
                    loadSavedPlayersList();
                }
            });
        });

        container.querySelectorAll('.edit-toernooi-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const currentUrl = btn.dataset.url;
                const newUrl = prompt('Edit Toernooi.nl profile URL:', currentUrl);
                if (newUrl && newUrl.trim() !== '' && newUrl.trim() !== currentUrl) {
                    if ((newUrl.includes('toernooi.nl') || newUrl.includes('tournamentsoftware.com')) && newUrl.includes('/player-profile/')) {
                        await updatePlayer(id, { toernooiUrl: newUrl.trim() });
                        loadSavedPlayersList();
                    } else {
                        alert('Please enter a valid toernooi.nl or tournamentsoftware.com profile URL.');
                    }
                }
            });
        });

        container.querySelectorAll('.edit-badminton-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const currentUrl = btn.dataset.url;
                const newUrl = prompt('Edit Badminton Vlaanderen profile URL:', currentUrl);
                if (newUrl && newUrl.trim() !== '' && newUrl.trim() !== currentUrl) {
                    if (newUrl.includes('badmintonvlaanderen.be') && newUrl.includes('/profile/')) {
                        await updatePlayer(id, { badmintonUrl: newUrl.trim() });
                        loadSavedPlayersList();
                    } else {
                        alert('Please enter a valid badmintonvlaanderen.be profile URL.');
                    }
                }
            });
        });
    });
}

export async function handleCompareAction(player, callback, discipline = 'singles') {
    if (!player || !player.name) {
        console.error('❌ handleCompareAction: invalid player object', player);
        return;
    }
    const statusEl = document.getElementById('compareStatus');
    if (statusEl) {
        statusEl.textContent = 'Fetching comparison data...';
        statusEl.className = 'status-info';
    }

    try {
        const comparisonData = await fetchAndProcessComparison(
            player.toernooiUrl || '',
            player.badmintonUrl || '',
            player.name,
            discipline
        );
        if (statusEl) {
            statusEl.textContent = 'Comparison ready!';
            setTimeout(() => { statusEl.textContent = ''; }, 2000);
        }
        if (typeof callback === 'function') {
            callback(comparisonData);
        }
        closeComparisonModal();
    } catch (error) {
        console.error('❌ Compare error:', error);
        if (statusEl) {
            statusEl.textContent = 'Error: ' + error.message;
            statusEl.className = 'status-error';
        }
    }
}

export async function fetchAndProcessComparison(toernooiUrl, badmintonUrl, playerName, discipline = 'singles') {
    const allMatches = [];

    if (toernooiUrl) {
        try {
            const response = await fetch(toernooiUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const virtualDoc = parser.parseFromString(html, 'text/html');
                const matches = await scrapeMatchesFromDocument('toernooi.nl', virtualDoc, toernooiUrl, playerName);
                allMatches.push(...matches);
            } else {
                console.warn(`Toernooi.nl fetch failed: ${response.status}`);
            }
        } catch (e) {
            console.warn('Error fetching Toernooi.nl:', e);
        }
    }

    if (badmintonUrl) {
        try {
            const response = await fetch(badmintonUrl, {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const virtualDoc = parser.parseFromString(html, 'text/html');
                const matches = await scrapeMatchesFromDocument('badmintonvlaanderen.be', virtualDoc, badmintonUrl, playerName);
                allMatches.push(...matches);
            } else {
                console.warn(`Badminton Vlaanderen fetch failed: ${response.status}`);
            }
        } catch (e) {
            console.warn('Error fetching Badminton Vlaanderen:', e);
        }
    }

    if (allMatches.length === 0) {
        throw new Error('No matches found from the provided URLs.');
    }

    const discMap = { singles: 'S', doubles: 'D', mixed: 'M' };
    const targetDisc = discMap[discipline] || 'S';
    const filteredMatches = allMatches.filter(m => m.discipline === targetDisc);

    const history = buildHistoryFromMatches(filteredMatches);
    return { name: playerName, history };
}

function buildHistoryFromMatches(matches) {
    if (!matches.length) return [];

    const sorted = [...matches].sort((a, b) => {
        const da = parseUniversalDate(a.Datum);
        const db = parseUniversalDate(b.Datum);
        return da - db;
    });

    const history = [];
    const allMatchesSoFar = [];

    for (let i = 0; i < sorted.length; i++) {
        const currentMatch = sorted[i];
        allMatchesSoFar.push(currentMatch);

        const calcDate = parseUniversalDate(currentMatch.Datum);
        const { points: newTotal } = calculateOptimalRanking(allMatchesSoFar, calcDate);

        const processed = {
            ...currentMatch,
            newTotal: newTotal.toFixed(1),
        };
        history.push(processed);
    }

    return history;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}