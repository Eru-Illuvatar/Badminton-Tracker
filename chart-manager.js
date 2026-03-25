import { 
    POINTS_TABLE, 
    PROMOTION_THRESHOLDS, 
    t, 
    parseUniversalDate, 
    isValidDateString,
    safeDestroyChart,
    calculateShortResultFromScore 
} from './utils.js';
import { getMatchPoints } from './data-manager.js';

let charts = { progression: null, set: null };

// ============================================
// Evolution Chart
// ============================================
export function renderEvolutionChart(data, chartYearFilter, chartContext, comparisonData = null) {
    const ctx = chartContext || document.getElementById('progressionChart');
    if (!ctx) {
        console.error('Chart canvas not found');
        return null;
    }
    
    try {
        safeDestroyChart(charts.progression, 'progression');
        charts.progression = null;
        
        const filteredData = filterDataByYear(data, chartYearFilter);
        const { processedData, xAxisConfig } = prepareChartData(filteredData, chartYearFilter);
        
        if (processedData.points.length === 0) {
            ctx.style.display = 'none';
            const errorEl = document.getElementById('chartError1');
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.textContent = 'No data available for the selected period';
            }
            return null;
        }

        ctx.style.display = 'block';
        const errorEl = document.getElementById('chartError1');
        if (errorEl) errorEl.style.display = 'none';

        const datasets = [{
            label: 'Ranking Progression',
            data: processedData.points,
            borderColor: getChartColors().lineColor,
            backgroundColor: getChartColors().fillColor,
            borderWidth: 2,
            pointBackgroundColor: getChartColors().lineColor,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1,
            pointRadius: 3, 
            pointHoverRadius: 4,
            fill: true,
            tension: 0.3,
            stepped: false
        }];

        let compProcessed = null;
        if (comparisonData && comparisonData.history) {
            const filteredCompData = filterDataByYear(comparisonData.history, chartYearFilter);
            const processed = prepareChartData(filteredCompData, chartYearFilter);
            compProcessed = processed.processedData;
            
            if (compProcessed.points.length > 0) {
                datasets.push({
                    label: comparisonData.name || 'Comparison',
                    data: compProcessed.points,
                    borderColor: '#ff00ff',
                    backgroundColor: 'rgba(255, 0, 255, 0.1)',
                    borderWidth: 3,
                    pointBackgroundColor: '#ff00ff',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0.3,
                    stepped: false
                });
            }
        }

        let allTimestamps = [];
        let allYValues = [];

        if (Array.isArray(processedData.timestamps)) {
            allTimestamps = allTimestamps.concat(processedData.timestamps);
        }
        if (Array.isArray(processedData.points)) {
            allYValues = allYValues.concat(processedData.points.map(p => p.y));
        }

        if (compProcessed) {
            if (Array.isArray(compProcessed.timestamps)) {
                allTimestamps = allTimestamps.concat(compProcessed.timestamps);
            }
            if (Array.isArray(compProcessed.points)) {
                allYValues = allYValues.concat(compProcessed.points.map(p => p.y));
            }
        }

        let combinedYMax = allYValues.length > 0 ? Math.max(...allYValues) * 1.1 : 100;

        let finalXAxisConfig;
        if (chartYearFilter !== 'all') {
            finalXAxisConfig = { ...xAxisConfig };
            if (allTimestamps.length > 0) {
                finalXAxisConfig.min = Math.min(xAxisConfig.min, Math.min(...allTimestamps));
                finalXAxisConfig.max = Math.max(xAxisConfig.max, Math.max(...allTimestamps));
            }
        } else {
            finalXAxisConfig = getAllYearsXAxisConfig(allTimestamps);
        }

        const thresholdPlugin = createThresholdPlugin();
        const chartColors = getChartColors();

        charts.progression = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        min: finalXAxisConfig.min,
                        max: finalXAxisConfig.max,
                        ticks: {
                            stepSize: finalXAxisConfig.stepSize,
                            callback: finalXAxisConfig.tickCallback,
                            maxTicksLimit: finalXAxisConfig.maxTicksLimit,
                            color: chartColors.textColor,
                            font: { size: 11 }
                        },
                        grid: { color: chartColors.gridColor, drawBorder: false },
                        title: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: chartColors.textColor,
                            callback: function(value) { return value.toFixed(1); }
                        },
                        grid: { color: chartColors.gridColor, drawBorder: false },
                        suggestedMin: 0,
                        suggestedMax: combinedYMax
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: chartColors.textColor, font: { size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: chartColors.lineColor,
                        borderWidth: 1,
                        cornerRadius: 4,
                        callbacks: {
                            title: function(tooltipItems) {
                                const timestamp = tooltipItems[0].parsed.x;
                                const date = new Date(timestamp);
                                const dd = String(date.getDate()).padStart(2, '0');
                                const mm = String(date.getMonth() + 1).padStart(2, '0');
                                const yyyy = date.getFullYear();
                                return `${dd}/${mm}/${yyyy}`;
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null && !isNaN(context.parsed.y)) {
                                    label += context.parsed.y.toFixed(1) + ' points';
                                } else {
                                    label += 'N/A';
                                }
                                return label;
                            }
                        }
                    }
                },
                elements: {
                    line: { tension: 0 },
                    point: { radius: 2, hoverRadius: 4, hitRadius: 6 }
                },
                interaction: { intersect: false, mode: 'index' }
            },
            plugins: [thresholdPlugin]
        });

        return charts.progression;

    } catch (error) {
        console.error('Error rendering chart:', error);
        ctx.style.display = 'none';
        const errorEl = document.getElementById('chartError1');
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Error loading chart: ' + error.message;
        }
        return null;
    }
}

function filterDataByYear(data, yearFilter) {
    return data.filter(d => {
        try {
            if (yearFilter !== 'all') {
                const dateObj = parseUniversalDate(d.Datum);
                if (isNaN(dateObj.getTime())) return false;
                const year = dateObj.getFullYear();
                return year.toString() === yearFilter;
            }
            return true;
        } catch { return false; }
    }).filter(d => {
        try {
            return d && d.Datum && d.newTotal && 
                   isValidDateString(d.Datum) &&
                   !isNaN(parseUniversalDate(d.Datum).getTime()) && 
                   !isNaN(parseFloat(d.newTotal));
        } catch { return false; }
    });
}

function prepareChartData(data, yearFilter) {
    let processedData;
    let xAxisConfig;
    
    if (yearFilter !== 'all') {
        const year = parseInt(yearFilter);
        const isCurrentYear = year === new Date().getFullYear();
        
        const previousYearData = []; 
        
        processedData = processYearDataWithDailyProgression(data, year, previousYearData);
        xAxisConfig = getYearXAxisConfig(year, isCurrentYear, processedData.timestamps);
    } else {
        processedData = processAllYearsDataWithDailyProgression(data);
        xAxisConfig = getAllYearsXAxisConfig(processedData.timestamps);
    }
    return { processedData, xAxisConfig };
}

function processYearDataWithDailyProgression(data, year, previousYearData = []) {
    if (!data || data.length === 0) {
        return { points: [], timestamps: [], dateRange: null };
    }
    
    const sortedData = [...data].sort((a, b) => {
        const dateA = parseUniversalDate(a.Datum);
        const dateB = parseUniversalDate(b.Datum);
        return dateA - dateB;
    });
    
    const dailyRankings = new Map();
    
    sortedData.forEach(match => {
        try {
            const date = parseUniversalDate(match.Datum);
            if (isNaN(date.getTime())) return;
            if (date.getFullYear() !== year) return;
            
            const rankingValue = parseFloat(match.newTotal);
            if (isNaN(rankingValue)) return;
            
            const yearStr = date.getFullYear();
            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
            const dayStr = String(date.getDate()).padStart(2, '0');
            const dayKey = `${yearStr}-${monthStr}-${dayStr}`;
            
            dailyRankings.set(dayKey, {
                timestamp: date.getTime(),
                ranking: rankingValue,
                date: date
            });
        } catch (error) {  }
    });
    
    const dailyArray = Array.from(dailyRankings.values()).sort((a, b) => a.timestamp - b.timestamp);
    const points = [];
    const timestamps = [];
    
    const yearStart = new Date(year, 0, 1).getTime();
    
    if (dailyArray.length > 0) {
        dailyArray.forEach(day => {
            points.push({ x: day.timestamp, y: day.ranking });
            timestamps.push(day.timestamp);
        });
        
        const currentYear = new Date().getFullYear();
        const isCurrentYear = year === currentYear;
        
        if (isCurrentYear) {
            const lastRanking = dailyArray[dailyArray.length - 1].ranking;
            const lastTimestamp = dailyArray[dailyArray.length - 1].timestamp;
            
            const today = new Date();
            const lastMatchDate = new Date(lastTimestamp);
            if (lastMatchDate.toDateString() !== today.toDateString()) {
                const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).getTime();
                points.push({ x: todayEnd, y: lastRanking });
                timestamps.push(todayEnd);
            }
        } else {
            const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();
            const lastRanking = dailyArray[dailyArray.length - 1].ranking;
            points.push({ x: yearEnd, y: lastRanking });
            timestamps.push(yearEnd);
        }
    }
    
    const dateRange = timestamps.length > 0 ? {
        start: new Date(Math.min(...timestamps)),
        end: new Date(Math.max(...timestamps))
    } : null;
    
    return { points, timestamps, dateRange };
}

function processAllYearsDataWithDailyProgression(data) {
    if (!data || data.length === 0) {
        return { points: [], timestamps: [], dateRange: null };
    }
    
    const sortedData = [...data].sort((a, b) => {
        const dateA = parseUniversalDate(a.Datum);
        const dateB = parseUniversalDate(b.Datum);
        return dateA - dateB;
    });
    
    const dailyRankings = new Map();
    
    sortedData.forEach(match => {
        try {
            const date = parseUniversalDate(match.Datum);
            if (isNaN(date.getTime())) return;
            
            const rankingValue = parseFloat(match.newTotal);
            if (isNaN(rankingValue)) return;
            
            const yearStr = date.getFullYear();
            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
            const dayStr = String(date.getDate()).padStart(2, '0');
            const dayKey = `${yearStr}-${monthStr}-${dayStr}`;
            
            dailyRankings.set(dayKey, {
                timestamp: date.getTime(),
                ranking: rankingValue,
                date: date
            });
        } catch (error) {  }
    });
    
    const dailyArray = Array.from(dailyRankings.values()).sort((a, b) => a.timestamp - b.timestamp);
    const points = [];
    const timestamps = [];
    
    if (dailyArray.length > 0) {
        const firstDay = dailyArray[0];
        const firstDayEnd = new Date(firstDay.date);
        firstDayEnd.setHours(23, 59, 59, 999);
        points.push({ x: firstDayEnd.getTime(), y: firstDay.ranking });
        timestamps.push(firstDayEnd.getTime());
        
        for (let i = 1; i < dailyArray.length; i++) {
            const prevDay = dailyArray[i - 1];
            const currentDay = dailyArray[i];
            
            const rankingChanged = prevDay.ranking !== currentDay.ranking;
            const prevDayDate = new Date(prevDay.timestamp);
            const currentDayDate = new Date(currentDay.timestamp);
            const daysBetween = Math.floor((currentDayDate - prevDayDate) / (1000 * 60 * 60 * 24));
            
            if (daysBetween > 1 || rankingChanged) {
                const prevDayEnd = new Date(prevDay.date);
                prevDayEnd.setHours(23, 59, 59, 999);
                if (points.length === 0 || points[points.length - 1].x !== prevDayEnd.getTime()) {
                    points.push({ x: prevDayEnd.getTime(), y: prevDay.ranking });
                    timestamps.push(prevDayEnd.getTime());
                }
                
                const currentDayEnd = new Date(currentDay.date);
                currentDayEnd.setHours(23, 59, 59, 999);
                points.push({ x: currentDayEnd.getTime(), y: currentDay.ranking });
                timestamps.push(currentDayEnd.getTime());
            } else {
                const currentDayEnd = new Date(currentDay.date);
                currentDayEnd.setHours(23, 59, 59, 999);
                if (points.length > 0) {
                    points[points.length - 1] = { x: currentDayEnd.getTime(), y: currentDay.ranking };
                    timestamps[timestamps.length - 1] = currentDayEnd.getTime();
                }
            }
        }
        
        const lastDay = dailyArray[dailyArray.length - 1];
        const lastDayEnd = new Date(lastDay.date);
        lastDayEnd.setHours(23, 59, 59, 999);
        if (points.length === 0 || points[points.length - 1].x !== lastDayEnd.getTime()) {
            points.push({ x: lastDayEnd.getTime(), y: lastDay.ranking });
            timestamps.push(lastDayEnd.getTime());
        }
    }
    
    const dateRange = timestamps.length > 0 ? {
        start: new Date(Math.min(...timestamps)),
        end: new Date(Math.max(...timestamps))
    } : null;
    
    return { points, timestamps, dateRange };
}

function getYearXAxisConfig(year, isCurrentYear = false, timestamps = []) {
    const currentDate = new Date();
    const isYearCurrent = isCurrentYear || year === currentDate.getFullYear();
    
    let maxTimestamp;
    let monthStarts = [];
    let monthLabels = [];
    
    if (isYearCurrent && timestamps.length > 0) {
        maxTimestamp = Math.max(...timestamps, currentDate.getTime());
        const currentMonth = currentDate.getMonth();
        const monthIndices = [];
        
        for (let i = 0; i <= currentMonth; i += 2) monthIndices.push(i);
        if (!monthIndices.includes(currentMonth)) monthIndices.push(currentMonth);
        if (currentDate.getDate() > 20 && currentMonth < 11) monthIndices.push(currentMonth + 1);
        
        for (const monthIndex of monthIndices) {
            if (monthIndex <= currentMonth || (monthIndex === currentMonth + 1 && currentDate.getDate() > 20)) {
                monthStarts.push(new Date(year, monthIndex, 1).getTime());
                monthLabels.push(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex]);
            }
        }
        if (currentDate.getDate() > 1) {
            monthStarts.push(new Date(year, currentDate.getMonth(), currentDate.getDate()).getTime());
            monthLabels.push(`${currentDate.getDate()}`);
        }
    } else {
        maxTimestamp = new Date(year + 1, 0, 1).getTime();
        const monthIndices = [0, 2, 4, 6, 8, 10, 12];
        for (const monthIndex of monthIndices) {
            monthStarts.push(new Date(year, monthIndex, 1).getTime());
            monthLabels.push(monthIndex === 12 ? 'Jan' : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex]);
        }
    }
    
    const stepSize = monthStarts.length > 1 ? (monthStarts[1] - monthStarts[0]) : (maxTimestamp - new Date(year, 0, 1).getTime()) / 6;
    
    return {
        type: 'linear',
        min: new Date(year, 0, 1).getTime(),
        max: maxTimestamp,
        stepSize: stepSize,
        tickCallback: function(value) {
            for (let i = 0; i < monthStarts.length; i++) {
                if (Math.abs(value - monthStarts[i]) < 1000 * 60 * 60 * 24 * 15) return monthLabels[i];
            }
            return '';
        },
        maxTicksLimit: monthStarts.length + 2
    };
}

function getAllYearsXAxisConfig(timestamps) {
    if (timestamps.length === 0) return { min: 0, max: 1, stepSize: 1, tickCallback: () => '', maxTicksLimit: 10 };
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const range = maxTimestamp - minTimestamp;
    const padding = range * 0.05;
    
    return {
        type: 'linear',
        min: minTimestamp - padding,
        max: maxTimestamp + padding,
        stepSize: range / 9,
        tickCallback: function(value) {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getFullYear()}`;
        },
        maxTicksLimit: 10
    };
}

// ============================================
// Win/Loss Summary
// ============================================
export function renderWinLossSummary(data, winLossYearFilter) {
    const tbody = document.getElementById('lvlSummaryBody');
    if (!tbody) return false;
    try {
        const table = tbody.closest('table');
        if (table) table.querySelectorAll('th').forEach(th => th.style.textAlign = 'center');
        tbody.innerHTML = "";
        const stats = calculateWinLossStats(data, winLossYearFilter);
        renderWinLossTableRows(tbody, stats, winLossYearFilter, data);
        updateWinLossTitle(winLossYearFilter);
        return true;
    } catch (error) {
        console.error('Error rendering win/loss summary:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="chart-error-box">Error loading summary</td></tr>';
        return false;
    }
}

function calculateWinLossStats(data, yearFilter) {
    const stats = {};
    let grandTotalWins = 0;
    let grandTotalLosses = 0;
    data.forEach(m => {
        try {
            if (yearFilter !== 'all') {
                const dateObj = parseUniversalDate(m.Datum);
                if (isNaN(dateObj.getTime())) return;
                if (dateObj.getFullYear().toString() !== yearFilter) return;
            }
            let oppLevel;
            if (m.discipline === 'S') {
                oppLevel = parseInt(m.Hij);
            } else {
                const opp1 = parseInt(m.opponent1Level) || 12;
                const opp2 = parseInt(m.opponent2Level) || 12;
                oppLevel = Math.round((opp1 + opp2) / 2);
            }
            if (isNaN(oppLevel) || oppLevel < 1 || oppLevel > 12) return;
            if (!stats[oppLevel]) stats[oppLevel] = { w: 0, l: 0 };
            if (m.isWin) { stats[oppLevel].w++; grandTotalWins++; } 
            else { stats[oppLevel].l++; grandTotalLosses++; }
        } catch (error) {}
    });
    return { levelStats: stats, grandTotalWins, grandTotalLosses };
}

function renderWinLossTableRows(tbody, stats, winLossYearFilter, allMatches) {
    const { levelStats, grandTotalWins, grandTotalLosses } = stats;
    const playedLevels = Object.keys(levelStats).map(Number).sort((a, b) => a - b).filter(level => levelStats[level].w > 0 || levelStats[level].l > 0);
    
    playedLevels.forEach(lvl => {
        const total = levelStats[lvl].w + levelStats[lvl].l;
        const rate = total > 0 ? Math.round((levelStats[lvl].w / total) * 100) : 0;
        
        const tr = document.createElement('tr');
        tr.className = 'level-summary-row';
        tr.dataset.level = lvl;
        tr.innerHTML = `
            <td style="text-align: left; padding-left: 5px;">
                <button class="expand-level-btn" data-level="${lvl}">+</button> 
                <span style="margin-left: 5px;">Lvl ${lvl}</span>
            </td>
            <td style="text-align: center;">${levelStats[lvl].w}</td>
            <td style="text-align: center;">${levelStats[lvl].l}</td>
            <td style="text-align: center;">${total > 0 ? rate + '%' : '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    const grandTotal = grandTotalWins + grandTotalLosses;
    const totalRate = grandTotal > 0 ? Math.round((grandTotalWins / grandTotal) * 100) : 0;
    if (playedLevels.length > 0) {
        const totalRow = document.createElement('tr');
        totalRow.className = 'summary-total-row';
        totalRow.innerHTML = `
            <td style="text-align: center;">${t('table.total') || 'Total'}</td>
            <td style="text-align: center;">${grandTotalWins}</td>
            <td style="text-align: center;">${grandTotalLosses}</td>
            <td style="text-align: center;">${grandTotal > 0 ? totalRate + '%' : '-'}</td>
        `;
        tbody.appendChild(totalRow);
    } else {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-table-message">${t('error.noMatchesFound') || 'No matches found'}${winLossYearFilter !== 'all' ? ` ${t('error.forSelectedYear') || 'for selected year'}` : ''}</td></tr>`;
        return;
    }

    tbody.querySelectorAll('.expand-level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const level = parseInt(btn.dataset.level);
            const summaryRow = btn.closest('tr');
            const isExpanded = btn.textContent === '−';
            
            if (isExpanded) {
                let nextRow = summaryRow.nextSibling;
                const rowsToRemove = [];
                while (nextRow && nextRow.classList && nextRow.classList.contains(`level-detail-${level}`)) {
                    rowsToRemove.push(nextRow);
                    nextRow = nextRow.nextSibling;
                }
                rowsToRemove.forEach(row => row.remove());
                btn.textContent = '+';
            } else {
                btn.textContent = '−';
                
                const matchesForLevel = allMatches.filter(m => {
                    let oppLevel;
                    if (m.discipline === 'S') {
                        oppLevel = parseInt(m.Hij);
                    } else {
                        const opp1 = parseInt(m.opponent1Level) || 12;
                        const opp2 = parseInt(m.opponent2Level) || 12;
                        oppLevel = Math.round((opp1 + opp2) / 2);
                    }
                    if (oppLevel !== level) return false;
                    
                    if (winLossYearFilter !== 'all') {
                        const date = parseUniversalDate(m.Datum);
                        if (date.getFullYear().toString() !== winLossYearFilter) return false;
                    }
                    return true;
                });
                
                matchesForLevel.sort((a, b) => {
                    const da = parseUniversalDate(a.Datum);
                    const db = parseUniversalDate(b.Datum);
                    return db - da;
                });
                
                const fragment = document.createDocumentFragment();
                matchesForLevel.forEach(match => {
                    const detailRow = document.createElement('tr');
                    detailRow.className = `level-detail-${level} level-detail-row`;
                    
                    if (match.isWin) {
                        detailRow.classList.add('win-detail');
                    } else {
                        detailRow.classList.add('loss-detail');
                    }
                    
                    const date = parseUniversalDate(match.Datum);
                    const shortDate = !isNaN(date.getTime()) 
                        ? `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getFullYear()).slice(-2)}`
                        : match.Datum;
                    
                    const type = match.Fase || '-';
                    
                    let opponentName = '';
                    if (match.discipline === 'S') {
                        opponentName = match.Tegenstander || '-';
                    } else {
                        const opp1 = match.opponent1 || '';
                        const opp2 = match.opponent2 ? ' & ' + match.opponent2 : '';
                        opponentName = opp1 + opp2;
                    }
                    
                    const setsResult = match.ResultShort || calculateShortResultFromScore(match.Result);
                    
                    detailRow.innerHTML = `
                        <td style="padding-left: 25px; font-size: 0.7rem;">${shortDate}</td>
                        <td style="font-size: 0.7rem;">${type}</td>
                        <td style="font-size: 0.7rem;">${opponentName}</td>
                        <td style="text-align: center; font-size: 0.7rem;">${setsResult}</td>
                    `;
                    fragment.appendChild(detailRow);
                });
                
                summaryRow.parentNode.insertBefore(fragment, summaryRow.nextSibling);
            }
        });
    });
}

function updateWinLossTitle(winLossYearFilter) {
    const wlChartBox = document.querySelector('.chart-box:has(#lvlSummaryBody)');
    const wlTitle = wlChartBox ? wlChartBox.querySelector('h4') : null;
    if (wlTitle) wlTitle.textContent = winLossYearFilter !== 'all' ? `${t('dashboard.winLossChart')} (${winLossYearFilter})` : t('dashboard.winLossChart');
}

function createThresholdPlugin() {
    return {
        id: 'thresholdLines',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
            ctx.save();
            PROMOTION_THRESHOLDS.forEach(th => {
                const yPos = y.getPixelForValue(th.pts);
                if (yPos >= top && yPos <= bottom) {
                    ctx.beginPath();
                    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--chart-threshold-line').trim() || 'rgba(255, 99, 132, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([5, 5]);
                    ctx.moveTo(left, yPos);
                    ctx.lineTo(right, yPos);
                    ctx.stroke();
                    ctx.font = '10px Segoe UI';
                    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--chart-threshold-text').trim() || 'rgba(255, 99, 132, 0.8)';
                    ctx.textAlign = 'right';
                    ctx.fillText(`Lvl ${th.lvl} (${th.pts})`, right - 5, yPos - 5);
                }
            });
            ctx.restore();
        }
    };
}

function getChartColors() {
    const computedStyle = getComputedStyle(document.body);
    return {
        lineColor: computedStyle.getPropertyValue('--chart-line-color').trim() || '#4A90E2',
        fillColor: computedStyle.getPropertyValue('--chart-fill-color').trim() || 'rgba(74, 144, 226, 0.1)',
        gridColor: computedStyle.getPropertyValue('--chart-grid').trim() || '#e0e0e0',
        textColor: computedStyle.getPropertyValue('--chart-text').trim() || '#2c3e50'
    };
}

// ============================================
// Third Chart: Score Margins
// ============================================
export function renderSetChart(data, filters, chartContext) {
    const ctx = chartContext || document.getElementById('setChart');
    if (!ctx) {
        console.error('Set chart canvas not found');
        return null;
    }

    try {
        safeDestroyChart(charts.set, 'set');
        charts.set = null;

        const filtered = filterSetsData(data, filters);

        if (filtered.totalSets === 0) {
            ctx.style.display = 'none';
            const errorEl = document.getElementById('chartErrorSet');
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.textContent = 'No set data available for the selected filters.';
            }
            return null;
        }

        ctx.style.display = 'block';
        const errorEl = document.getElementById('chartErrorSet');
        if (errorEl) errorEl.style.display = 'none';

        const bins = {
            'L0-10': 0,
            'L11-14': 0,
            'L15-18': 0,
            'L19-28': 0,
            'W0-10': 0,
            'W11-14': 0,
            'W15-18': 0,
            'W19-28': 0,
            'WO': 0
        };

        filtered.matches.forEach(match => {
            if (match.excludeFromRanking || match.isWalkover) {
                bins['WO']++;
                return;
            }

            const sets = parseSetsFromScore(match.Result);
            if (!sets.length) return;

            sets.forEach((set, idx) => {
                if (filters.set !== 'all' && (idx+1) !== parseInt(filters.set)) return;

                const { my, opp } = set;

                if (my < 21 && opp < 21) {
                    bins['WO']++;
                    return;
                }

                if (my > opp) {
                    if (my >= 21 && my <= 30 && opp >= 19 && opp <= 28) {
                        bins['W19-28']++;
                    } else if (my === 21 && opp >= 15 && opp <= 18) {
                        bins['W15-18']++;
                    } else if (my === 21 && opp >= 11 && opp <= 14) {
                        bins['W11-14']++;
                    } else if (my === 21 && opp >= 0 && opp <= 10) {
                        bins['W0-10']++;
                    }
                } else if (opp > my) {
                    if (opp >= 21 && opp <= 30 && my >= 19 && my <= 28) {
                        bins['L19-28']++;
                    } else if (opp === 21 && my >= 15 && my <= 18) {
                        bins['L15-18']++;
                    } else if (opp === 21 && my >= 11 && my <= 14) {
                        bins['L11-14']++;
                    } else if (opp === 21 && my >= 0 && my <= 10) {
                        bins['L0-10']++;
                    }
                }
            });
        });

        const orderedBinKeys = [
            'L0-10', 'L11-14', 'L15-18', 'L19-28',
            'W19-28', 'W15-18', 'W11-14', 'W0-10',
            'WO'
        ];
        const displayLabels = [
            '0-10', '11-14', '15-18', '19-28',
            '19-28', '18-15', '14-11', '10-0',
            'WO'
        ];
        const dataValues = orderedBinKeys.map(key => bins[key] || 0);
        const backgroundColors = orderedBinKeys.map(key => {
            if (key === 'WO') return '#6c757d'; 
            if (key.startsWith('L')) return '#dc3545';
            if (key.startsWith('W')) return '#28a745';
            return '#6c757d';
        });

        const chartColors = getChartColors();

        charts.set = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: displayLabels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: backgroundColors,
                    borderColor: chartColors.lineColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.raw} set${ctx.raw !== 1 ? 's' : ''}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: chartColors.textColor },
                        grid: { color: chartColors.gridColor }
                    },
                    x: {
                        ticks: { color: chartColors.textColor, maxRotation: 45, minRotation: 45 }
                    }
                }
            }
        });

        return charts.set;

    } catch (error) {
        console.error('Error rendering set chart:', error);
        ctx.style.display = 'none';
        const errorEl = document.getElementById('chartErrorSet');
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Error loading chart: ' + error.message;
        }
        return null;
    }
}

function filterSetsData(data, filters) {
    let matches = data;

    if (filters.year && filters.year !== 'all') {
        matches = matches.filter(m => {
            const date = parseUniversalDate(m.Datum);
            return date.getFullYear().toString() === filters.year;
        });
    }

    if (filters.level && filters.level !== 'all') {
        const levelNum = parseInt(filters.level);
        matches = matches.filter(m => parseInt(m.Hij) === levelNum);
    }

    if (filters.time && filters.time !== 'all') {
        matches = matches.filter(m => {
            const timeStr = m.scrapedTime || m.Duur || '';
            const hour = extractHour(timeStr);
            if (filters.time === 'unknown') {
                return hour === null;
            } else {
                if (hour === null) return false;
                return filters.time === 'morning' ? hour < 12 : hour >= 12;
            }
        });
    }

    let totalSets = 0;
    matches.forEach(m => {
        if (!(m.excludeFromRanking || m.isWalkover)) {
            const sets = parseSetsFromScore(m.Result);
            totalSets += sets.length;
        } else {
            totalSets++;
        }
    });

    return { matches, totalSets };
}

function extractHour(timeStr) {
    if (!timeStr) return null;
    const trimmed = timeStr.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
        const hour = parseInt(match[1]);
        if (hour >= 0 && hour <= 23) return hour;
    }
    const minutes = parseInt(trimmed);
    if (!isNaN(minutes) && minutes >= 0 && minutes <= 1440) {
        return Math.floor(minutes / 60);
    }
    return null;
}

function parseSetsFromScore(score) {
    if (!score || typeof score !== 'string') return [];
    const sets = [];
    const parts = score.trim().split(/\s+/);
    for (const part of parts) {
        if (part.match(/(wo|walkover|opgave)/i)) continue;
        const dash = part.split('-');
        if (dash.length === 2) {
            const my = parseInt(dash[0]);
            const opp = parseInt(dash[1]);
            if (!isNaN(my) && !isNaN(opp) && my >= 0 && opp >= 0) {
                sets.push({ my, opp });
            }
        }
    }
    return sets;
}

// ============================================
// Helper for points calculation
// ============================================
function calculatePointsForAgainst(data, filters) {
    let totalFor = 0;
    let totalAgainst = 0;

    data.forEach(match => {
        if (filters.year && filters.year !== 'all') {
            const date = parseUniversalDate(match.Datum);
            if (isNaN(date.getTime()) || date.getFullYear().toString() !== filters.year) return;
        }

        if (filters.level && filters.level !== 'all') {
            const targetLevel = parseInt(filters.level);
            let matchOppLevel;
            if (match.discipline === 'S') {
                matchOppLevel = parseInt(match.Hij) || 12;
            } else {
                const opp1 = parseInt(match.opponent1Level) || 12;
                const opp2 = parseInt(match.opponent2Level) || 12;
                matchOppLevel = Math.round((opp1 + opp2) / 2);
            }
            if (matchOppLevel !== targetLevel) return;
        }

        if (filters.time && filters.time !== 'all') {
            const hour = extractHour(match.scrapedTime || match.Duur || '');
            if (filters.time === 'unknown') {
                if (hour !== null) return;
            } else {
                if (hour === null) return;
                const isMorning = hour < 12;
                if (filters.time === 'morning' && !isMorning) return;
                if (filters.time === 'afternoon' && isMorning) return;
            }
        }

        const sets = parseSetsFromScore(match.Result);
        sets.forEach((set, idx) => {
            if (filters.set && filters.set !== 'all' && (idx+1) !== parseInt(filters.set)) return;

            totalFor += set.my;
            totalAgainst += set.opp;
        });
    });

    return { totalFor, totalAgainst };
}

// ============================================
// Shot Percentage
// ============================================
export function renderShotPercentageChart(data, filters) {
    const ctx = document.getElementById('setChart');
    if (!ctx) {
        console.error('Set chart canvas not found');
        return null;
    }

    try {
        safeDestroyChart(charts.set, 'set');
        charts.set = null;

        const { totalFor, totalAgainst } = calculatePointsForAgainst(data, filters);
        const total = totalFor + totalAgainst;
        const percentage = total > 0 ? (totalFor / total * 100).toFixed(1) : 0;

        if (total === 0) {
            ctx.style.display = 'none';
            const errorEl = document.getElementById('chartErrorSet');
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.textContent = 'No point data available for the selected filters.';
            }
            return null;
        }

        ctx.style.display = 'block';
        const errorEl = document.getElementById('chartErrorSet');
        if (errorEl) errorEl.style.display = 'none';

        const chartColors = getChartColors();

        const centerTextPlugin = {
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea: { top, left, right, bottom }, width, height } = chart;
                ctx.save();
                ctx.font = 'bold 24px "Segoe UI", sans-serif';
                ctx.fillStyle = chartColors.textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${percentage}%`, width / 2, height / 2);
                ctx.restore();
            }
        };

        charts.set = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Points Won', 'Points Lost'],
                datasets: [{
                    data: [percentage, 100 - percentage],
                    backgroundColor: ['#28a745', '#d3d3d3'],
                    borderColor: chartColors.lineColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: chartColors.lineColor,
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.dataIndex === 0) return `Points Won: ${totalFor} (${percentage}%)`;
                                return `Points Lost: ${totalAgainst} (${(100-percentage).toFixed(1)}%)`;
                            }
                        }
                    }
                }
            },
            plugins: [centerTextPlugin]
        });

        return charts.set;

    } catch (error) {
        console.error('Error rendering shot percentage chart:', error);
        ctx.style.display = 'none';
        const errorEl = document.getElementById('chartErrorSet');
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Error loading chart: ' + error.message;
        }
        return null;
    }
}

// ============================================
// Points Won & Lost Cumulative – for second chart
// ============================================
export function renderPointsCumulativeChart(data, yearFilter, chartContext) {
    const ctx = chartContext || document.getElementById('progressionChart');
    if (!ctx) {
        console.error('Chart canvas not found');
        return null;
    }

    try {
        safeDestroyChart(charts.progression, 'progression');
        charts.progression = null;

        const filteredData = filterDataByYearForPoints(data, yearFilter);
        if (filteredData.length === 0) {
            ctx.style.display = 'none';
            const errorEl = document.getElementById('chartError1');
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.textContent = 'No data available for the selected period';
            }
            return null;
        }

        ctx.style.display = 'block';
        const errorEl = document.getElementById('chartError1');
        if (errorEl) errorEl.style.display = 'none';

        const sorted = [...filteredData].sort((a, b) => {
            const dateA = parseUniversalDate(a.Datum);
            const dateB = parseUniversalDate(b.Datum);
            return dateA - dateB;
        });

        let cumulativeWon = 0;
        let cumulativeLost = 0;
        const pointsWonData = [];
        const pointsLostData = [];

        sorted.forEach(match => {
            const sets = parseSetsFromScore(match.Result);
            sets.forEach(set => {
                cumulativeWon += set.my;
                cumulativeLost += set.opp;
            });
            const date = parseUniversalDate(match.Datum);
            const timestamp = date.getTime();
            pointsWonData.push({ x: timestamp, y: cumulativeWon });
            pointsLostData.push({ x: timestamp, y: cumulativeLost });
        });

        const chartColors = getChartColors();

        charts.progression = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Points Won',
                        data: pointsWonData,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        pointRadius: 2,
                        fill: false,
                        tension: 0.3
                    },
                    {
                        label: 'Points Lost',
                        data: pointsLostData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 2,
                        pointRadius: 2,
                        fill: false,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        ticks: {
                            callback: function(value) {
                                const date = new Date(value);
                                return `${date.getMonth()+1}/${date.getFullYear()}`;
                            },
                            color: chartColors.textColor,
                            maxTicksLimit: 10
                        },
                        grid: { color: chartColors.gridColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: chartColors.textColor },
                        grid: { color: chartColors.gridColor }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: chartColors.textColor }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: chartColors.lineColor,
                        borderWidth: 1,
                        callbacks: {
                            title: function(tooltipItems) {
                                const timestamp = tooltipItems[0].parsed.x;
                                const date = new Date(timestamp);
                                return `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                label += context.parsed.y;
                                return label;
                            }
                        }
                    }
                }
            }
        });

        return charts.progression;

    } catch (error) {
        console.error('Error rendering points cumulative chart:', error);
        ctx.style.display = 'none';
        const errorEl = document.getElementById('chartError1');
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Error loading chart: ' + error.message;
        }
        return null;
    }
}

function filterDataByYearForPoints(data, yearFilter) {
    return data.filter(d => {
        try {
            if (yearFilter !== 'all') {
                const dateObj = parseUniversalDate(d.Datum);
                if (isNaN(dateObj.getTime())) return false;
                const year = dateObj.getFullYear();
                return year.toString() === yearFilter;
            }
            return true;
        } catch { return false; }
    }).filter(d => {
        try {
            return d && d.Datum && d.Result && isValidDateString(d.Datum);
        } catch { return false; }
    });
}

// ============================================
// Destroy all charts
// ============================================
export function destroyAllCharts() {
    if (charts.progression && typeof charts.progression.destroy === 'function') safeDestroyChart(charts.progression, 'progression');
    if (charts.set && typeof charts.set.destroy === 'function') safeDestroyChart(charts.set, 'set');
    charts.progression = null;
    charts.set = null;
}

// ============================================
// Radar Chart: Competition vs Tournaments
// ============================================
export function renderCompetitionTournamentRadar(data) {
  const ctx = document.getElementById('setChart');
  if (!ctx) {
    console.error('Chart canvas not found');
    return null;
  }

  try {
    // Safely destroy any existing chart using the same canvas
    if (charts.set && typeof charts.set.destroy === 'function') {
      charts.set.destroy();
    }
    charts.set = null;

    const competitionRegex = /competition|competitie|interclub/i;
    const competitionMatches = data.filter(m => competitionRegex.test(m.Fase || ''));
    const tournamentMatches = data.filter(m => !competitionRegex.test(m.Fase || ''));

    if (competitionMatches.length === 0 && tournamentMatches.length === 0) {
      ctx.style.display = 'none';
      const errorEl = document.getElementById('chartErrorSet');
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'No matches available to compare.';
      }
      return null;
    }

    const compMetrics = computeCategoryMetrics(competitionMatches);
    const tourMetrics = computeCategoryMetrics(tournamentMatches);

    const hasCompetition = competitionMatches.length > 0;
    const hasTournament = tournamentMatches.length > 0;

    const metricNames = [
      'Win %',
      'Points per Win',
      'Average Sets per Match',
      'Set Win %',
      'Set Dominance'
    ];

    const ranges = {
      winRate: [0, 1],
      pointsPerWin: [0, 500],
      avgSets: [0, 5],
      setWinRate: [0, 1],
      dominance: [-21, 21]
    };

    const norm = (value, min, max) => {
      if (value === undefined || value === null) return 0;
      const clamped = Math.min(Math.max(value, min), max);
      return (clamped - min) / (max - min);
    };

    const datasets = [];

    if (hasCompetition) {
      datasets.push({
        label: 'Competition',
        data: [
          norm(compMetrics.winRate, ranges.winRate[0], ranges.winRate[1]),
          norm(compMetrics.pointsPerWin, ranges.pointsPerWin[0], ranges.pointsPerWin[1]),
          norm(compMetrics.avgSets, ranges.avgSets[0], ranges.avgSets[1]),
          norm(compMetrics.setWinRate, ranges.setWinRate[0], ranges.setWinRate[1]),
          norm(compMetrics.dominance, ranges.dominance[0], ranges.dominance[1])
        ],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
      });
    }

    if (hasTournament) {
      datasets.push({
        label: 'Tournaments',
        data: [
          norm(tourMetrics.winRate, ranges.winRate[0], ranges.winRate[1]),
          norm(tourMetrics.pointsPerWin, ranges.pointsPerWin[0], ranges.pointsPerWin[1]),
          norm(tourMetrics.avgSets, ranges.avgSets[0], ranges.avgSets[1]),
          norm(tourMetrics.setWinRate, ranges.setWinRate[0], ranges.setWinRate[1]),
          norm(tourMetrics.dominance, ranges.dominance[0], ranges.dominance[1])
        ],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 99, 132, 1)'
      });
    }

    if (datasets.length === 0) {
      ctx.style.display = 'none';
      const errorEl = document.getElementById('chartErrorSet');
      if (errorEl) {
        errorEl.style.display = 'block';
        errorEl.textContent = 'No data available for comparison.';
      }
      return null;
    }

    ctx.style.display = 'block';
    const errorEl = document.getElementById('chartErrorSet');
    if (errorEl) errorEl.style.display = 'none';

    const chartColors = getChartColors();

    const tooltip = {
      callbacks: {
        label: function(context) {
          const datasetIndex = context.datasetIndex;
          const dataIndex = context.dataIndex;
          let rawActual;
          if (datasetIndex === 0 && hasCompetition) {
            const metrics = compMetrics;
            rawActual = getRawMetric(metrics, dataIndex);
          } else if (datasetIndex === 1 && hasTournament) {
            const metrics = tourMetrics;
            rawActual = getRawMetric(metrics, dataIndex);
          } else {
            rawActual = context.raw;
          }
          const label = context.dataset.label || '';
          const metricName = metricNames[dataIndex];
          return `${label} - ${metricName}: ${rawActual.toFixed(2)}`;
        }
      }
    };

    charts.set = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: metricNames,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: tooltip,
          legend: {
            labels: { color: chartColors.textColor }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 1,
            ticks: {
              stepSize: 0.2,
              callback: (value) => `${(value * 100).toFixed(0)}%`,
              color: chartColors.textColor
            },
            grid: { color: chartColors.gridColor },
            angleLines: { color: chartColors.gridColor },
            pointLabels: { color: chartColors.textColor, font: { size: 10 } }
          }
        }
      }
    });

    function getRawMetric(metrics, idx) {
      switch (idx) {
        case 0: return metrics.winRate;
        case 1: return metrics.pointsPerWin;
        case 2: return metrics.avgSets;
        case 3: return metrics.setWinRate;
        case 4: return metrics.dominance;
        default: return 0;
      }
    }

    return charts.set;

  } catch (error) {
    console.error('Error rendering competition/tournament radar:', error);
    ctx.style.display = 'none';
    const errorEl = document.getElementById('chartErrorSet');
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = 'Error loading chart: ' + error.message;
    }
    return null;
  }
}

function computeCategoryMetrics(matches) {
  if (matches.length === 0) {
    return {
      winRate: 0,
      pointsPerWin: 0,
      avgSets: 0,
      setWinRate: 0,
      dominance: 0
    };
  }

  let wins = 0;
  let totalMatches = matches.length;
  let totalPointsWon = 0;
  let totalPointsLost = 0;
  let totalSets = 0;
  let totalMargin = 0;
  let sumPointsPerWin = 0;

  matches.forEach(match => {
    const isWin = match.isWin;
    if (isWin) {
      wins++;
      sumPointsPerWin += getMatchPoints(match);
    }

    const sets = parseSetsFromScore(match.Result);
    sets.forEach(set => {
      totalSets++;
      totalPointsWon += set.my;
      totalPointsLost += set.opp;
      totalMargin += (set.my - set.opp);
    });
  });

  const winRate = totalMatches > 0 ? wins / totalMatches : 0;
  const pointsPerWin = wins > 0 ? sumPointsPerWin / wins : 0;
  const avgSets = totalMatches > 0 ? totalSets / totalMatches : 0;
  const setWinRate = (totalPointsWon + totalPointsLost) > 0 ? totalPointsWon / (totalPointsWon + totalPointsLost) : 0;
  const dominance = totalSets > 0 ? totalMargin / totalSets : 0;

  return { winRate, pointsPerWin, avgSets, setWinRate, dominance };
}