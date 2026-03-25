// utils.js

// ========================================================
// 0. RANKING CALCULATION METHOD
// ========================================================
/**
 * BADMINTON RANKING CALCULATION METHOD
 * 
 * The ranking average is calculated using these steps:
 * 1. Take your 20 most recent valid matches (sorted by date, newest first)
 * 2. Sort these matches in the following order:
 *    - Lost matches first (regardless of points)
 *    - Won matches sorted from highest points to lowest points
 * 3. Calculate the average incrementally:
 *    - Start with an empty set and add matches one by one in the sorted order
 *    - After adding each match, calculate the new average (total points / number of matches)
 *    - Continue adding matches as long as the average increases or stays the same
 *    - Stop when adding the next match would cause the average to decrease
 * 4. The final average after stopping is your ranking points
 * 
 * SPECIAL CASE - MINIMUM MATCHES CORRECTION:
 * If you have fewer than 7 valid matches in total, the calculation adjusts:
 * Total points from all matches is divided by 7 (not by the actual match count)
 * 
 * Example for singles:
 * - First 6 matches (losses): contribute 0 points each
 * - Then wins added in descending point order: 217, 217, 150, 150, 150, ...
 * - Average calculated progressively until adding next match would decrease it
 * 
 * Example for mixed with only 4 wins of 72 points each:
 * - Total points: 72 + 72 + 72 + 72 = 288
 * - Divided by 7 (minimum matches rule) = 41 points average
 */

// ========================================================
// 1. CONSTANTS & CONFIGURATION
// ========================================================

/** Points awarded based on opponent's level. */
export const POINTS_TABLE = {
    1: 2831, 2: 1961, 3: 1359, 4: 942, 5: 652, 6: 452,
    7: 313, 8: 217, 9: 150, 10: 104, 11: 72, 12: 50
};

/** Thresholds (points) required to reach each playing level. */
export const PROMOTION_THRESHOLDS = [
    { lvl: 11, pts: 35 },
    { lvl: 10, pts: 51 },
    { lvl: 9,  pts: 73 },
    { lvl: 8,  pts: 105 },
    { lvl: 7,  pts: 152 },
    { lvl: 6,  pts: 219 },
    { lvl: 5,  pts: 316 },
    { lvl: 4,  pts: 457 },
    { lvl: 3,  pts: 659 },
    { lvl: 2,  pts: 951 },
    { lvl: 1,  pts: 1373 }
];

// ========================================================
// 2. INTERNATIONALIZATION (i18n)
// ========================================================

const translations = {
    // ----------------------------------------------------
    // ENGLISH
    // ----------------------------------------------------
    en: {
        'dashboard.title': 'Your Badminton Analysis',
        'dashboard.totalMatches': 'Total Matches',
        'dashboard.recentMatches': 'Last 52 weeks',
        'dashboard.simulations': 'Simulations',
        'dashboard.expectedLevel': 'Expected Level',
        'dashboard.currentRankingPoints': 'Current Ranking Points',
        'dashboard.winLossChart': 'Win/Loss ratio',
        'dashboard.trophies': 'Trophies',

        'chart.evolution': 'Evolution of ranking score',
        'chart.winLoss': 'Win/Loss ratio',
        'chart.margins': 'Score Margins',
        'chart.shotPercentage': 'Shot Percentage',

        'discipline.tooltip.singles': 'Singles',
        'discipline.tooltip.doubles': 'Doubles',
        'discipline.tooltip.mixed': 'Mixed',

        'button.import': 'Import',
        'button.export': 'Export',
        'button.clearAll': 'Clear All',
        'button.close': 'Close',
        'button.calculate': 'Calculate',
        'button.save': 'Save',
        'button.delete': 'Delete',
        'button.resetSettings': 'Reset Settings',
        'button.loadCompare': 'Load & Compare',

        'profile.badmintonVlaanderen': 'badminton.vlaanderen Profile URL',
        'profile.toernooi': 'toernooi.nl Profile URL',
        'profile.badmintonHint': 'Your public profile URL from badminton.vlaanderen',
        'profile.toernooiHint': 'Your public profile URL from toernooi.nl',
        'profile.note': 'Note: These profiles will be used for future automatic match scraping.',
        'profile.scrapingProfiles': 'Scraping Profiles',

        'settings.language': 'Language',
        'settings.csvFormat': 'CSV Format',
        'settings.actions': 'Actions',
        'settings.reset': 'Reset Settings',

        'table.date': 'Date',
        'table.type': 'Type',
        'table.myLevel': 'My Lvl',
        'table.opponentLevel': 'Opp Lvl',
        'table.opponent': 'Opponent',
        'table.score': 'Score (Time)',
        'table.duration': 'Min',
        'table.points': 'New Ranking Points',
        'table.extraPoints': 'Extra Points',
        'table.actions': 'Actions',
        'table.ourTeam': 'Our Team',
        'table.ourLvls': 'Our Lvls',
        'table.oppLvls': 'Opp Lvls',
        'table.opponents': 'Opponents',
        'table.total': 'Total',

        'table.filterAll': 'All',
        'table.filterAllYears': 'All Years',
        'table.filterWin': 'Win',
        'table.filterLoss': 'Loss',
        'table.filterValid': '✅ Valid',
        'table.filterDate': 'Date',
        'table.filterType': 'Phase/Tournament',
        'table.filterMyLvl': 'My Lvl',
        'table.filterOppLvl': 'Opp Lvl',
        'table.filterOpponent': 'Search players...',
        'table.filterResult': 'Win/loss',
        'table.filterYear': 'Year',
        'table.filterTeammates': 'Search teammates...',
        'table.filterOurLevels': 'Our Lvls',
        'table.filterOppLevels': 'Opp Lvls',
        'table.filterOpponentsDoubles': 'Search opponents...',
        'table.filterResultDoubles': 'Win/Loss',

        'simulation.quick': 'Quick "What If" Calculator',
        'simulation.path': 'Path to Level X',
        'simulation.compare': 'Compare Player',
        'simulation.calculateDesc': 'Simulate what happens if you win matches against certain opponents.',
        'simulation.pathDesc': 'See what it takes to reach your target level.',
        'simulation.ifWin': 'If I win',
        'simulation.matchesAgainst': 'match(es) against level',
        'simulation.and': 'and',
        'simulation.addLevel': '+ Add another opponent level',
        'simulation.result': 'Simulation:',
        'simulation.from': 'From:',
        'simulation.to': 'To:',
        'simulation.remainLevel': 'You would remain at level',
        'simulation.reachLevel': 'You would reach level',
        'simulation.fromLevel': 'from level',
        'simulation.pointsQualify': 'Your points',
        'simulation.butAlready': 'would qualify for level',
        'simulation.alreadyHigher': "but you're already at a higher level",
        'simulation.needPoints': 'You need',
        'simulation.morePoints': 'more points',
        'simulation.consecutiveWins': 'Consecutive wins needed:',
        'simulation.eachWinGives': 'Each win gives',
        'simulation.points': 'points',
        'simulation.totalPointsAdded': 'Total points added',
        'simulation.newAverage': 'New average',
        'simulation.efficiency': 'Efficiency',
        'simulation.ofPointsContribute': 'of points contribute to level up',
        'simulation.toReachLevel': 'To reach level',
        'simulation.againstLevel': 'against level',
        'simulation.opponents': 'opponents',
        'simulation.win': 'win',
        'simulation.wins': 'wins',
        'simulation.unableCalculate': 'Unable to calculate a feasible path to level',
        'simulation.moreThan100Wins': 'The simulation suggests it might take more than 100 wins to reach this level from your current position.',
        'simulation.alreadyThere': "You're already there!",
        'simulation.enoughPoints': 'You have',
        'simulation.pointsForLevel': 'points, which is enough for level',
        'simulation.alreadyEnough': 'You already have enough points for level',
        'simulation.current': 'Current',
        'simulation.neededForLevel': 'Needed for level',
        'simulation.currentPoints': 'Current points',
        'simulation.eachWinAgainst': 'Each win against level',
        'simulation.gives': 'gives',
        'simulation.needConsecutive': 'You need',
        'simulation.consecutiveWin': 'consecutive win',
        'simulation.afterWins': 'After',
        'simulation.yourAverage': 'your average would be',
        'simulation.tip': 'Tip',
        'simulation.beatingLevel': 'Beating level',
        'simulation.ptsEach': 'pts each',
        'simulation.requireOnly': 'would require only',
        'simulation.unableCalculateWins': 'Unable to calculate exactly how many wins needed.',
        'simulation.note': 'Note:',
        'simulation.calculationNote': 'Calculations are based on your current ranking window (last 20 valid matches).',

        'simulation.compareTitle': 'Compare player',
        'simulation.compareDesc': 'Overlay another player\'s ranking evolution on your chart.',
        'simulation.savedPlayers': 'Saved players',
        'simulation.noSavedPlayers': 'No saved players yet.',
        'simulation.addNewRival': 'Add a new rival',
        'simulation.nameLabel': 'Name',
        'simulation.urlLabel': 'Toernooi.nl Profile URL',
        'simulation.urlHint': 'Link needs to be a toernooi.nl profile rating page.',
        'simulation.badmintonUrlLabel': 'Badminton Vlaanderen Profile URL',
        'simulation.badmintonUrlHint': 'Optional: add a badminton.vlaanderen profile to include those matches.',
        'simulation.saveCheckbox': 'Save for future sessions',
        'simulation.loadButton': 'Save',

        'trophies.firstPlace': '1st place',
        'trophies.secondPlace': '2nd place',
        'trophies.thirdFourthPlace': '3/4th place',

        'result.levelUp': '🎉 Level Up!',
        'result.noChange': 'No level change',
        'result.alreadyAtLevel': 'Already at level',
        'result.pointsBreakdown': 'Points breakdown:',
        'result.totalPointsAdded': 'Total points added:',

        'tooltip.csvImport': 'CSV Import Instructions',
        'tooltip.csvSinglesFormat': 'Singles Format',
        'tooltip.csvDoublesMixedFormat': 'Doubles/Mixed Format',
        'tooltip.csvSinglesExample': '14/12/24;John Doe;12;11;21-19 21-15;0;;IC Tournament;45',
        'tooltip.csvDoublesExample': '14/12/24;Jane Smith;D;12;11;John Doe;11;Mike Johnson;12;21-19 21-15;Club Tournament;60',
        'tooltip.csvNoteHeader': 'Note:',
        'tooltip.csvNoteColumns': 'Columns must be separated by semicolons (;). The first row should contain headers.',
        'tooltip.csvExtraNote': 'When exporting, the system automatically includes scraped time and extra type information in additional columns.',

        'points.tooltip.contributed.win': 'This win contributed {points} points to your average.',
        'points.tooltip.contributed.loss': 'This loss contributed 0 points to your average.',
        'points.tooltip.changed': 'Your average changed by {change} (from {prev} to {new}).',
        'points.tooltip.replaced': 'It replaced a {result} against level {level} (worth {removedPoints} points).',
        'points.tooltip.excluded': 'This match was manually excluded from ranking.',
        'points.tooltip.invalid': 'This match is invalid for ranking (level difference >1).',
        'points.tooltip.win': 'win',
        'points.tooltip.loss': 'loss',
        'points.tooltip.contributed': 'This match contributed {points} points to your average.',
        'points.tooltip.notIncluded': 'This match was not included in your current ranking average.',
        'points.tooltip.afterMatch': 'After this match, your average is {points}.',
        'points.tooltip.progression': 'Point calculation:',
        'points.tooltip.finalAverage': 'Final average:',

        'tour.languageStep.title': 'Step 1: Select Language',
        'tour.languageStep.content': 'Choose your preferred language:',
        'tour.languageStep.saveButton': 'Save & Continue',
        'tour.nameStep.title': 'Step 2: Your name',
        'tour.nameStep.content': 'To personalize your dashboard, please enter your first name:',
        'tour.nameStep.namePlaceholder': 'Your first name',
        'tour.nameStep.saveButton': 'Save & Continue',
        'tour.profileStep.title': 'Step 3: Add your profile URLs',
        'tour.profileStep.bvText': 'Badminton Vlaanderen: Open your profile, and go to the tab with all your matches.',
        'tour.profileStep.toernooiText': 'Toernooi.nl: Go to your profile, and open the rating page. (If you can\'t find your profile, make sure the icon next to the search bar is a shuttle.)',
        'tour.profileStep.afterAddingText': 'After adding both URLs, click Next.',
        'tour.profileStep.linkBvText': 'Open BadmintonVlaanderen',
        'tour.profileStep.linkToernooiText': 'Open Toernooi.nl',
        'tour.profileStep.linkLfbbText': 'Open lfbb.tournamentsoftware.com',
        'tour.profileStep.ps': 'PS. In the settings icon ⚙️ above, you can always paste your profile URL’s.',
        'tour.scrapeStep.title': 'Step 4: Scrape your matches',
        'tour.scrapeStep.content': 'Now click the <strong>Scrape All</strong> button. This will fetch your match history from both profiles and add them to your dashboard.',
        'tour.editStep.title': 'Step 5: Understanding older matches',
        'tour.editStep.content': 'Matches older than 1 year may show incorrect player/opponent levels because we don’t know your level at that time. You can <strong>edit</strong> any cell directly in the table to correct the levels.',
        'tour.finishStep.title': '🎉 You’re all set!',
        'tour.finishStep.content': 'Explore the charts, run simulations, and track your progress. If you want to see this tooltip again, look in the settings menu. Have fun!',
        'tour.skip': 'Skip tour',
        'tour.prev': 'Previous',
        'tour.next': 'Next',
        'tour.finish': 'Finish',
        'tour.nameStep.optional': 'optional',

        'error.loadingData': 'Error loading data. Please refresh.',
        'error.exportFailed': 'Error exporting data',
        'error.importFailed': 'Error reading CSV file',
        'error.invalidDate': 'Invalid date format',
        'error.invalidScore': 'Invalid score format',
        'error.invalidRank': 'Rank must be between 1-12',
        'error.noData': 'No data to export',
        'error.noMatchesFound': 'No matches found',
        'error.forSelectedYear': 'for selected year',
        'error.csvOnly': 'Please select a CSV file',
        'error.fileTooLarge': 'File too large (max 5MB)',
        'error.errorsFound': 'errors',
        'error.calculatingPaths': 'Error calculating paths',
        'error.tryAgainLater': 'Please try again later.',

        'success.saved': 'Match saved successfully!',
        'success.imported': 'matches imported',
        'success.exported': 'Export completed',
        'success.deleted': 'Match deleted',
        'success.cleared': 'All data cleared.',

        'confirm.deleteMatch': 'Delete this match? This cannot be undone.',
        'confirm.clearAll': 'Delete all data? This cannot be undone.',

        'month.jan': 'Jan', 'month.feb': 'Feb', 'month.mar': 'Mar', 'month.apr': 'Apr',
        'month.may': 'May', 'month.jun': 'Jun', 'month.jul': 'Jul', 'month.aug': 'Aug',
        'month.sep': 'Sep', 'month.oct': 'Oct', 'month.nov': 'Nov', 'month.dec': 'Dec'
    },

    // ----------------------------------------------------
    // DUTCH
    // ----------------------------------------------------
    nl: {
        'dashboard.title': 'Jouw Badminton Analyse',
        'dashboard.totalMatches': 'Totaal Wedstrijden',
        'dashboard.recentMatches': 'Laatste 52 weken',
        'dashboard.simulations': 'Simulaties',
        'dashboard.expectedLevel': 'Verwacht Niveau',
        'dashboard.currentRankingPoints': 'Huidige Ranking Punten',
        'dashboard.winLossChart': 'Winst/Verlies ratio',
        'dashboard.trophies': 'Trofeeën',

        'chart.evolution': 'Evolutie ranking score',
        'chart.winLoss': 'Winst/Verlies ratio',
        'chart.margins': 'Score Marges',
        'chart.shotPercentage': 'Puntpercentage',

        'discipline.tooltip.singles': 'Enkel',
        'discipline.tooltip.doubles': 'Dubbel',
        'discipline.tooltip.mixed': 'Gemengd',

        'button.import': 'Importeren',
        'button.export': 'Exporteren',
        'button.clearAll': 'Alles Wissen',
        'button.close': 'Sluiten',
        'button.calculate': 'Berekenen',
        'button.save': 'Opslaan',
        'button.delete': 'Verwijderen',
        'button.resetSettings': 'Instellingen resetten',
        'button.loadCompare': 'Laden & Vergelijken',

        'profile.badmintonVlaanderen': 'badminton.vlaanderen Profiel URL',
        'profile.toernooi': 'toernooi.nl Profiel URL',
        'profile.badmintonHint': 'Je openbare profiel URL van badminton.vlaanderen',
        'profile.toernooiHint': 'Je openbare profiel URL van toernooi.nl',
        'profile.note': 'Opmerking: Deze profielen worden gebruikt voor toekomstige automatische wedstrijd scraping.',
        'profile.scrapingProfiles': 'Scraping Profielen',

        'settings.language': 'Taal',
        'settings.csvFormat': 'CSV Formaat',
        'settings.actions': 'Acties',
        'settings.reset': 'Instellingen resetten',

        'table.date': 'Datum',
        'table.type': 'Type',
        'table.myLevel': 'Mijn Niv',
        'table.opponentLevel': 'Tegen Niv',
        'table.opponent': 'Tegenstander',
        'table.score': 'Score (Tijd)',
        'table.duration': 'Min',
        'table.points': 'Nieuwe Ranking Punten',
        'table.extraPoints': 'Extra Punten',
        'table.actions': 'Acties',
        'table.ourTeam': 'Ons Team',
        'table.ourLvls': 'Onze Niv',
        'table.oppLvls': 'Tegen Niv',
        'table.opponents': 'Tegenstanders',
        'table.total': 'Totaal',

        'table.filterAll': 'Alle',
        'table.filterAllYears': 'Alle Jaren',
        'table.filterWin': 'Winst',
        'table.filterLoss': 'Verlies',
        'table.filterValid': '✅ Geldig',
        'table.filterDate': 'Datum',
        'table.filterType': 'Fase/Toernooi',
        'table.filterMyLvl': 'Mijn Niv',
        'table.filterOppLvl': 'Tegen Niv',
        'table.filterOpponent': 'Zoek spelers...',
        'table.filterResult': 'Winst/verlies',
        'table.filterYear': 'Jaar',
        'table.filterTeammates': 'Zoek teamgenoten...',
        'table.filterOurLevels': 'Onze Niv',
        'table.filterOppLevels': 'Tegen Niv',
        'table.filterOpponentsDoubles': 'Zoek tegenstanders...',
        'table.filterResultDoubles': 'Winst/Verlies',

        'simulation.quick': 'Snelle "Wat Als" Calculator',
        'simulation.path': 'Pad naar Niveau X',
        'simulation.compare': 'Vergelijk Speler',
        'simulation.calculateDesc': 'Simuleer wat er gebeurt als je wedstrijden wint tegen bepaalde tegenstanders.',
        'simulation.pathDesc': 'Bekijk wat er nodig is om je doel niveau te bereiken.',
        'simulation.ifWin': 'Als ik win',
        'simulation.matchesAgainst': 'wedstrijd(en) tegen niveau',
        'simulation.and': 'en',
        'simulation.addLevel': '+ Voeg ander tegenstandersniveau toe',
        'simulation.result': 'Simulatie:',
        'simulation.from': 'Van:',
        'simulation.to': 'Naar:',
        'simulation.remainLevel': 'Je zou op niveau blijven',
        'simulation.reachLevel': 'Je zou niveau bereiken',
        'simulation.fromLevel': 'van niveau',
        'simulation.pointsQualify': 'Je punten',
        'simulation.butAlready': 'zouden kwalificeren voor niveau',
        'simulation.alreadyHigher': "maar je zit al op een hoger niveau",
        'simulation.needPoints': 'Je hebt nodig',
        'simulation.morePoints': 'meer punten',
        'simulation.consecutiveWins': 'Aantal opeenvolgende overwinningen nodig:',
        'simulation.eachWinGives': 'Elke overwinning geeft',
        'simulation.points': 'punten',
        'simulation.totalPointsAdded': 'Totaal punten toegevoegd',
        'simulation.newAverage': 'Nieuw gemiddelde',
        'simulation.efficiency': 'Efficiëntie',
        'simulation.ofPointsContribute': 'van de punten dragen bij aan niveau stijging',
        'simulation.toReachLevel': 'Om niveau te bereiken',
        'simulation.againstLevel': 'tegen niveau',
        'simulation.opponents': 'tegenstanders',
        'simulation.win': 'overwinning',
        'simulation.wins': 'overwinningen',
        'simulation.unableCalculate': 'Kan geen haalbare route berekenen naar niveau',
        'simulation.moreThan100Wins': 'De simulatie suggereert dat het meer dan 100 overwinningen zou kosten om dit niveau te bereiken vanaf je huidige positie.',
        'simulation.alreadyThere': 'Je bent er al!',
        'simulation.enoughPoints': 'Je hebt',
        'simulation.pointsForLevel': 'punten, wat genoeg is voor niveau',
        'simulation.alreadyEnough': 'Je hebt al genoeg punten voor niveau',
        'simulation.current': 'Huidig',
        'simulation.neededForLevel': 'Nodig voor niveau',
        'simulation.currentPoints': 'Huidige punten',
        'simulation.eachWinAgainst': 'Elke overwinning tegen niveau',
        'simulation.gives': 'geeft',
        'simulation.needConsecutive': 'Je hebt nodig',
        'simulation.consecutiveWin': 'opeenvolgende overwinning',
        'simulation.afterWins': 'Na',
        'simulation.yourAverage': 'zou je gemiddelde zijn',
        'simulation.tip': 'Tip',
        'simulation.beatingLevel': 'Verslaan van niveau',
        'simulation.ptsEach': 'punten elk',
        'simulation.requireOnly': 'zou slechts nodig hebben',
        'simulation.unableCalculateWins': 'Kan niet exact berekenen hoeveel overwinningen nodig zijn.',
        'simulation.note': 'Opmerking:',
        'simulation.calculationNote': 'Berekeningen zijn gebaseerd op je huidige ranking venster (laatste 20 geldige wedstrijden).',

        'simulation.compareTitle': 'Vergelijk speler',
        'simulation.compareDesc': 'Overlay de ranking evolutie van een andere speler op jouw grafiek.',
        'simulation.savedPlayers': 'Opgeslagen spelers',
        'simulation.noSavedPlayers': 'Nog geen opgeslagen spelers.',
        'simulation.addNewRival': 'Voeg een nieuwe rivaal toe',
        'simulation.nameLabel': 'Naam',
        'simulation.urlLabel': 'Toernooi.nl Profiel URL',
        'simulation.urlHint': 'Link moet een toernooi.nl profiel rating pagina zijn.',
        'simulation.badmintonUrlLabel': 'Badminton Vlaanderen Profiel URL',
        'simulation.badmintonUrlHint': 'Optioneel: voeg een badminton.vlaanderen profiel toe om die wedstrijden mee te nemen.',
        'simulation.saveCheckbox': 'Opslaan voor toekomstige sessies',
        'simulation.loadButton': 'Opslaan',

        'trophies.firstPlace': '1e plaats',
        'trophies.secondPlace': '2e plaats',
        'trophies.thirdFourthPlace': '3/4e plaats',

        'result.levelUp': '🎉 Niveau Omhoog!',
        'result.noChange': 'Geen niveau verandering',
        'result.alreadyAtLevel': 'Al op niveau',
        'result.pointsBreakdown': 'Punten overzicht:',
        'result.totalPointsAdded': 'Totaal punten toegevoegd:',

        'tooltip.csvImport': 'CSV Import Instructies',
        'tooltip.csvSinglesFormat': 'Enkelspel Formaat',
        'tooltip.csvDoublesMixedFormat': 'Dubbel/Gemengd Formaat',
        'tooltip.csvSinglesExample': '14/12/24;John Doe;12;11;21-19 21-15;0;;IC Toernooi;45',
        'tooltip.csvDoublesExample': '14/12/24;Jane Smith;D;12;11;John Doe;11;Mike Johnson;12;21-19 21-15;Club Toernooi;60',
        'tooltip.csvNoteHeader': 'Opmerking:',
        'tooltip.csvNoteColumns': 'Kolommen moeten gescheiden zijn door puntkomma\'s (;). De eerste rij moet headers bevatten.',
        'tooltip.csvExtraNote': 'Bij exporteren worden automatisch geschraapte tijd en extra type informatie toegevoegd in extra kolommen.',

        'points.tooltip.contributed.win': 'Deze winst voegde {points} punten toe aan je gemiddelde.',
        'points.tooltip.contributed.loss': 'Dit verlies voegde 0 punten toe aan je gemiddelde.',
        'points.tooltip.changed': 'Je gemiddelde veranderde met {change} (van {prev} naar {new}).',
        'points.tooltip.replaced': 'Het verving een {result} tegen niveau {level} (ter waarde van {removedPoints} punten).',
        'points.tooltip.excluded': 'Deze wedstrijd is handmatig uitgesloten van ranking.',
        'points.tooltip.invalid': 'Deze wedstrijd is ongeldig voor ranking (niveauverschil >1).',
        'points.tooltip.win': 'winst',
        'points.tooltip.loss': 'verlies',
        'points.tooltip.contributed': 'Deze wedstrijd droeg {points} punten bij aan je gemiddelde.',
        'points.tooltip.notIncluded': 'Deze wedstrijd is niet meegenomen in je huidige ranking gemiddelde.',
        'points.tooltip.afterMatch': 'Na deze wedstrijd is je gemiddelde {points}.',
        'points.tooltip.progression': 'Puntberekening:',
        'points.tooltip.finalAverage': 'Eindgemiddelde:',

        'tour.languageStep.title': 'Stap 1: Kies taal',
        'tour.languageStep.content': 'Kies je voorkeurstaal:',
        'tour.languageStep.saveButton': 'Opslaan & Doorgaan',
        'tour.nameStep.title': 'Stap 2: Je naam',
        'tour.nameStep.content': 'Personaliseer je dashboard door je voornaam in te vullen:',
        'tour.nameStep.namePlaceholder': 'Je voornaam',
        'tour.nameStep.saveButton': 'Opslaan & Doorgaan',
        'tour.profileStep.title': 'Stap 3: Voeg je profiel-URL’s toe',
        'tour.profileStep.bvText': 'Badminton Vlaanderen: Open je profiel en ga naar het tabblad met al je wedstrijden.',
        'tour.profileStep.toernooiText': 'Toernooi.nl: Ga naar je profiel en open de ratingpagina. (Als je je profiel niet kunt vinden, zorg er dan voor dat het pictogram naast de zoekbalk een shuttle is.)',
        'tour.profileStep.afterAddingText': 'Klik op Volgende nadat je beide URL’s hebt toegevoegd.',
        'tour.profileStep.linkBvText': 'Open BadmintonVlaanderen',
        'tour.profileStep.linkToernooiText': 'Open Toernooi.nl',
        'tour.profileStep.linkLfbbText': 'Open lfbb.tournamentsoftware.com',
        'tour.profileStep.ps': 'PS. In het instellingenpictogram ⚙️ hierboven kun je altijd je profiel-URL’s plakken.',
        'tour.scrapeStep.title': 'Stap 4: Scrap je wedstrijden',
        'tour.scrapeStep.content': 'Klik nu op de knop <strong>Scrape All</strong>. Dit haalt je wedstrijdgeschiedenis van beide profielen op en voegt ze toe aan je dashboard.',
        'tour.editStep.title': 'Stap 5: Oudere wedstrijden begrijpen',
        'tour.editStep.content': 'Wedstrijden ouder dan 1 jaar kunnen onjuiste speler/tegenstander niveaus tonen, omdat we je niveau op dat moment niet kennen. Je kunt elke cel <strong>bewerken</strong> in de tabel om de niveaus te corrigeren.',
        'tour.finishStep.title': '🎉 Je bent helemaal klaar!',
        'tour.finishStep.content': 'Verken de grafieken, voer simulaties uit en volg je vooruitgang. Als je deze tooltip opnieuw wilt zien, kijk dan in het instellingenmenu. Veel plezier!',
        'tour.skip': 'Tour overslaan',
        'tour.prev': 'Vorige',
        'tour.next': 'Volgende',
        'tour.finish': 'Afronden',
        'tour.nameStep.optional': 'optioneel',

        'error.loadingData': 'Fout bij laden data. Herlaad de pagina.',
        'error.exportFailed': 'Fout bij exporteren data',
        'error.importFailed': 'Fout bij lezen CSV bestand',
        'error.invalidDate': 'Ongeldig datumformaat',
        'error.invalidScore': 'Ongeldig scoreformaat',
        'error.invalidRank': 'Niveau moet tussen 1-12 zijn',
        'error.noData': 'Geen data om te exporteren',
        'error.noMatchesFound': 'Geen wedstrijden gevonden',
        'error.forSelectedYear': 'voor geselecteerd jaar',
        'error.csvOnly': 'Selecteer een CSV bestand',
        'error.fileTooLarge': 'Bestand te groot (max 5MB)',
        'error.errorsFound': 'fouten',
        'error.calculatingPaths': 'Fout bij berekenen routes',
        'error.tryAgainLater': 'Probeer het later opnieuw.',

        'success.saved': 'Wedstrijd succesvol opgeslagen!',
        'success.imported': 'wedstrijden geïmporteerd',
        'success.exported': 'Export voltooid',
        'success.deleted': 'Wedstrijd verwijderd',
        'success.cleared': 'Alle data gewist.',

        'confirm.deleteMatch': 'Deze wedstrijd verwijderen? Dit kan niet ongedaan worden gemaakt.',
        'confirm.clearAll': 'Alle data verwijderen? Dit kan niet ongedaan worden gemaakt.',

        'month.jan': 'Jan', 'month.feb': 'Feb', 'month.mar': 'Mrt', 'month.apr': 'Apr',
        'month.may': 'Mei', 'month.jun': 'Jun', 'month.jul': 'Jul', 'month.aug': 'Aug',
        'month.sep': 'Sep', 'month.oct': 'Okt', 'month.nov': 'Nov', 'month.dec': 'Dec'
    },

    // ----------------------------------------------------
    // FRENCH
    // ----------------------------------------------------
    fr: {
        'dashboard.title': 'Votre Analyse Badminton',
        'dashboard.totalMatches': 'Total Matchs',
        'dashboard.recentMatches': 'Dernières 52 semaines',
        'dashboard.simulations': 'Simulations',
        'dashboard.expectedLevel': 'Niveau Attendu',
        'dashboard.currentRankingPoints': 'Points Classement Actuels',
        'dashboard.winLossChart': 'Ratio Victoires/Défaites',
        'dashboard.trophies': 'Trophées',

        'chart.evolution': 'Évolution score classement',
        'chart.winLoss': 'Ratio Victoires/Défaites',
        'chart.margins': 'Marges de Score',
        'chart.shotPercentage': 'Pourcentage de points',

        'discipline.tooltip.singles': 'Simple',
        'discipline.tooltip.doubles': 'Double',
        'discipline.tooltip.mixed': 'Mixte',

        'button.import': 'Importer',
        'button.export': 'Exporter',
        'button.clearAll': 'Tout Effacer',
        'button.close': 'Fermer',
        'button.calculate': 'Calculer',
        'button.save': 'Enregistrer',
        'button.delete': 'Supprimer',
        'button.resetSettings': 'Réinitialiser paramètres',
        'button.loadCompare': 'Charger & Comparer',

        'profile.badmintonVlaanderen': 'URL du profil badminton.vlaanderen',
        'profile.toernooi': 'URL du profil toernooi.nl',
        'profile.badmintonHint': 'Votre URL de profil public sur badminton.vlaanderen',
        'profile.toernooiHint': 'Votre URL de profil public sur toernooi.nl',
        'profile.note': 'Remarque : Ces profils seront utilisés pour le scraping automatique futur des matchs.',
        'profile.scrapingProfiles': 'Profils de scraping',

        'settings.language': 'Langue',
        'settings.csvFormat': 'Format CSV',
        'settings.actions': 'Actions',
        'settings.reset': 'Réinitialiser paramètres',

        'table.date': 'Date',
        'table.type': 'Type',
        'table.myLevel': 'Mon Niv',
        'table.opponentLevel': 'Niv Adv',
        'table.opponent': 'Adversaire',
        'table.score': 'Score (Temps)',
        'table.duration': 'Min',
        'table.points': 'Nouveaux Points Classement',
        'table.extraPoints': 'Points Extra',
        'table.actions': 'Actions',
        'table.ourTeam': 'Notre Équipe',
        'table.ourLvls': 'Nos Niv',
        'table.oppLvls': 'Niv Adv',
        'table.opponents': 'Adversaires',
        'table.total': 'Total',

        'table.filterAll': 'Tous',
        'table.filterAllYears': 'Toutes Années',
        'table.filterWin': 'Victoire',
        'table.filterLoss': 'Défaite',
        'table.filterValid': '✅ Valide',
        'table.filterDate': 'Date',
        'table.filterType': 'Phase/Tournoi',
        'table.filterMyLvl': 'Mon Niv',
        'table.filterOppLvl': 'Niv Adv',
        'table.filterOpponent': 'Rechercher joueurs...',
        'table.filterResult': 'Victoire/défaite',
        'table.filterYear': 'Année',
        'table.filterTeammates': 'Rechercher coéquipiers...',
        'table.filterOurLevels': 'Nos Niv',
        'table.filterOppLevels': 'Niv Adv',
        'table.filterOpponentsDoubles': 'Rechercher adversaires...',
        'table.filterResultDoubles': 'Victoire/Défaite',

        'simulation.quick': 'Calculatrice Rapide "Et Si"',
        'simulation.path': 'Chemin vers Niveau X',
        'simulation.compare': 'Comparer Joueur',
        'simulation.calculateDesc': 'Simulez ce qui se passe si vous gagnez des matchs contre certains adversaires.',
        'simulation.pathDesc': 'Voyez ce qu\'il faut pour atteindre votre niveau cible.',
        'simulation.ifWin': 'Si je gagne',
        'simulation.matchesAgainst': 'match(s) contre niveau',
        'simulation.and': 'et',
        'simulation.addLevel': '+ Ajouter autre niveau adversaire',
        'simulation.result': 'Simulation:',
        'simulation.from': 'De:',
        'simulation.to': 'À:',
        'simulation.remainLevel': 'Vous resteriez au niveau',
        'simulation.reachLevel': 'Vous atteindriez le niveau',
        'simulation.fromLevel': 'du niveau',
        'simulation.pointsQualify': 'Vos points',
        'simulation.butAlready': 'vous qualifieraient pour le niveau',
        'simulation.alreadyHigher': "mais vous êtes déjà à un niveau supérieur",
        'simulation.needPoints': 'Vous avez besoin de',
        'simulation.morePoints': 'points de plus',
        'simulation.consecutiveWins': 'Victoires consécutives nécessaires:',
        'simulation.eachWinGives': 'Chaque victoire donne',
        'simulation.points': 'points',
        'simulation.totalPointsAdded': 'Total des points ajoutés',
        'simulation.newAverage': 'Nouvelle moyenne',
        'simulation.efficiency': 'Efficacité',
        'simulation.ofPointsContribute': 'des points contribuent à la montée de niveau',
        'simulation.toReachLevel': 'Pour atteindre le niveau',
        'simulation.againstLevel': 'contre le niveau',
        'simulation.opponents': 'adversaires',
        'simulation.win': 'victoire',
        'simulation.wins': 'victoires',
        'simulation.unableCalculate': 'Impossible de calculer un chemin réalisable vers le niveau',
        'simulation.moreThan100Wins': 'La simulation suggère qu\'il faudrait plus de 100 victoires pour atteindre ce niveau depuis votre position actuelle.',
        'simulation.alreadyThere': 'Vous y êtes déjà!',
        'simulation.enoughPoints': 'Vous avez',
        'simulation.pointsForLevel': 'points, ce qui est suffisant pour le niveau',
        'simulation.alreadyEnough': 'Vous avez déjà assez de points pour le niveau',
        'simulation.current': 'Actuel',
        'simulation.neededForLevel': 'Nécessaire pour le niveau',
        'simulation.currentPoints': 'Points actuels',
        'simulation.eachWinAgainst': 'Chaque victoire contre niveau',
        'simulation.gives': 'donne',
        'simulation.needConsecutive': 'Vous avez besoin de',
        'simulation.consecutiveWin': 'victoire consécutive',
        'simulation.afterWins': 'Après',
        'simulation.yourAverage': 'votre moyenne serait',
        'simulation.tip': 'Astuce',
        'simulation.beatingLevel': 'Battre le niveau',
        'simulation.ptsEach': 'points chacun',
        'simulation.requireOnly': 'nécessiterait seulement',
        'simulation.unableCalculateWins': 'Impossible de calculer exactement le nombre de victoires nécessaires.',
        'simulation.note': 'Note:',
        'simulation.calculationNote': 'Les calculs sont basés sur votre fenêtre de classement actuelle (derniers 20 matchs valides).',

        'simulation.compareTitle': 'Comparer joueur',
        'simulation.compareDesc': 'Superposer l\'évolution du classement d\'un autre joueur sur votre graphique.',
        'simulation.savedPlayers': 'Joueurs enregistrés',
        'simulation.noSavedPlayers': 'Aucun joueur enregistré pour le moment.',
        'simulation.addNewRival': 'Ajouter un nouveau rival',
        'simulation.nameLabel': 'Nom',
        'simulation.urlLabel': 'URL du profil toernooi.nl',
        'simulation.urlHint': 'Le lien doit être une page de profil rating de toernooi.nl.',
        'simulation.badmintonUrlLabel': 'URL du profil Badminton Vlaanderen',
        'simulation.badmintonUrlHint': 'Optionnel : ajoutez un profil badminton.vlaanderen pour inclure ces matchs.',
        'simulation.saveCheckbox': 'Enregistrer pour les futures sessions',
        'simulation.loadButton': 'Sauvegarder',

        'trophies.firstPlace': '1ère place',
        'trophies.secondPlace': '2ème place',
        'trophies.thirdFourthPlace': '3/4ème place',

        'result.levelUp': '🎉 Niveau Supérieur!',
        'result.noChange': 'Pas de changement de niveau',
        'result.alreadyAtLevel': 'Déjà au niveau',
        'result.pointsBreakdown': 'Détail des points:',
        'result.totalPointsAdded': 'Total points ajoutés:',

        'tooltip.csvImport': 'Instructions Import CSV',
        'tooltip.csvSinglesFormat': 'Format Simple',
        'tooltip.csvDoublesMixedFormat': 'Format Double/Mixte',
        'tooltip.csvSinglesExample': '14/12/24;John Doe;12;11;21-19 21-15;0;;IC Tournoi;45',
        'tooltip.csvDoublesExample': '14/12/24;Jane Smith;D;12;11;John Doe;11;Mike Johnson;12;21-19 21-15;Club Tournoi;60',
        'tooltip.csvNoteHeader': 'Note:',
        'tooltip.csvNoteColumns': 'Les colonnes doivent être séparées par des points-virgules (;). La première ligne doit contenir les en-têtes.',
        'tooltip.csvExtraNote': 'Lors de l\'exportation, le système inclut automatiquement le temps récupéré et les informations de type supplémentaire dans des colonnes supplémentaires.',

        'points.tooltip.contributed.win': 'Cette victoire a ajouté {points} points à votre moyenne.',
        'points.tooltip.contributed.loss': 'Cette défaite a ajouté 0 point à votre moyenne.',
        'points.tooltip.changed': 'Votre moyenne a changé de {change} (de {prev} à {new}).',
        'points.tooltip.replaced': 'Elle a remplacé un {result} contre niveau {level} (valant {removedPoints} points).',
        'points.tooltip.excluded': 'Ce match a été manuellement exclu du classement.',
        'points.tooltip.invalid': 'Ce match est invalide pour le classement (écart de niveau >1).',
        'points.tooltip.win': 'victoire',
        'points.tooltip.loss': 'défaite',
        'points.tooltip.contributed': 'Ce match a contribué {points} points à votre moyenne.',
        'points.tooltip.notIncluded': 'Ce match n\'a pas été inclus dans votre moyenne de classement actuelle.',
        'points.tooltip.afterMatch': 'Après ce match, votre moyenne est de {points}.',
        'points.tooltip.progression': 'Calcul des points:',
        'points.tooltip.finalAverage': 'Moyenne finale:',

        'tour.languageStep.title': 'Étape 1 : Choisissez la langue',
        'tour.languageStep.content': 'Choisissez votre langue préférée :',
        'tour.languageStep.saveButton': 'Enregistrer & Continuer',
        'tour.nameStep.title': 'Étape 2 : Votre prénom',
        'tour.nameStep.content': 'Pour personnaliser votre tableau de bord, entrez votre prénom :',
        'tour.nameStep.namePlaceholder': 'Votre prénom',
        'tour.nameStep.saveButton': 'Enregistrer & Continuer',
        'tour.profileStep.title': 'Étape 3 : Ajoutez vos URL de profil',
        'tour.profileStep.bvText': 'Badminton Vlaanderen : Ouvrez votre profil et allez dans l’onglet avec tous vos matchs.',
        'tour.profileStep.toernooiText': 'Toernooi.nl : Allez sur votre profil et ouvrez la page de classement. (Si vous ne trouvez pas votre profil, assurez-vous que l’icône à côté de la barre de recherche est un volant.)',
        'tour.profileStep.afterAddingText': 'Après avoir ajouté les deux URL, cliquez sur Suivant.',
        'tour.profileStep.linkBvText': 'Ouvrir BadmintonVlaanderen',
        'tour.profileStep.linkToernooiText': 'Ouvrir Toernooi.nl',
        'tour.profileStep.linkLfbbText': 'Ouvrir lfbb.tournamentsoftware.com',
        'tour.profileStep.ps': 'PS. Dans l’icône des paramètres ⚙️ ci‑dessus, vous pouvez toujours coller vos URL de profil.',
        'tour.scrapeStep.title': 'Étape 4 : Récupérez vos matchs',
        'tour.scrapeStep.content': 'Cliquez maintenant sur le bouton <strong>Scrape All</strong>. Cela récupérera votre historique de matchs à partir des deux profils et les ajoutera à votre tableau de bord.',
        'tour.editStep.title': 'Étape 5 : Comprendre les matchs plus anciens',
        'tour.editStep.content': 'Les matchs de plus d’un an peuvent afficher des niveaux de joueur/adversaire incorrects car nous ne connaissons pas votre niveau à cette époque. Vous pouvez <strong>modifier</strong> n’importe quelle cellule directement dans le tableau pour corriger les niveaux.',
        'tour.finishStep.title': '🎉 Vous êtes prêt !',
        'tour.finishStep.content': 'Explorez les graphiques, lancez des simulations et suivez vos progrès. Si vous souhaitez revoir cette info-bulle, cherchez-la dans le menu des paramètres. Amusez-vous bien !',
        'tour.skip': 'Ignorer la visite',
        'tour.prev': 'Précédent',
        'tour.next': 'Suivant',
        'tour.finish': 'Terminer',
        'tour.nameStep.optional': 'facultatif',

        'error.loadingData': 'Erreur chargement données. Rechargez la page.',
        'error.exportFailed': 'Erreur exportation données',
        'error.importFailed': 'Erreur lecture fichier CSV',
        'error.invalidDate': 'Format date invalide',
        'error.invalidScore': 'Format score invalide',
        'error.invalidRank': 'Le niveau doit être entre 1-12',
        'error.noData': 'Pas de données à exporter',
        'error.noMatchesFound': 'Aucun match trouvé',
        'error.forSelectedYear': 'pour l\'année sélectionnée',
        'error.csvOnly': 'Veuillez sélectionner un fichier CSV',
        'error.fileTooLarge': 'Fichier trop volumineux (max 5MB)',
        'error.errorsFound': 'erreurs',
        'error.calculatingPaths': 'Erreur calcul des chemins',
        'error.tryAgainLater': 'Veuillez réessayer plus tard.',

        'success.saved': 'Match enregistré avec succès!',
        'success.imported': 'matchs importés',
        'success.exported': 'Export terminé',
        'success.deleted': 'Match supprimé',
        'success.cleared': 'Toutes données effacées.',

        'confirm.deleteMatch': 'Supprimer ce match? Cette action ne peut pas être annulée.',
        'confirm.clearAll': 'Supprimer toutes les données? Cette action ne peut pas être annulée.',

        'month.jan': 'Jan', 'month.feb': 'Fév', 'month.mar': 'Mar', 'month.apr': 'Avr',
        'month.may': 'Mai', 'month.jun': 'Juin', 'month.jul': 'Juil', 'month.aug': 'Août',
        'month.sep': 'Sep', 'month.oct': 'Oct', 'month.nov': 'Nov', 'month.dec': 'Déc'
    },

    // ----------------------------------------------------
    // GERMAN
    // ----------------------------------------------------
    de: {
        'dashboard.title': 'Ihre Badminton Analyse',
        'dashboard.totalMatches': 'Gesamtspiele',
        'dashboard.recentMatches': 'Letzte 52 Wochen',
        'dashboard.simulations': 'Simulationen',
        'dashboard.expectedLevel': 'Erwartetes Niveau',
        'dashboard.currentRankingPoints': 'Aktuelle Ranglistenpunkte',
        'dashboard.winLossChart': 'Gewinn/Verlust Verhältnis',
        'dashboard.trophies': 'Trophäen',

        'chart.evolution': 'Entwicklung Ranking-Punkte',
        'chart.winLoss': 'Gewinn/Verlust Verhältnis',
        'chart.margins': 'Ergebnis Ränder',
        'chart.shotPercentage': 'Punktprozentsatz',

        'discipline.tooltip.singles': 'Einzel',
        'discipline.tooltip.doubles': 'Doppel',
        'discipline.tooltip.mixed': 'Mixed',

        'button.import': 'Importieren',
        'button.export': 'Exportieren',
        'button.clearAll': 'Alles löschen',
        'button.close': 'Schließen',
        'button.calculate': 'Berechnen',
        'button.save': 'Speichern',
        'button.delete': 'Löschen',
        'button.resetSettings': 'Einstellungen zurücksetzen',
        'button.loadCompare': 'Laden & Vergleichen',

        'profile.badmintonVlaanderen': 'badminton.vlaanderen Profil-URL',
        'profile.toernooi': 'toernooi.nl Profil-URL',
        'profile.badmintonHint': 'Deine öffentliche Profil-URL von badminton.vlaanderen',
        'profile.toernooiHint': 'Deine öffentliche Profil-URL von toernooi.nl',
        'profile.note': 'Hinweis: Diese Profile werden für zukünftiges automatisches Wettkampf-Scraping verwendet.',
        'profile.scrapingProfiles': 'Scraping-Profile',

        'settings.language': 'Sprache',
        'settings.csvFormat': 'CSV-format',
        'settings.actions': 'Aktionen',
        'settings.reset': 'Einstellungen zurücksetzen',

        'table.date': 'Datum',
        'table.type': 'Typ',
        'table.myLevel': 'Mein Niv',
        'table.opponentLevel': 'Gegner Niv',
        'table.opponent': 'Gegner',
        'table.score': 'Ergebnis (Zeit)',
        'table.duration': 'Min',
        'table.points': 'Neue Ranglistenpunkte',
        'table.extraPoints': 'Extrapunkte',
        'table.actions': 'Aktionen',
        'table.ourTeam': 'Unser Team',
        'table.ourLvls': 'Unsere Niv',
        'table.oppLvls': 'Gegner Niv',
        'table.opponents': 'Gegner',
        'table.total': 'Gesamt',

        'table.filterAll': 'Alle',
        'table.filterAllYears': 'Alle Jahre',
        'table.filterWin': 'Gewonnen',
        'table.filterLoss': 'Verloren',
        'table.filterValid': '✅ Gültig',
        'table.filterDate': 'Datum',
        'table.filterType': 'Phase/Turnier',
        'table.filterMyLvl': 'Mein Niv',
        'table.filterOppLvl': 'Gegner Niv',
        'table.filterOpponent': 'Spieler suchen...',
        'table.filterResult': 'Gewinn/Verlust',
        'table.filterYear': 'Jahr',
        'table.filterTeammates': 'Teammitglieder suchen...',
        'table.filterOurLevels': 'Unsere Niv',
        'table.filterOppLevels': 'Gegner Niv',
        'table.filterOpponentsDoubles': 'Gegner suchen...',
        'table.filterResultDoubles': 'Gewinn/Verlust',

        'simulation.quick': 'Schneller "Was-Wäre-Wenn" Rechner',
        'simulation.path': 'Weg zu Niveau X',
        'simulation.compare': 'Spieler vergleichen',
        'simulation.calculateDesc': 'Simulieren Sie, was passiert, wenn Sie Spiele gegen bestimmte Gegner gewinnen.',
        'simulation.pathDesc': 'Sehen Sie, was erforderlich ist, um Ihr Zielniveau zu erreichen.',
        'simulation.ifWin': 'Wenn ich gewinne',
        'simulation.matchesAgainst': 'Spiel(e) gegen Niveau',
        'simulation.and': 'und',
        'simulation.addLevel': '+ Weiteres Gegnerniveau hinzufügen',
        'simulation.result': 'Simulation:',
        'simulation.from': 'Von:',
        'simulation.to': 'Zu:',
        'simulation.remainLevel': 'Sie würden auf Stufe bleiben',
        'simulation.reachLevel': 'Sie würden Stufe erreichen',
        'simulation.fromLevel': 'von Stufe',
        'simulation.pointsQualify': 'Ihre Punkte',
        'simulation.butAlready': 'würden für Stufe qualifizieren',
        'simulation.alreadyHigher': "aber Sie sind bereits auf einer höheren Stufe",
        'simulation.needPoints': 'Sie brauchen',
        'simulation.morePoints': 'mehr Punkte',
        'simulation.consecutiveWins': 'Aufeinanderfolgende Siege benötigt:',
        'simulation.eachWinGives': 'Jeder Sieg gibt',
        'simulation.points': 'Punkte',
        'simulation.totalPointsAdded': 'Gesamtpunkte hinzugefügt',
        'simulation.newAverage': 'Neuer Durchschnitt',
        'simulation.efficiency': 'Effizienz',
        'simulation.ofPointsContribute': 'der Punkte tragen zum Stufenaufstieg bei',
        'simulation.toReachLevel': 'Um Stufe zu erreichen',
        'simulation.againstLevel': 'gegen Stufe',
        'simulation.opponents': 'Gegner',
        'simulation.win': 'Sieg',
        'simulation.wins': 'Siege',
        'simulation.unableCalculate': 'Kann keinen machbaren Weg zu Stufe berechnen',
        'simulation.moreThan100Wins': 'Die Simulation deutet darauf hin, dass es mehr als 100 Siege kosten würde, um diese Stufe von Ihrer aktuellen Position aus zu erreichen.',
        'simulation.alreadyThere': 'Sie sind schon da!',
        'simulation.enoughPoints': 'Sie haben',
        'simulation.pointsForLevel': 'Punkte, was für Stufe ausreicht',
        'simulation.alreadyEnough': 'Sie haben bereits genug Punkte für Stufe',
        'simulation.current': 'Aktuell',
        'simulation.neededForLevel': 'Benötigt für Stufe',
        'simulation.currentPoints': 'Aktuelle Punkte',
        'simulation.eachWinAgainst': 'Jeder Sieg gegen Stufe',
        'simulation.gives': 'gibt',
        'simulation.needConsecutive': 'Sie brauchen',
        'simulation.consecutiveWin': 'aufeinanderfolgenden Sieg',
        'simulation.afterWins': 'Nach',
        'simulation.yourAverage': 'Ihr Durchschnitt wäre',
        'simulation.tip': 'Tipp',
        'simulation.beatingLevel': 'Besiegen von Stufe',
        'simulation.ptsEach': 'Punkte jeweils',
        'simulation.requireOnly': 'würde nur benötigen',
        'simulation.unableCalculateWins': 'Kann nicht genau berechnen, wie viele Siege benötigt werden.',
        'simulation.note': 'Hinweis:',
        'simulation.calculationNote': 'Berechnungen basieren auf Ihrem aktuellen Ranking-Fenster (letzte 20 gültige Spiele).',

        'simulation.compareTitle': 'Spieler vergleichen',
        'simulation.compareDesc': 'Überlagern Sie die Ranking-Entwicklung eines anderen Spielers auf Ihrem Diagramm.',
        'simulation.savedPlayers': 'Gespeicherte Spieler',
        'simulation.noSavedPlayers': 'Noch keine gespeicherten Spieler.',
        'simulation.addNewRival': 'Neuen Rivalen hinzufügen',
        'simulation.nameLabel': 'Name',
        'simulation.urlLabel': 'toernooi.nl Profil-URL',
        'simulation.urlHint': 'Der Link muss eine toernooi.nl Profil-Bewertungsseite sein.',
        'simulation.badmintonUrlLabel': 'Badminton Vlaanderen Profil-URL',
        'simulation.badmintonUrlHint': 'Optional: Füge ein badminton.vlaanderen Profil hinzu, um diese Spiele einzubeziehen.',
        'simulation.saveCheckbox': 'Für zukünftige Sitzungen speichern',
        'simulation.loadButton': 'Speichern',

        'trophies.firstPlace': '1. Platz',
        'trophies.secondPlace': '2. Platz',
        'trophies.thirdFourthPlace': '3./4. Platz',

        'result.levelUp': '🎉 Niveau Aufstieg!',
        'result.noChange': 'Keine Niveauänderung',
        'result.alreadyAtLevel': 'Bereits auf Niveau',
        'result.pointsBreakdown': 'Punkteaufschlüsselung:',
        'result.totalPointsAdded': 'Gesamtpunkte hinzugefügt:',

        'tooltip.csvImport': 'CSV Import Anleitung',
        'tooltip.csvSinglesFormat': 'Einzel Format',
        'tooltip.csvDoublesMixedFormat': 'Doppel/Mixed Format',
        'tooltip.csvSinglesExample': '14/12/24;John Doe;12;11;21-19 21-15;0;;IC Turnier;45',
        'tooltip.csvDoublesExample': '14/12/24;Jane Smith;D;12;11;John Doe;11;Mike Johnson;12;21-19 21-15;Club Turnier;60',
        'tooltip.csvNoteHeader': 'Hinweis:',
        'tooltip.csvNoteColumns': 'Spalten müssen durch Semikolons (;) getrennt sein. Die erste Zeile sollte Überschriften enthalten.',
        'tooltip.csvExtraNote': 'Beim Exportieren fügt das System automatisch gescrapte Zeit und zusätzliche Typinformationen in zusätzlichen Spalten hinzu.',

        'points.tooltip.contributed.win': 'Dieser Sieg hat {points} Punkte zu Ihrem Durchschnitt hinzugefügt.',
        'points.tooltip.contributed.loss': 'Diese Niederlage hat 0 Punkte zu Ihrem Durchschnitt hinzugefügt.',
        'points.tooltip.changed': 'Ihr Durchschnitt änderte sich um {change} (von {prev} auf {new}).',
        'points.tooltip.replaced': 'Es ersetzte einen {result} gegen Stufe {level} (im Wert von {removedPoints} Punkten).',
        'points.tooltip.excluded': 'Dieses Spiel wurde manuell vom Ranking ausgeschlossen.',
        'points.tooltip.invalid': 'Dieses Spiel ist für das Ranking ungültig (Stufenunterschied >1).',
        'points.tooltip.win': 'Sieg',
        'points.tooltip.loss': 'Niederlage',
        'points.tooltip.contributed': 'Dieses Spiel hat {points} Punkte zu Ihrem Durchschnitt beigetragen.',
        'points.tooltip.notIncluded': 'Dieses Spiel wurde nicht in Ihren aktuellen Ranglistendurchschnitt einbezogen.',
        'points.tooltip.afterMatch': 'Nach diesem Spiel beträgt Ihr Durchschnitt {points}.',
        'points.tooltip.progression': 'Punkteberechnung:',
        'points.tooltip.finalAverage': 'Enddurchschnitt:',

        'tour.languageStep.title': 'Schritt 1: Sprache auswählen',
        'tour.languageStep.content': 'Wähle deine bevorzugte Sprache:',
        'tour.languageStep.saveButton': 'Speichern & Weiter',
        'tour.nameStep.title': 'Schritt 2: Dein Name',
        'tour.nameStep.content': 'Um dein Dashboard zu personalisieren, gib bitte deinen Vornamen ein:',
        'tour.nameStep.namePlaceholder': 'Dein Vorname',
        'tour.nameStep.saveButton': 'Speichern & Weiter',
        'tour.profileStep.title': 'Schritt 3: Füge deine Profil-URLs hinzu',
        'tour.profileStep.bvText': 'Badminton Vlaanderen: Öffne dein Profil und gehe zum Tab mit all deinen Spielen.',
        'tour.profileStep.toernooiText': 'Toernooi.nl: Gehe zu deinem Profil und öffne die Bewertungsseite. (Wenn du dein Profil nicht findest, stelle sicher, dass das Symbol neben der Suchleiste ein Shuttle ist.)',
        'tour.profileStep.afterAddingText': 'Nachdem du beide URLs hinzugefügt hast, klicke auf Weiter.',
        'tour.profileStep.linkBvText': 'Öffne BadmintonVlaanderen',
        'tour.profileStep.linkToernooiText': 'Öffne Toernooi.nl',
        'tour.profileStep.linkLfbbText': 'Öffne lfbb.tournamentsoftware.com',
        'tour.profileStep.ps': 'PS. Im Einstellungssymbol ⚙️ oben kannst du jederzeit deine Profil-URLs einfügen.',
        'tour.scrapeStep.title': 'Schritt 4: Spiele scrapen',
        'tour.scrapeStep.content': 'Klicke jetzt auf den <strong>Scrape All</strong>-Button. Dadurch wird deine Spielhistorie von beiden Profilen abgerufen und zu deinem Dashboard hinzugefügt.',
        'tour.editStep.title': 'Schritt 5: Ältere Spiele verstehen',
        'tour.editStep.content': 'Spiele, die älter als 1 Jahr sind, können falsche Spieler-/Gegner-Level anzeigen, weil wir dein damaliges Level nicht kennen. Du kannst <strong>jede Zelle</strong> direkt in der Tabelle bearbeiten, um die Level zu korrigieren.',
        'tour.finishStep.title': '🎉 Du bist startklar!',
        'tour.finishStep.content': 'Erkunde die Diagramme, führe Simulationen durch und verfolge deinen Fortschritt. Wenn du diesen Tooltip erneut sehen möchtest, schau im Einstellungsmenü nach. Viel Spaß!',
        'tour.skip': 'Tour überspringen',
        'tour.prev': 'Zurück',
        'tour.next': 'Weiter',
        'tour.finish': 'Beenden',
        'tour.nameStep.optional': 'optional',

        'error.loadingData': 'Fehler beim Laden der Daten. Bitte Seite neu laden.',
        'error.exportFailed': 'Fehler beim Exportieren der Daten',
        'error.importFailed': 'Fehler beim Lesen der CSV-Datei',
        'error.invalidDate': 'Ungültiges Datumsformat',
        'error.invalidScore': 'Ungültiges Ergebnisformat',
        'error.invalidRank': 'Niveau muss zwischen 1-12 sein',
        'error.noData': 'Keine Daten zum Exportieren',
        'error.noMatchesFound': 'Keine Spiele gefunden',
        'error.forSelectedYear': 'für das ausgewählte Jahr',
        'error.csvOnly': 'Bitte wählen Sie eine CSV-Datei',
        'error.fileTooLarge': 'Datei zu groß (max 5MB)',
        'error.errorsFound': 'Fehler',
        'error.calculatingPaths': 'Fehler beim Berechnen der Wege',
        'error.tryAgainLater': 'Bitte versuchen Sie es später erneut.',

        'success.saved': 'Spiel erfolgreich gespeichert!',
        'success.imported': 'Spiele importiert',
        'success.exported': 'Export abgeschlossen',
        'success.deleted': 'Spiel gelöscht',
        'success.cleared': 'Alle Daten gelöscht.',

        'confirm.deleteMatch': 'Dieses Spiel löschen? Dies kann nicht rückgängig gemacht werden.',
        'confirm.clearAll': 'Alle Daten löschen? Dies kann nicht rückgängig gemacht werden.',

        'month.jan': 'Jan', 'month.feb': 'Feb', 'month.mar': 'Mär', 'month.apr': 'Apr',
        'month.may': 'Mai', 'month.jun': 'Jun', 'month.jul': 'Jul', 'month.aug': 'Aug',
        'month.sep': 'Sep', 'month.oct': 'Okt', 'month.nov': 'Nov', 'month.dec': 'Dez'
    }
};

// ========================================================
// 3. LANGUAGE MANAGEMENT
// ========================================================

let currentLanguage = localStorage.getItem('badmintonLanguage') || 'en';

export function t(key, params = {}) {
    const langDict = translations[currentLanguage] || translations['en'];
    let text = langDict[key] || translations['en'][key] || key;
    Object.keys(params).forEach(param => {
        text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
    });
    return text;
}

export function getCurrentLanguage() {
    return currentLanguage;
}

export function setCurrentLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('badmintonLanguage', lang);
    }
}

// ========================================================
// 4. DATE PARSING UTILITIES
// ========================================================

export function parseUniversalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return new Date(NaN);
    }
    const cleanStr = dateStr.trim();
    const patterns = [
        /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/,
        /^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/,
        /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/,
        /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/
    ];
    for (const pattern of patterns) {
        const match = cleanStr.match(pattern);
        if (match) {
            try {
                let day, month, year;
                if (pattern === patterns[0]) {
                    day = parseInt(match[1]);
                    month = parseInt(match[2]) - 1;
                    year = parseInt(match[3]);
                    if (year < 100) {
                        const currentYear = new Date().getFullYear();
                        const century = Math.floor(currentYear / 100) * 100;
                        year = century + year;
                        if (year > currentYear + 50) {
                            year -= 100;
                        }
                    }
                } else if (pattern === patterns[1]) {
                    year = parseInt(match[1]);
                    month = parseInt(match[2]) - 1;
                    day = parseInt(match[3]);
                } else if (pattern === patterns[2] || pattern === patterns[3]) {
                    const monthNames = {
                        'jan': 0, 'january': 0, 'januari': 0, 'janvier': 0,
                        'feb': 1, 'february': 1, 'februari': 1, 'février': 1,
                        'mar': 2, 'march': 2, 'maart': 2, 'mars': 2,
                        'apr': 3, 'april': 3, 'avril': 3,
                        'may': 4, 'mei': 4, 'mai': 4,
                        'jun': 5, 'june': 5, 'juni': 5, 'juin': 5,
                        'jul': 6, 'july': 6, 'juli': 6, 'juillet': 6,
                        'aug': 7, 'august': 7, 'augustus': 7, 'août': 7,
                        'sep': 8, 'september': 8, 'septembre': 8,
                        'oct': 9, 'october': 9, 'oktober': 9, 'octobre': 9,
                        'nov': 10, 'november': 10, 'novembre': 10,
                        'dec': 11, 'december': 11, 'december': 11, 'décembre': 11
                    };
                    const monthKey = match[2] ? match[2].toLowerCase() : match[1].toLowerCase();
                    month = monthNames[monthKey];
                    if (month === undefined) continue;
                    if (pattern === patterns[2]) {
                        day = parseInt(match[1]);
                        year = parseInt(match[3]);
                    } else {
                        day = parseInt(match[2]);
                        year = parseInt(match[3]);
                    }
                }
                if (month < 0 || month > 11) continue;
                if (day < 1 || day > 31) continue;
                if (year < 1900 || year > 2100) continue;
                const tempDate = new Date(year, month, 1);
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                if (day > daysInMonth) continue;
                const finalDate = new Date(year, month, day);
                if (finalDate.getFullYear() !== year || finalDate.getMonth() !== month || finalDate.getDate() !== day) continue;
                return finalDate;
            } catch (error) {
                continue;
            }
        }
    }
    const fallbackDate = new Date(cleanStr);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;
    return new Date(NaN);
}

export const parseDate = parseUniversalDate;

export function isValidDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const date = parseUniversalDate(dateStr);
    return !isNaN(date.getTime());
}

// ========================================================
// 5. DATE FORMATTING
// ========================================================

export function formatDate(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
}

// ========================================================
// 6. SCORE RESULT EXTRACTION
// ========================================================

export function calculateShortResultFromScore(score) {
    if (!score || typeof score !== 'string') return "0-0";
    const normalizedScore = score.trim();
    if (normalizedScore.toLowerCase().includes('wo') ||
        normalizedScore.toLowerCase().includes('opgave') ||
        normalizedScore.toLowerCase().includes('walkover')) {
        return "0-0";
    }
    let mySets = 0;
    let oppSets = 0;
    const sets = normalizedScore.split(/\s+/);
    sets.forEach(s => {
        const p = s.split('-');
        if (p.length === 2) {
            const m = parseInt(p[0]);
            const o = parseInt(p[1]);
            if (!isNaN(m) && !isNaN(o)) {
                if (m > o) mySets++;
                else if (o > m) oppSets++;
            }
        }
    });
    return `${mySets}-${oppSets}`;
}

// ========================================================
// 7. CHART DESTRUCTION
// ========================================================

export function safeDestroyChart(chart, chartName = 'chart') {
    if (chart && typeof chart.destroy === 'function') {
        try {
            chart.destroy();
        } catch (error) {
            console.warn(`Error destroying ${chartName} chart:`, error);
        }
    }
}