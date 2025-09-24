// PWA: registrar service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js');
    });
}
let teams = [];
let matches = [];
const storageKey = 'futbol5-torneo-vuelta-desempate';

function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
function minutesToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
}

function generateRoundRobinSchedule(teams, format = 'ida-vuelta') {
    // Mezclar equipos aleatoriamente para asignar a posiciones fijas
    let teamList = shuffleArray([...teams]);
    let isDouble = format === 'ida-vuelta';
    
    // Patrón fijo de enfrentamientos (para 5 equipos)
    const fixedPattern = [
        { home: 0, away: 1 }, // Equipo 1 vs Equipo 2
        { home: 2, away: 3 }, // Equipo 3 vs Equipo 4
        { home: 0, away: 4 }, // Equipo 1 vs Equipo 5
        { home: 1, away: 2 }, // Equipo 2 vs Equipo 3
        { home: 3, away: 4 }, // Equipo 4 vs Equipo 5
        { home: 0, away: 2 }, // Equipo 1 vs Equipo 3
        { home: 1, away: 3 }, // Equipo 2 vs Equipo 4
        { home: 2, away: 4 }, // Equipo 3 vs Equipo 5
        { home: 0, away: 3 }, // Equipo 1 vs Equipo 4
        { home: 1, away: 4 }  // Equipo 2 vs Equipo 5
    ];
    
    let schedule = [];
    
    // Si tenemos exactamente 5 equipos, usar el patrón fijo
    if (teams.length === 5) {
        let roundCounter = 1;
        let matchesPerRound = 2; // 2 partidos por ronda para 5 equipos
        
        for (let i = 0; i < fixedPattern.length; i++) {
            const match = fixedPattern[i];
            const round = Math.floor(i / matchesPerRound) + 1;
            
            if (match.home < teamList.length && match.away < teamList.length) {
                schedule.push({
                    home: teamList[match.home],
                    away: teamList[match.away],
                    round: round
                });
            }
        }
        
        // Si es ida y vuelta, agregar los partidos de vuelta
        if (isDouble) {
            const firstRoundMatches = [...schedule];
            const maxRound = Math.max(...schedule.map(m => m.round));
            
            firstRoundMatches.forEach(match => {
                schedule.push({
                    home: match.away, // Intercambiar local y visitante
                    away: match.home,
                    round: match.round + maxRound
                });
            });
        }
    } else {
        // Para otros números de equipos, usar el algoritmo original
        let n = teamList.length;
        if (n % 2 !== 0) {
            teamList.push(null);
            n++;
        }
        let rotation = teamList.slice();
        let rounds = isDouble ? (n - 1) * 2 : n - 1;
        for (let round = 0; round < rounds; round++) {
            let roundMatches = [];
            for (let i = 0; i < n / 2; i++) {
                let t1 = rotation[i];
                let t2 = rotation[n - 1 - i];
                if (t1 !== null && t2 !== null) {
                    if (isDouble) {
                        if (round < rounds / 2) {
                            roundMatches.push({ home: t1, away: t2, round: round + 1 });
                        } else {
                            roundMatches.push({ home: t2, away: t1, round: round + 1 });
                        }
                    } else {
                        roundMatches.push({ home: t1, away: t2, round: round + 1 });
                    }
                }
            }
            schedule.push(...roundMatches);
            let fixed = rotation[0];
            rotation.splice(1, 0, rotation.pop());
            rotation[0] = fixed;
        }
    }
    
    return schedule;
}

function calculateStandingsDetailed() {
    let standings = {};
    teams.forEach(t => {
        standings[t] = {
            played: 0, won: 0, draw: 0, lost: 0,
            goalsFor: 0, goalsAgainst: 0, points: 0,
            fairPlayPoints: 0
        };
    });

    // Procesar solo partidos con equipos válidos
    matches.forEach(m => {
        if (
            m.home && m.away &&
            standings[m.home] && standings[m.away] &&
            m.scoreHome != null && m.scoreAway != null
        ) {
            standings[m.home].played++;
            standings[m.away].played++;
            standings[m.home].goalsFor += m.scoreHome;
            standings[m.home].goalsAgainst += m.scoreAway;
            standings[m.away].goalsFor += m.scoreAway;
            standings[m.away].goalsAgainst += m.scoreHome;

            if (m.scoreHome > m.scoreAway) {
                standings[m.home].won++;
                standings[m.away].lost++;
                standings[m.home].points += 3;
            } else if (m.scoreHome < m.scoreAway) {
                standings[m.away].won++;
                standings[m.home].lost++;
                standings[m.away].points += 3;
            } else {
                standings[m.home].draw++;
                standings[m.away].draw++;
                standings[m.home].points += 1;
                standings[m.away].points += 1;
            }
            standings[m.home].fairPlayPoints += 0;
            standings[m.away].fairPlayPoints += 0;
        }
    });

    // Detectar empate por puntos
    let groups = {};
    for (const team in standings) {
        const pts = standings[team].points;
        groups[pts] = groups[pts] || [];
        groups[pts].push(team);
    }

    function headToHeadStats(group) {
        let h2h = {};
        group.forEach(t => {
            h2h[t] = { points: 0, goalsFor: 0, goalsAgainst: 0 };
        });
        matches.forEach(m => {
            if (
                group.includes(m.home) && group.includes(m.away) &&
                m.scoreHome != null && m.scoreAway != null &&
                h2h[m.home] && h2h[m.away]
            ) {
                h2h[m.home].points += m.scoreHome > m.scoreAway ? 3 : m.scoreHome === m.scoreAway ? 1 : 0;
                h2h[m.away].points += m.scoreAway > m.scoreHome ? 3 : m.scoreHome === m.scoreAway ? 1 : 0;
                h2h[m.home].goalsFor += m.scoreHome;
                h2h[m.home].goalsAgainst += m.scoreAway;
                h2h[m.away].goalsFor += m.scoreAway;
                h2h[m.away].goalsAgainst += m.scoreHome;
            }
        });
        return h2h;
    }

    function compareTeams(a, b, tiedGroup) {
        if (b.points !== a.points) return b.points - a.points;
        let diffA = a.goalsFor - a.goalsAgainst;
        let diffB = b.goalsFor - b.goalsAgainst;
        if (diffB !== diffA) return diffB - diffA;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

        if (tiedGroup && tiedGroup.length > 1) {
            let h2h = headToHeadStats(tiedGroup);
            if (h2h[b.team].points !== h2h[a.team].points) return h2h[b.team].points - h2h[a.team].points;
            let diff_h2hA = h2h[a.team].goalsFor - h2h[a.team].goalsAgainst;
            let diff_h2hB = h2h[b.team].goalsFor - h2h[b.team].goalsAgainst;
            if (diff_h2hB !== diff_h2hA) return diff_h2hB - diff_h2hA;
            if (h2h[b.team].goalsFor !== h2h[a.team].goalsFor) return h2h[b.team].goalsFor - h2h[a.team].goalsFor;
        }

        if (a.fairPlayPoints !== b.fairPlayPoints) return a.fairPlayPoints - b.fairPlayPoints;
        return a.team.localeCompare(b.team);
    }

    let allTeamsStats = [];
    for (const team in standings) {
        allTeamsStats.push({
            team,
            points: standings[team].points,
            goalsFor: standings[team].goalsFor,
            goalsAgainst: standings[team].goalsAgainst,
            played: standings[team].played,
            won: standings[team].won,
            draw: standings[team].draw,
            lost: standings[team].lost,
            fairPlayPoints: standings[team].fairPlayPoints
        });
    }

    function sortComplete(list) {
        let groupsPts = {};
        list.forEach(x => {
            groupsPts[x.points] = groupsPts[x.points] || [];
            groupsPts[x.points].push(x);
        });
        let sortedTotal = [];
        Object.keys(groupsPts).sort((a, b) => b - a).forEach(pts => {
            let group = groupsPts[pts];
            if (group.length > 1) {
                let tiedTeams = group.map(x => x.team);
                group.sort((a, b) => compareTeams(a, b, tiedTeams));
            }
            sortedTotal.push(...group);
        });
        return sortedTotal;
    }

    allTeamsStats = sortComplete(allTeamsStats);
    return allTeamsStats;
}

function renderRanking() {
    const container = document.getElementById('rankingContainer');
    const standings = calculateStandingsDetailed();
    let html = `
      <div class="overflow-x-auto">
      <table class="min-w-full border border-gray-300 bg-white text-sm">
        <thead>
          <tr class="bg-gray-100">
            <th class="px-2 py-1 border">Pos</th>
            <th class="px-2 py-1 border">Equipo</th>
            <th class="px-2 py-1 border">PJ</th>
            <th class="px-2 py-1 border">G</th>
            <th class="px-2 py-1 border">E</th>
            <th class="px-2 py-1 border">P</th>
            <th class="px-2 py-1 border">GF</th>
            <th class="px-2 py-1 border">GC</th>
            <th class="px-2 py-1 border">DG</th>
            <th class="px-2 py-1 border">Ptos</th>
          </tr>
        </thead>
        <tbody>`;
    standings.forEach((s, i) => {
        const diff = s.goalsFor - s.goalsAgainst;
        html += `<tr ${i === 0 ? 'class=\"font-bold text-green-600\"' : ''}>
        <td class="border px-2 py-1">${i + 1}</td>
        <td class="border px-2 py-1">${s.team}</td>
        <td class="border px-2 py-1">${s.played}</td>
        <td class="border px-2 py-1">${s.won}</td>
        <td class="border px-2 py-1">${s.draw}</td>
        <td class="border px-2 py-1">${s.lost}</td>
        <td class="border px-2 py-1">${s.goalsFor}</td>
        <td class="border px-2 py-1">${s.goalsAgainst}</td>
        <td class="border px-2 py-1">${diff}</td>
        <td class="border px-2 py-1">${s.points}</td>
      </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}


function renderMatches() {
    const container = document.getElementById('matchesContainer');
    const startTime = document.getElementById('startTimeInput').value || '18:00';
    const matchDuration = parseInt(document.getElementById('matchDurationInput').value, 10) || 6;
    const startMinutes = timeToMinutes(startTime);
    const allowDragDrop = document.getElementById('allowDragDropCheckbox')?.checked ?? true;

    // Agrupar partidos por ronda
    const roundGroups = {};
    matches.forEach((m, i) => {
        const round = m.round || 1;
        if (!roundGroups[round]) {
            roundGroups[round] = [];
        }
        roundGroups[round].push({ ...m, originalIndex: i });
    });

    // Ordenar rondas numéricamente
    const sortedRounds = Object.keys(roundGroups).sort((a, b) => parseInt(a) - parseInt(b));

    function formatTimer(secs) {
        const mm = Math.floor(secs / 60).toString().padStart(2, '0');
        const ss = (secs % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
    }

    let html = '<div class="space-y-4">';

    sortedRounds.forEach(roundNum => {
        const round = parseInt(roundNum);
        const roundMatches = roundGroups[roundNum];
        const roundStartMinutes = startMinutes + (round - 1) * matchDuration * 2;

        html += `
        <div class="round-container bg-gray-50 border-2 border-gray-200 rounded-lg p-3" 
             ${allowDragDrop ? 'draggable="true"' : ''} 
             data-round="${round}" 
             style="${allowDragDrop ? 'cursor: move;' : ''}">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-700">Ronda ${round}</h3>
                ${allowDragDrop ? `
                <div class="text-sm text-gray-500">
                    <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                    </svg>
                    Arrastra para intercambiar rondas
                </div>` : ''}
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full border border-gray-300 bg-white text-sm rounded">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="px-2 py-1 border">Local</th>
                            <th class="px-2 py-1 border">Resultado</th>
                            <th class="px-2 py-1 border">Visitante</th>
                        </tr>
                    </thead>
                    <tbody>`;

        roundMatches.forEach((m, matchIndex) => {
            const i = m.originalIndex;
            const matchStartMinutes = roundStartMinutes + matchIndex * matchDuration;
            const timeStr = minutesToTime(matchStartMinutes);

            // Cronómetro
            if (m.timer == null) m.timer = 0;
            if (m.timerState == null) m.timerState = 'stopped';
            if (m.timerLastStop == null) m.timerLastStop = 0;

            html += `<tr ${allowDragDrop ? 'draggable="true"' : ''} data-index="${i}" data-round="${round}" class="${allowDragDrop ? 'cursor-move' : ''} match-row">
            <td class="border px-2 py-1">${m.home}</td>
            <td class="border px-2 py-1">
              <div class="flex flex-col items-center justify-center">
                <span class="text-xs text-gray-500 mb-1">${timeStr}</span>
                <span class="flex flex-row items-center justify-center gap-1 mb-1">
                  <input type="number" min="0" id="scoreHome${i}" value="${m.scoreHome != null ? m.scoreHome : ''}" class="w-12 px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <span class="mx-1">-</span>
                  <input type="number" min="0" id="scoreAway${i}" value="${m.scoreAway != null ? m.scoreAway : ''}" class="w-12 px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </span>
                <span class="flex flex-row items-center gap-2 mt-1">
                  <a href="#" id="timerLink${i}" class="font-mono text-base w-16 text-center hover:text-blue-500 focus:outline-none" tabindex="0"><span id="timer${i}">${formatTimer(m.timer)}</span></a>
                  <button id="playPause${i}" class="px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600 flex items-center" title="Play/Pause">
                    ${m.timerState === 'running' ?
                    `<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><rect x='6' y='4' width='4' height='16' rx='1'/><rect x='14' y='4' width='4' height='16' rx='1'/></svg>`
                    :
                    `<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='currentColor' viewBox='0 0 24 24'><polygon points='5,3 19,12 5,21'/></svg>`}
                  </button>
                  <button id="stop${i}" class="px-2 py-1 rounded bg-red-500 text-white text-xs hover:bg-red-600 flex items-center" title="Stop">
                    <svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='currentColor' viewBox='0 0 24 24'><rect x='5' y='5' width='14' height='14' rx='2'/></svg>
                  </button>
                </span>
              </div>
            </td>
            <td class="border px-2 py-1">${m.away}</td>
          </tr>`;
        });

        html += `</tbody></table></div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;

    // Función para intercambiar rondas completas
    function swapRounds(round1, round2) {
        if (round1 === round2) return;
        
        matches.forEach(match => {
            if (match.round === round1) {
                match.round = round2;
            } else if (match.round === round2) {
                match.round = round1;
            }
        });
        
        saveResults();
        renderMatches();
    }

    // Drag & Drop: reordenar dentro de la misma jornada (round)
    function reorderWithinRound(roundNum, srcGlobalIdx, tgtGlobalIdx) {
        const round = parseInt(roundNum, 10);
        const indices = [];
        for (let idx = 0; idx < matches.length; idx++) {
            if (matches[idx].round === round) indices.push(idx);
        }
        if (indices.length === 0) return;
        const srcPos = indices.indexOf(srcGlobalIdx);
        const tgtPos = indices.indexOf(tgtGlobalIdx);
        if (srcPos === -1 || tgtPos === -1 || srcPos === tgtPos) return;
        const blockStart = Math.min(...indices);
        const blockLen = indices.length;
        const block = matches.slice(blockStart, blockStart + blockLen);
        const [moved] = block.splice(srcPos, 1);
        block.splice(tgtPos, 0, moved);
        for (let k = 0; k < blockLen; k++) {
            matches[blockStart + k] = block[k];
        }
        saveResults();
        renderMatches();
    }

    // Event listeners para intercambio de rondas completas (solo si está habilitado)
    if (allowDragDrop) {
        const roundContainers = container.querySelectorAll('.round-container');
        let dragSrcRound = null;
        let dragType = null; // 'round' o 'match'

        roundContainers.forEach(roundContainer => {
        roundContainer.addEventListener('dragstart', (e) => {
            // Solo permitir drag desde el contenedor de la ronda, no desde las filas de partidos
            if (e.target === roundContainer) {
                dragSrcRound = parseInt(roundContainer.dataset.round, 10);
                dragType = 'round';
                e.dataTransfer.effectAllowed = 'move';
                roundContainer.classList.add('opacity-50', 'scale-95');
                e.dataTransfer.setData('text/plain', ''); // Para compatibilidad
            }
        });

        roundContainer.addEventListener('dragover', (e) => {
            if (dragType === 'round' && dragSrcRound != null) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                roundContainer.classList.add('ring-4', 'ring-blue-400', 'bg-blue-50');
            }
        });

        roundContainer.addEventListener('dragleave', (e) => {
            // Solo remover la clase si realmente salimos del contenedor
            if (!roundContainer.contains(e.relatedTarget)) {
                roundContainer.classList.remove('ring-4', 'ring-blue-400', 'bg-blue-50');
            }
        });

        roundContainer.addEventListener('drop', (e) => {
            if (dragType === 'round' && dragSrcRound != null) {
                e.preventDefault();
                e.stopPropagation();
                const tgtRound = parseInt(roundContainer.dataset.round, 10);
                roundContainer.classList.remove('ring-4', 'ring-blue-400', 'bg-blue-50');
                
                if (dragSrcRound !== tgtRound) {
                    swapRounds(dragSrcRound, tgtRound);
                }
                
                dragSrcRound = null;
                dragType = null;
            }
        });

        roundContainer.addEventListener('dragend', () => {
            roundContainer.classList.remove('opacity-50', 'scale-95');
            roundContainers.forEach(rc => rc.classList.remove('ring-4', 'ring-blue-400', 'bg-blue-50'));
            dragSrcRound = null;
            dragType = null;
        });
        });

        // Event listeners para reordenar partidos dentro de la misma ronda
        const matchRows = container.querySelectorAll('.match-row');
        let dragSrcMatchIdx = null;
        let dragSrcMatchRound = null;

        matchRows.forEach(row => {
        row.addEventListener('dragstart', (e) => {
            e.stopPropagation(); // Evitar que se propague al contenedor de la ronda
            dragSrcMatchIdx = parseInt(row.dataset.index, 10);
            dragSrcMatchRound = parseInt(row.dataset.round, 10);
            dragType = 'match';
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('opacity-50');
        });

        row.addEventListener('dragover', (e) => {
            if (dragType === 'match') {
                const r = parseInt(row.dataset.round, 10);
                if (dragSrcMatchRound === r) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    row.classList.add('ring-2', 'ring-green-400');
                }
            }
        });

        row.addEventListener('dragleave', () => {
            row.classList.remove('ring-2', 'ring-green-400');
        });

        row.addEventListener('drop', (e) => {
            if (dragType === 'match') {
                e.preventDefault();
                e.stopPropagation();
                row.classList.remove('ring-2', 'ring-green-400');
                const tgtIdx = parseInt(row.dataset.index, 10);
                const tgtRound = parseInt(row.dataset.round, 10);
                if (dragSrcMatchIdx != null && dragSrcMatchRound === tgtRound) {
                    reorderWithinRound(tgtRound, dragSrcMatchIdx, tgtIdx);
                }
                dragSrcMatchIdx = null;
                dragSrcMatchRound = null;
                dragType = null;
            }
        });

            row.addEventListener('dragend', () => {
                row.classList.remove('opacity-50');
                matchRows.forEach(r => r.classList.remove('ring-2', 'ring-green-400'));
                dragSrcMatchIdx = null;
                dragSrcMatchRound = null;
                if (dragType === 'match') {
                    dragType = null;
                }
            });
        });
    }

    // Set up timer event listeners and score input handlers
    matches.forEach((m, i) => {
        // Score input change handlers
        const scoreHomeInput = document.getElementById(`scoreHome${i}`);
        const scoreAwayInput = document.getElementById(`scoreAway${i}`);
        
        if (scoreHomeInput) {
            scoreHomeInput.addEventListener('change', () => {
                matches[i].scoreHome = scoreHomeInput.value ? parseInt(scoreHomeInput.value) : null;
                saveResults();
            });
        }
        
        if (scoreAwayInput) {
            scoreAwayInput.addEventListener('change', () => {
                matches[i].scoreAway = scoreAwayInput.value ? parseInt(scoreAwayInput.value) : null;
                saveResults();
            });
        }

        // Timer functionality
        const timerDisplay = document.getElementById(`timer${i}`);
        const playPauseBtn = document.getElementById(`playPause${i}`);
        const stopBtn = document.getElementById(`stop${i}`);
        const timerLink = document.getElementById(`timerLink${i}`);

        // Prevenir drag en inputs y botones para evitar interferencias
        [scoreHomeInput, scoreAwayInput, playPauseBtn, stopBtn, timerLink].forEach(element => {
            if (element) {
                element.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                });
                element.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        });

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (matches[i].timerState === 'running') {
                    matches[i].timerState = 'paused';
                    matches[i].timerLastStop = Date.now();
                } else {
                    matches[i].timerState = 'running';
                    matches[i].timerStartTime = Date.now() - (matches[i].timer * 1000);
                }
                saveResults();
                renderMatches();
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                matches[i].timer = 0;
                matches[i].timerState = 'stopped';
                matches[i].timerLastStop = 0;
                saveResults();
                renderMatches();
            });
        }
    });

    // Update running timers
    matches.forEach((m, i) => {
        if (m.timerState === 'running') {
            const updateTimer = () => {
                if (matches[i].timerState === 'running') {
                    const elapsed = Math.floor((Date.now() - matches[i].timerStartTime) / 1000);
                    matches[i].timer = elapsed;
                    const timerDisplay = document.getElementById(`timer${i}`);
                    if (timerDisplay) {
                        const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
                        const ss = (elapsed % 60).toString().padStart(2, '0');
                        timerDisplay.textContent = `${mm}:${ss}`;
                    }
                    setTimeout(updateTimer, 1000);
                }
            };
            updateTimer();
        }
    });
}

function saveResults() {
    localStorage.setItem(storageKey, JSON.stringify(matches));
    renderRanking();
}

function loadResults() {
    const data = localStorage.getItem(storageKey);
    if (data) {
        matches = JSON.parse(data);
        renderMatches();
        renderRanking();
        return true;
    }
    return false;
}

function createTournament() {
    const input = document.getElementById('teamsInput').value.trim();
    if (!input) return alert('Ingrese nombres de equipos separados por coma');
    teams = input.split(',').map(t => t.trim()).filter(t => t);
    if (teams.length < 2) return alert('Debe haber al menos 2 equipos.');

    const format = document.getElementById('formatSelect')?.value || 'ida-vuelta';

    matches = generateRoundRobinSchedule(teams, format).map(m => ({
        home: m.home,
        away: m.away,
        round: m.round,
        scoreHome: null,
        scoreAway: null
    }));

    saveResults();
    renderMatches();
    renderRanking();
}

window.onload = () => {
    if (!loadResults()) createTournament();
    
    // Set up event listeners after DOM is loaded
    document.getElementById('createTournamentBtn').onclick = () => {
        if (confirm('Esto reiniciará los resultados guardados, ¿continuar?')) {
            localStorage.removeItem('futbol5-torneo-vuelta-desempate'); // Usa el valor literal del storageKey
            createTournament();
        }
    };
    
    // Event listener para el checkbox de drag & drop
    const dragDropCheckbox = document.getElementById('allowDragDropCheckbox');
    if (dragDropCheckbox) {
        dragDropCheckbox.addEventListener('change', () => {
            renderMatches(); // Re-renderizar para habilitar/deshabilitar drag & drop
        });
    }
};




function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}