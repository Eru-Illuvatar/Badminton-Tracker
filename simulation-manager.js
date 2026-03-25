import { POINTS_TABLE, PROMOTION_THRESHOLDS, t, parseUniversalDate, formatDate } from './utils.js';
import { calculateOptimalRanking } from './data-manager.js';

let currentRankingPoints = 0;
let currentValidMatchesWindow = [];
let userExpectedLevel = null;
let allMatches = [];

export function initSimulationState(rankingPoints, validMatchesWindow, expectedLevel, matches) {
    currentRankingPoints = rankingPoints;
    currentValidMatchesWindow = validMatchesWindow || [];
    userExpectedLevel = expectedLevel || 12;
    allMatches = matches || [];
}

export function getSimulationState() {
    return {
        currentRankingPoints,
        currentValidMatchesWindow,
        userExpectedLevel
    };
}

export function openQuickSimulator() {
    try {
        const modal = document.getElementById('quickSimulatorModal');
        const overlay = document.getElementById('quickSimulatorOverlay');
        if (modal && overlay) {
            modal.style.display = 'block';
            overlay.style.display = 'block';
            
            const expectedLevel = parseInt(document.getElementById('expectedLevelInput').value) || 12;
            document.getElementById('simulatorOppLevel1').value = expectedLevel;
            
            document.getElementById('simulatorRow2').classList.add('hidden');
            document.getElementById('simulatorRow3').classList.add('hidden');
            document.getElementById('removeRow1').classList.add('hidden');
            document.getElementById('addRowBtn').classList.remove('hidden');
            
            document.getElementById('simulatorWins1').value = '1';
            document.getElementById('simulatorWins2').value = '1';
            document.getElementById('simulatorWins3').value = '1';
            document.getElementById('simulatorOppLevel2').value = expectedLevel;
            document.getElementById('simulatorOppLevel3').value = expectedLevel;
            
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const dateInput = document.getElementById('simulationStartDate');
            if (dateInput) {
                dateInput.value = `${yyyy}-${mm}-${dd}`;
            }
            
            document.getElementById('simulatorResult').classList.add('hidden');
        }
    } catch (error) {
        console.error('Error opening quick simulator:', error);
        throw new Error('Error opening simulator');
    }
}

export function closeQuickSimulator() {
    const modal = document.getElementById('quickSimulatorModal');
    const overlay = document.getElementById('quickSimulatorOverlay');
    if (modal && overlay) {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }
}

export function addSimulatorRow() {
    const row2 = document.getElementById('simulatorRow2');
    const row3 = document.getElementById('simulatorRow3');
    const addBtn = document.getElementById('addRowBtn');
    
    if (row2.classList.contains('hidden')) {
        row2.classList.remove('hidden');
        document.getElementById('removeRow1').classList.remove('hidden');
    } else if (row3.classList.contains('hidden')) {
        row3.classList.remove('hidden');
        addBtn.classList.add('hidden');
    }
}

export function removeSimulatorRow(rowNumber) {
    if (rowNumber === 1) {
        document.getElementById('simulatorWins1').value = '1';
    } else if (rowNumber === 2) {
        const row2 = document.getElementById('simulatorRow2');
        const row3 = document.getElementById('simulatorRow3');
        const addBtn = document.getElementById('addRowBtn');
        
        if (!row3.classList.contains('hidden')) {
            document.getElementById('simulatorWins2').value = document.getElementById('simulatorWins3').value;
            document.getElementById('simulatorOppLevel2').value = document.getElementById('simulatorOppLevel3').value;
            
            document.getElementById('simulatorWins3').value = '1';
            document.getElementById('simulatorOppLevel3').value = '12';
            
            row3.classList.add('hidden');
            addBtn.classList.remove('hidden');
        } else {
            row2.classList.add('hidden');
            document.getElementById('removeRow1').classList.add('hidden');
            addBtn.classList.remove('hidden');
        }
    } else if (rowNumber === 3) {
        const row3 = document.getElementById('simulatorRow3');
        const addBtn = document.getElementById('addRowBtn');
        
        row3.classList.add('hidden');
        addBtn.classList.remove('hidden');
    }
}

function getNextSunday(date) {
    const d = new Date(date);
    d.setDate(d.getDate() + (7 - d.getDay()));
    return d;
}

function generateMockMatches(simulations, startDate, spacing) {
    const mockMatches = [];
    let winIndex = 0;
    const spacingDays = spacing === 'same' ? 0
                      : spacing === 'sunday' ? 7
                      : spacing === 'weekly' ? 7
                      : parseInt(spacing) || 7;

    simulations.forEach((sim, simIdx) => {
        for (let i = 0; i < sim.wins; i++) {
            let matchDate;
            if (spacing === 'sunday') {
                if (i === 0) {
                    if (startDate.getDay() !== 0) {
                        matchDate = getNextSunday(startDate);
                    } else {
                        matchDate = new Date(startDate);
                    }
                } else {
                    const prevDate = mockMatches[mockMatches.length - 1].DatumObj;
                    matchDate = new Date(prevDate);
                    matchDate.setDate(prevDate.getDate() + 7);
                }
            } else {
                matchDate = new Date(startDate);
                matchDate.setDate(startDate.getDate() + winIndex * spacingDays);
            }
            
            mockMatches.push({
                id: `sim-${Date.now()}-${simIdx}-${i}`,
                Datum: formatDate(matchDate),
                DatumObj: matchDate,
                Jij: 12,
                Hij: sim.level,
                Result: '21-0 21-0',
                ResultShort: '2-0',
                isWin: true,
                excludeFromRanking: false,
                source: 'simulation',
                discipline: 'S'
            });
            winIndex++;
        }
    });

    mockMatches.sort((a, b) => a.DatumObj - b.DatumObj);
    mockMatches.forEach(m => delete m.DatumObj);
    return mockMatches;
}

export function simulateMultipleWins(currentPoints, simulations, allMatches, startDate = new Date(), spacing = 'weekly') {
    const mockMatches = generateMockMatches(simulations, startDate, spacing);
    const combined = [...allMatches, ...mockMatches];
    const lastMockDate = mockMatches.length > 0
        ? parseUniversalDate(mockMatches[mockMatches.length - 1].Datum)
        : new Date();

    const { points: newAverage } = calculateOptimalRanking(combined, lastMockDate);

    let newLevel = 12;
    const sortedThresholds = [...PROMOTION_THRESHOLDS].reverse();
    for (const threshold of sortedThresholds) {
        if (newAverage >= threshold.pts) {
            newLevel = threshold.lvl;
            break;
        }
    }

    const currentLevel = parseInt(document.getElementById('expectedLevelInput').value) || 12;
    const levelChanged = newLevel < currentLevel;

    return {
        newAverage,
        newLevel,
        levelChange: levelChanged,
        totalPointsAdded: simulations.reduce((sum, sim) => sum + sim.wins * (POINTS_TABLE[sim.level] || 50), 0)
    };
}

export function simulateWins(currentPoints, wins, oppLevel, allMatches) {
    return simulateMultipleWins(currentPoints, [{ wins, level: oppLevel }], allMatches);
}

export function calculateSimulation() {
    try {
        const simulations = [];
        
        const wins1 = parseInt(document.getElementById('simulatorWins1').value) || 0;
        const oppLevel1 = parseInt(document.getElementById('simulatorOppLevel1').value) || 12;
        if (wins1 > 0 && oppLevel1 >= 1 && oppLevel1 <= 12) {
            simulations.push({ wins: wins1, level: oppLevel1 });
        }
        
        const row2 = document.getElementById('simulatorRow2');
        if (row2 && !row2.classList.contains('hidden')) {
            const wins2 = parseInt(document.getElementById('simulatorWins2').value) || 0;
            const oppLevel2 = parseInt(document.getElementById('simulatorOppLevel2').value) || 12;
            if (wins2 > 0 && oppLevel2 >= 1 && oppLevel2 <= 12) {
                simulations.push({ wins: wins2, level: oppLevel2 });
            }
        }
        
        const row3 = document.getElementById('simulatorRow3');
        if (row3 && !row3.classList.contains('hidden')) {
            const wins3 = parseInt(document.getElementById('simulatorWins3').value) || 0;
            const oppLevel3 = parseInt(document.getElementById('simulatorOppLevel3').value) || 12;
            if (wins3 > 0 && oppLevel3 >= 1 && oppLevel3 <= 12) {
                simulations.push({ wins: wins3, level: oppLevel3 });
            }
        }
        
        if (simulations.length === 0) {
            throw new Error('Please enter at least one valid simulation');
        }
        
        for (const sim of simulations) {
            if (sim.wins < 1 || sim.wins > 20) {
                throw new Error('Number of wins must be between 1 and 20 for each row');
            }
        }

        const dateInput = document.getElementById('simulationStartDate');
        let startDate = new Date();
        if (dateInput && dateInput.value) {
            const parts = dateInput.value.split('-');
            if (parts.length === 3) {
                startDate = new Date(parts[0], parts[1]-1, parts[2]);
            }
        }

        const spacingSelect = document.getElementById('simulationSpacing');
        let spacing = 'weekly';
        if (spacingSelect) {
            spacing = spacingSelect.value;
        }

        const simulatedResult = simulateMultipleWins(currentRankingPoints, simulations, allMatches, startDate, spacing);
        
        const resultDiv = document.getElementById('simulatorResultContent');
        const pointsChange = simulatedResult.newAverage - currentRankingPoints;
        const pointsChangeClass = pointsChange >= 0 ? 'positive' : 'negative';
        
        let simulationDesc = '';
        simulations.forEach((sim, index) => {
            if (index > 0) simulationDesc += ' + ';
            simulationDesc += `${sim.wins} × level ${sim.level}`;
        });
        
        let resultHTML = `
            <div class="points-change ${pointsChangeClass}">
                ${pointsChange >= 0 ? '+' : ''}${pointsChange.toFixed(1)} points
            </div>
            <p>
                <strong>${t('simulation.result') || 'Simulation:'}</strong> ${simulationDesc}<br>
                <strong>${t('simulation.from') || 'From:'}</strong> ${currentRankingPoints.toFixed(1)} points<br>
                <strong>${t('simulation.to') || 'To:'}</strong> ${simulatedResult.newAverage.toFixed(1)} points
            </p>
        `;
        
        const currentLevel = parseInt(document.getElementById('expectedLevelInput').value) || 12;
        
        if (simulatedResult.levelChange) {
            resultHTML += `
                <div class="simulation-success-box">
                    <strong>${t('result.levelUp')}</strong><br>
                    ${t('simulation.reachLevel') || 'You would reach level'} ${simulatedResult.newLevel} (${t('simulation.fromLevel') || 'from level'} ${currentLevel})
                </div>
            `;
        } else {
            if (simulatedResult.newLevel < currentLevel) {
                resultHTML += `
                    <div class="simulation-warning-box">
                        <strong>${t('result.alreadyAtLevel')} ${currentLevel}</strong><br>
                        ${t('simulation.pointsQualify') || 'Your points'} (${simulatedResult.newAverage.toFixed(1)}) ${t('simulation.butAlready') || 'would qualify for level'} ${simulatedResult.newLevel}, ${t('simulation.alreadyHigher') || 'but you\'re already at a higher level'} (${currentLevel})
                    </div>
                `;
            } else if (simulatedResult.newLevel === currentLevel) {
                resultHTML += `
                    <div class="simulation-info-box">
                        <strong>${t('result.noChange')}</strong><br>
                        ${t('simulation.remainLevel') || 'You would remain at level'} ${currentLevel}
                    </div>
                `;
            }
        }
        
        resultHTML += `
            <div class="simulation-breakdown-box">
                <strong>${t('result.pointsBreakdown')}</strong><br>
        `;
        
        simulations.forEach((sim, index) => {
            const pointsPerWin = POINTS_TABLE[sim.level] || 50;
            const totalPoints = sim.wins * pointsPerWin;
            resultHTML += `${sim.wins} × level ${sim.level} (${pointsPerWin} pts each) = ${totalPoints} points<br>`;
        });
        
        resultHTML += `${t('result.totalPointsAdded')}: ${simulatedResult.totalPointsAdded}</div>`;
        
        resultDiv.innerHTML = resultHTML;
        document.getElementById('simulatorResult').classList.remove('hidden');
        
        return simulatedResult;
        
    } catch (error) {
        console.error('Error calculating simulation:', error);
        throw error;
    }
}

export function openPathToLevel() {
    try {
        const modal = document.getElementById('pathToLevelModal');
        const overlay = document.getElementById('pathToLevelOverlay');
        if (modal && overlay) {
            modal.style.display = 'block';
            overlay.style.display = 'block';
            
            const currentLevel = parseInt(document.getElementById('expectedLevelInput').value) || 12;
            const targetLevel = Math.max(1, currentLevel - 1);
            updateTargetLevelDisplay(targetLevel);
            updatePathOptions(targetLevel);
        }
    } catch (error) {
        console.error('Error opening path to level:', error);
        throw new Error('Error opening path planner');
    }
}

export function closePathToLevel() {
    const modal = document.getElementById('pathToLevelModal');
    const overlay = document.getElementById('pathToLevelOverlay');
    if (modal && overlay) {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }
}

export function adjustTargetLevel(change) {
    try {
        const targetLevelEl = document.getElementById('currentTargetLevel');
        let currentTarget = parseInt(targetLevelEl.textContent) || 11;
        currentTarget = Math.max(1, Math.min(12, currentTarget + change));
        targetLevelEl.textContent = currentTarget;
        updatePathOptions(currentTarget);
    } catch (error) {
        console.error('Error adjusting target level:', error);
        throw error;
    }
}

export function updateTargetLevelDisplay(level) {
    const targetLevelEl = document.getElementById('currentTargetLevel');
    if (targetLevelEl) {
        targetLevelEl.textContent = level;
    }
}

export function calculateWinsToReachTarget(currentPoints, targetLevel, oppLevel, allMatches, startDate = new Date()) {
    const targetThreshold = PROMOTION_THRESHOLDS.find(t => t.lvl === targetLevel);
    if (!targetThreshold) return { winsNeeded: -1, canReach: false };

    let winsAdded = 0;
    const MAX_WINS = 100;
    let currentMatches = [...allMatches];

    while (winsAdded < MAX_WINS) {
        const winDate = new Date(startDate);
        winDate.setDate(startDate.getDate() + (winsAdded + 1) * 7);
        const mockWin = {
            id: `path-${Date.now()}-${winsAdded}`,
            Datum: formatDate(winDate),
            Jij: 12,
            Hij: oppLevel,
            Result: '21-0 21-0',
            ResultShort: '2-0',
            isWin: true,
            excludeFromRanking: false,
            source: 'simulation',
            discipline: 'S'
        };
        currentMatches.push(mockWin);
        winsAdded++;

        const { points: newAvg } = calculateOptimalRanking(currentMatches, winDate);
        if (newAvg >= targetThreshold.pts) {
            return { winsNeeded: winsAdded, canReach: true, newAverage: newAvg };
        }
    }
    return { winsNeeded: MAX_WINS, canReach: false };
}

export function calculateWinsNeededToLevelUp(currentPoints, expectedLevel, allMatches, discipline = 'S', teamInfo = null) {
    if (expectedLevel <= 1) {
        return { winsNeeded: 0, pointsNeeded: 0, pointsPerWin: 0, canLevelUp: true };
    }
    const nextLevel = expectedLevel - 1;
    const result = calculateWinsToReachTarget(currentPoints, nextLevel, expectedLevel, allMatches);
    return {
        winsNeeded: result.winsNeeded,
        pointsNeeded: result.newAverage ? result.newAverage - currentPoints : 0,
        pointsPerWin: POINTS_TABLE[expectedLevel] || 50,
        canLevelUp: result.canReach,
        newAverageIfWins: result.newAverage || currentPoints
    };
}

export function updatePathOptions(targetLevel) {
    try {
        const currentPoints = currentRankingPoints;
        const currentLevel = parseInt(document.getElementById('expectedLevelInput').value) || 12;
        
        if (targetLevel >= currentLevel) {
            const pathOptionsDiv = document.getElementById('pathOptions');
            pathOptionsDiv.innerHTML = `
                <div class="path-option warning">
                    <strong>Target level ${targetLevel} is not higher than your current level (${currentLevel})</strong><br>
                    Choose a lower level number (higher rank) to see what it takes to level up.
                </div>
            `;
            return;
        }
        
        const targetThreshold = PROMOTION_THRESHOLDS.find(t => t.lvl === targetLevel);
        if (!targetThreshold) {
            const pathOptionsDiv = document.getElementById('pathOptions');
            pathOptionsDiv.innerHTML = `
                <div class="path-option danger">
                    <strong>Invalid target level</strong><br>
                    Please choose a valid level between 1 and 11.
                </div>
            `;
            return;
        }
        
        const pointsNeeded = Math.max(0, targetThreshold.pts - currentPoints);
        
        let pathOptionsHTML = '';
        
        if (pointsNeeded <= 0) {
            pathOptionsHTML = `
                <div class="path-option">
                    <strong>🎉 ${t('simulation.alreadyThere') || 'You\'re already there!'}</strong><br>
                    ${t('simulation.enoughPoints') || 'You have'} ${currentPoints.toFixed(1)} ${t('simulation.pointsForLevel') || 'points, which is enough for level'} ${targetLevel}.
                </div>
            `;
        } else {
            const paths = [];
            
            for (let oppLevel = currentLevel; oppLevel >= 1; oppLevel--) {
                const result = calculateWinsToReachTarget(currentPoints, targetLevel, oppLevel, allMatches);
                
                if (result.canReach && result.winsNeeded > 0) {
                    const pointsPerWin = POINTS_TABLE[oppLevel] || 50;
                    paths.push({
                        level: oppLevel,
                        wins: result.winsNeeded,
                        pointsPerWin: pointsPerWin,
                        totalPoints: result.winsNeeded * pointsPerWin,
                        newAverage: result.newAverage,
                        efficiency: ((targetThreshold.pts - currentPoints) / (result.winsNeeded * pointsPerWin) * 100).toFixed(0)
                    });
                    
                    if (result.winsNeeded === 1) {
                        break;
                    }
                }
            }
            
            paths.sort((a, b) => b.level - a.level);
            
            if (paths.length > 0) {
                pathOptionsHTML = `
                    <div class="path-option">
                        <strong>${t('simulation.toReachLevel') || 'To reach level'} ${targetLevel}:</strong><br>
                        ${t('simulation.needPoints') || 'You need'} ${pointsNeeded.toFixed(1)} ${t('simulation.morePoints') || 'more points'} (${t('simulation.from') || 'from'} ${currentPoints.toFixed(1)} ${t('simulation.to') || 'to'} ${targetThreshold.pts})<br><br>
                        <strong>${t('simulation.consecutiveWins') || 'Consecutive wins needed:'}</strong>
                    </div>
                `;
                
                paths.forEach((path, index) => {
                    const className = index === 0 ? '' : (index === 1 ? 'warning' : 'danger');
                    
                    pathOptionsHTML += `
                        <div class="path-option ${className}">
                            <strong>${path.wins} ${t('simulation.win') || 'win'}${path.wins !== 1 ? 's' : ''} ${t('simulation.againstLevel') || 'against level'} ${path.level} ${t('simulation.opponents') || 'opponents'}</strong><br>
                            • ${t('simulation.eachWinGives') || 'Each win gives'} ${path.pointsPerWin} ${t('simulation.points') || 'points'}<br>
                            • ${t('simulation.totalPointsAdded') || 'Total points added'}: ${path.totalPoints}<br>
                            • ${t('simulation.newAverage') || 'New average'}: ${path.newAverage.toFixed(1)} ${t('simulation.points') || 'points'}<br>
                            • ${t('simulation.efficiency') || 'Efficiency'}: ${path.efficiency}% ${t('simulation.ofPointsContribute') || 'of points contribute to level up'}
                        </div>
                    `;
                });
            } else {
                pathOptionsHTML = `
                    <div class="path-option warning">
                        <strong>${t('simulation.unableCalculate') || 'Unable to calculate a feasible path to level'} ${targetLevel}</strong><br>
                        ${t('simulation.moreThan100Wins') || 'The simulation suggests it might take more than 100 wins to reach this level from your current position.'}
                    </div>
                `;
            }
        }
        
        const pathOptionsDiv = document.getElementById('pathOptions');
        pathOptionsDiv.innerHTML = pathOptionsHTML;
        
    } catch (error) {
        console.error('Error updating path options:', error);
        const pathOptionsDiv = document.getElementById('pathOptions');
        pathOptionsDiv.innerHTML = `
            <div class="path-option danger">
                <strong>${t('error.calculatingPaths') || 'Error calculating paths'}</strong><br>
                ${t('error.tryAgainLater') || 'Please try again later.'}
            </div>
        `;
    }
}

export function updateExpectedLevelDisplay(currentPoints, expectedLevel) {
    try {
        const expectedLevelInput = document.getElementById('expectedLevelInput');
        const currentPointsDisplay = document.getElementById('currentPointsDisplay');
        const tooltip = document.getElementById('expectedLevelTooltip');
        
        if (!expectedLevelInput || !currentPointsDisplay || !tooltip) return;
        
        currentRankingPoints = currentPoints;
        
        userExpectedLevel = expectedLevel;
        expectedLevelInput.value = expectedLevel;
        currentPointsDisplay.textContent = `(${currentPoints})`;
        
        let tooltipText = '';
        
        if (expectedLevel <= 1) {
            tooltipText = '🎉 ' + (t('simulation.alreadyThere') || 'You are at the highest level!');
        } else {
            const nextLevel = expectedLevel - 1;
            const calculation = calculateWinsNeededToLevelUp(currentPoints, expectedLevel, allMatches);
            
            if (calculation.canLevelUp) {
                if (calculation.winsNeeded === 0) {
                    tooltipText = `🎉 ${t('simulation.alreadyEnough') || 'You already have enough points for level'} ${nextLevel}!\n`;
                    tooltipText += `${t('simulation.current') || 'Current'}: ${currentPoints.toFixed(1)} ${t('simulation.points') || 'points'}\n`;
                    tooltipText += `${t('simulation.neededForLevel') || 'Needed for level'} ${nextLevel}: ${calculation.pointsNeeded.toFixed(1)} ${t('simulation.points') || 'points'}`;
                } else {
                    tooltipText = `${t('simulation.toReachLevel') || 'To reach level'} ${nextLevel}:\n\n`;
                    tooltipText += `• ${t('simulation.currentPoints') || 'Current points'}: ${currentPoints.toFixed(1)}\n`;
                    tooltipText += `• ${t('simulation.neededForLevel') || 'Needed for level'} ${nextLevel}: ${calculation.pointsNeeded.toFixed(1)} ${t('simulation.morePoints') || 'more points'}\n`;
                    tooltipText += `• ${t('simulation.eachWinAgainst') || 'Each win against level'} ${expectedLevel} ${t('simulation.gives') || 'gives'} ${calculation.pointsPerWin} ${t('simulation.points') || 'points'}\n`;
                    tooltipText += `• ${t('simulation.needConsecutive') || 'You need'} ${calculation.winsNeeded} ${t('simulation.consecutiveWin') || 'consecutive win'}${calculation.winsNeeded !== 1 ? 's' : ''} ${t('simulation.againstLevel') || 'against level'} ${expectedLevel} ${t('simulation.opponents') || 'opponents'}\n`;
                    
                    if (calculation.winsNeeded > 0) {
                        tooltipText += `\n${t('simulation.afterWins') || 'After'} ${calculation.winsNeeded} ${t('simulation.win') || 'win'}${calculation.winsNeeded !== 1 ? 's' : ''}, ${t('simulation.yourAverage') || 'your average would be'} ${calculation.newAverageIfWins.toFixed(1)}`;
                    }
                    
                    if (expectedLevel > 1) {
                        const higherLevel = expectedLevel - 1;
                        const higherPointsPerWin = POINTS_TABLE[higherLevel] || 72;
                        const higherCalculation = calculateWinsNeededToLevelUp(currentPoints, higherLevel, allMatches);
                        
                        if (higherCalculation.winsNeeded > 0 && higherCalculation.winsNeeded < calculation.winsNeeded) {
                            tooltipText += `\n\n<span class="tip-message">💡 ${t('simulation.tip') || 'Tip'}: ${t('simulation.beatingLevel') || 'Beating level'} ${higherLevel} ${t('simulation.opponents') || 'opponents'} (${higherPointsPerWin} ${t('simulation.ptsEach') || 'pts each'})`;
                            tooltipText += ` ${t('simulation.requireOnly') || 'would require only'} ${higherCalculation.winsNeeded} ${t('simulation.win') || 'win'}${higherCalculation.winsNeeded !== 1 ? 's' : ''}</span>`;
                        }
                    }
                }
            } else {
                tooltipText = `${t('simulation.unableCalculateWins') || 'Unable to calculate exactly how many wins needed.'}\n`;
                tooltipText += `${t('simulation.current') || 'Current'}: ${currentPoints.toFixed(1)} ${t('simulation.points') || 'points'}\n`;
                tooltipText += `${t('simulation.neededForLevel') || 'Needed for level'} ${nextLevel}: ${calculation.pointsNeeded.toFixed(1)} ${t('simulation.morePoints') || 'more points'}`;
            }
        }
        
        tooltip.innerHTML = tooltipText.replace(/\n/g, '<br>');
        
    } catch (error) {
        console.error('Error updating expected level display:', error);
        throw error;
    }
}

export function setCurrentRankingPoints(points) {
    currentRankingPoints = points;
}

export function setCurrentValidMatchesWindow(window) {
    currentValidMatchesWindow = window || [];
}

export function setUserExpectedLevel(level) {
    userExpectedLevel = level || 12;
}