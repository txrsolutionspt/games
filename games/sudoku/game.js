(function () {
  'use strict';

  const CELLS = 81;
  const STATE_KEY = 'sudoku.state.v1';
  const SETTINGS_KEY = 'sudoku.settings.v1';
  const STATS_KEY = 'sudoku.stats.v1';

  const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];
  const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };

  // ---------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------
  const boardEl = document.getElementById('board');
  const boardWrapEl = document.getElementById('boardWrap');
  const pauseOverlayEl = document.getElementById('pauseOverlay');
  const resumeBtn = document.getElementById('resumeBtn');
  const statusLineEl = document.getElementById('statusLine');
  const timerEl = document.getElementById('timer');
  const timerBtn = document.getElementById('timerBtn');
  const difficultyBadgeEl = document.getElementById('difficultyBadge');
  const menuBtn = document.getElementById('menuBtn');
  const closeMenuBtn = document.getElementById('closeMenuBtn');
  const menuPanel = document.getElementById('menuPanel');
  const menuScrim = document.getElementById('menuScrim');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const eraseBtn = document.getElementById('eraseBtn');
  const notesBtn = document.getElementById('notesBtn');
  const hintBtn = document.getElementById('hintBtn');
  const hintLabelEl = document.getElementById('hintLabel');
  const numpadEl = document.querySelector('.numpad');
  const contrastToggle = document.getElementById('contrastToggle');
  const highlightSameToggle = document.getElementById('highlightSameToggle');
  const autoClearNotesToggle = document.getElementById('autoClearNotesToggle');
  const showTimerToggle = document.getElementById('showTimerToggle');
  const statsListEl = document.getElementById('statsList');
  const winScrim = document.getElementById('winScrim');
  const winDialog = document.getElementById('winDialog');
  const winSummaryEl = document.getElementById('winSummary');
  const winNewGameBtn = document.getElementById('winNewGameBtn');
  const announcerEl = document.getElementById('ariaAnnouncer');

  // ---------------------------------------------------------------------
  // Persistent settings & stats
  // ---------------------------------------------------------------------
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage unavailable/full: ignore, game still playable */ }
  }

  let settings = Object.assign({
    highContrast: false,
    highlightSame: true,
    autoClearNotes: true,
    showTimer: true,
  }, loadJSON(SETTINGS_KEY, {}));

  let stats = loadJSON(STATS_KEY, {});
  DIFFICULTY_ORDER.forEach((d) => {
    if (!stats[d]) stats[d] = { played: 0, completed: 0, bestTime: null };
  });

  function applySettingsToUI() {
    contrastToggle.checked = settings.highContrast;
    highlightSameToggle.checked = settings.highlightSame;
    autoClearNotesToggle.checked = settings.autoClearNotes;
    showTimerToggle.checked = settings.showTimer;
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    timerBtn.style.visibility = settings.showTimer ? 'visible' : 'hidden';
  }

  function renderStats() {
    statsListEl.innerHTML = '';
    DIFFICULTY_ORDER.forEach((d) => {
      const s = stats[d];
      const li = document.createElement('li');
      const best = s.bestTime != null ? formatTime(s.bestTime) : '—';
      li.innerHTML = `<strong>${DIFFICULTY_LABEL[d]}</strong>: ${s.completed}/${s.played} solved · best ${best}`;
      statsListEl.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------
  /** @type {{
   *  difficulty:string, puzzle:number[], solution:number[], values:number[],
   *  notes:number[], history:object[], historyIndex:number, elapsed:number,
   *  hintsUsed:number, selected:number, completed:boolean
   * }} */
  let state = null;
  let notesMode = false;
  let paused = false;
  let timerHandle = null;
  let generating = false;

  function newBlankState(difficulty, puzzle, solution) {
    return {
      difficulty,
      puzzle: puzzle.slice(),
      solution: solution.slice(),
      values: puzzle.slice(),
      notes: new Array(CELLS).fill(0),
      history: [],
      historyIndex: 0,
      elapsed: 0,
      hintsUsed: 0,
      selected: -1,
      completed: false,
    };
  }

  function isGiven(i) { return state.puzzle[i] !== 0; }

  function persist() {
    saveJSON(STATE_KEY, state);
  }

  // ---------------------------------------------------------------------
  // Worker-based generation
  // ---------------------------------------------------------------------
  let worker;
  try {
    worker = new Worker('worker.js');
  } catch (e) {
    worker = null;
  }

  function generate(difficulty) {
    generating = true;
    setStatus(`Generating a new ${DIFFICULTY_LABEL[difficulty]} puzzle…`);
    boardWrapEl.setAttribute('aria-busy', 'true');

    const onResult = (puzzle, solution) => {
      generating = false;
      boardWrapEl.removeAttribute('aria-busy');
      state = newBlankState(difficulty, puzzle, solution);
      stats[difficulty].played++;
      saveJSON(STATS_KEY, stats);
      stopTimer();
      startTimer();
      persist();
      renderAll();
      setStatus('New puzzle ready. Good luck!');
    };

    if (worker) {
      const reqId = Date.now();
      const handler = (e) => {
        if (e.data && e.data.type === 'generated' && e.data.reqId === reqId) {
          worker.removeEventListener('message', handler);
          onResult(e.data.puzzle, e.data.solution);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'generate', difficulty, reqId });
    } else {
      // Fallback: generate synchronously on the main thread.
      setTimeout(() => {
        const result = SudokuEngine.generatePuzzle(difficulty);
        onResult(result.puzzle, result.solution);
      }, 0);
    }
  }

  // ---------------------------------------------------------------------
  // Board DOM construction
  // ---------------------------------------------------------------------
  const cellEls = new Array(CELLS);

  function buildBoardDOM() {
    boardEl.innerHTML = '';
    for (let i = 0; i < CELLS; i++) {
      const r = (i / 9) | 0, c = i % 9;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.index = String(i);
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-rowindex', String(r + 1));
      btn.setAttribute('aria-colindex', String(c + 1));
      if (c === 2 || c === 5) btn.classList.add('box-border-r');
      if (r === 2 || r === 5) btn.classList.add('box-border-b');

      const valueSpan = document.createElement('span');
      valueSpan.className = 'value';
      btn.appendChild(valueSpan);

      const notesGrid = document.createElement('div');
      notesGrid.className = 'notes-grid';
      for (let n = 0; n < 9; n++) {
        const span = document.createElement('span');
        notesGrid.appendChild(span);
      }
      btn.appendChild(notesGrid);

      btn.addEventListener('click', () => onCellTap(i));
      boardEl.appendChild(btn);
      cellEls[i] = btn;
    }
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  function computeConflictSet() {
    const conflicts = new Set();
    for (let i = 0; i < CELLS; i++) {
      if (!state.values[i]) continue;
      const cs = SudokuEngine.getConflicts(state.values, i);
      if (cs.length) {
        conflicts.add(i);
        cs.forEach((p) => conflicts.add(p));
      }
    }
    return conflicts;
  }

  function renderAll() {
    if (!state) return;
    const sel = state.selected;
    const selVal = sel >= 0 ? state.values[sel] : 0;
    const conflicts = computeConflictSet();
    const peers = sel >= 0 ? new Set(SudokuEngine.PEERS[sel]) : null;

    const tabTarget = sel >= 0 ? sel : 0;
    for (let i = 0; i < CELLS; i++) {
      const el = cellEls[i];
      const val = state.values[i];
      const given = isGiven(i);

      el.tabIndex = i === tabTarget ? 0 : -1;
      el.classList.toggle('given', given);
      el.classList.toggle('selected', i === sel);
      el.classList.toggle('peer', !!peers && peers.has(i) && i !== sel);
      el.classList.toggle('conflict', conflicts.has(i));
      el.classList.toggle(
        'same-value',
        settings.highlightSame && selVal !== 0 && val === selVal && i !== sel
      );

      const valueSpan = el.firstChild;
      const notesGrid = el.lastChild;
      if (val) {
        valueSpan.textContent = String(val);
        notesGrid.style.display = 'none';
        el.setAttribute(
          'aria-label',
          `Row ${((i / 9) | 0) + 1} column ${(i % 9) + 1}, ${given ? 'given' : 'entered'} ${val}${conflicts.has(i) ? ', conflict' : ''}`
        );
      } else {
        valueSpan.textContent = '';
        const bitmask = state.notes[i];
        if (bitmask) {
          notesGrid.style.display = 'grid';
          for (let d = 1; d <= 9; d++) {
            notesGrid.children[d - 1].textContent = bitmask & (1 << (d - 1)) ? String(d) : '';
          }
        } else {
          notesGrid.style.display = 'none';
        }
        el.setAttribute(
          'aria-label',
          `Row ${((i / 9) | 0) + 1} column ${(i % 9) + 1}, empty${bitmask ? ', has notes' : ''}`
        );
      }
    }

    difficultyBadgeEl.textContent = DIFFICULTY_LABEL[state.difficulty];
    timerEl.textContent = formatTime(state.elapsed);
    notesBtn.setAttribute('aria-pressed', String(notesMode));
    undoBtn.disabled = state.historyIndex === 0;
    redoBtn.disabled = state.historyIndex === state.history.length;
    eraseBtn.disabled = sel < 0 || (isGiven(sel) === true);
    hintLabelEl.textContent = `Hint${state.hintsUsed ? ` (${state.hintsUsed})` : ''}`;

    renderNumpadCounts();
  }

  function renderNumpadCounts() {
    const counts = new Array(10).fill(0);
    const conflicts = computeConflictSet();
    for (let i = 0; i < CELLS; i++) {
      const v = state.values[i];
      if (v && !conflicts.has(i)) counts[v]++;
    }
    const buttons = numpadEl.querySelectorAll('.num-btn');
    buttons.forEach((btn) => {
      const d = Number(btn.dataset.num);
      btn.classList.toggle('exhausted', counts[d] >= 9);
    });
  }

  function setStatus(text) {
    statusLineEl.textContent = text;
  }

  function announce(text) {
    announcerEl.textContent = '';
    // Force screen readers to re-announce even if text repeats.
    requestAnimationFrame(() => { announcerEl.textContent = text; });
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------
  // Selection & input
  // ---------------------------------------------------------------------
  function onCellTap(i) {
    if (generating || paused) return;
    state.selected = i;
    persist();
    renderAll();
  }

  function pushHistory(entry) {
    state.history = state.history.slice(0, state.historyIndex);
    state.history.push(entry);
    state.historyIndex = state.history.length;
  }

  function applyEntry(entry, direction) {
    const value = direction === 'undo' ? entry.prevValue : entry.newValue;
    const notes = direction === 'undo' ? entry.prevNotes : entry.newNotes;
    state.values[entry.index] = value;
    state.notes[entry.index] = notes;
    if (entry.peerNoteChanges) {
      entry.peerNoteChanges.forEach(({ index, prevNotes, newNotes }) => {
        state.notes[index] = direction === 'undo' ? prevNotes : newNotes;
      });
    }
  }

  function inputDigit(d) {
    if (generating || paused) return;
    const i = state.selected;
    if (i < 0 || isGiven(i)) return;

    if (notesMode) {
      const prevNotes = state.notes[i];
      const newNotes = state.values[i] ? prevNotes : prevNotes ^ (1 << (d - 1));
      if (state.values[i]) return; // can't note a filled cell
      pushHistory({ index: i, prevValue: state.values[i], newValue: state.values[i], prevNotes, newNotes });
      state.notes[i] = newNotes;
    } else {
      const prevValue = state.values[i];
      const prevNotes = state.notes[i];
      if (prevValue === d) return;
      const peerNoteChanges = [];
      if (settings.autoClearNotes) {
        SudokuEngine.PEERS[i].forEach((p) => {
          if (!state.values[p] && (state.notes[p] & (1 << (d - 1)))) {
            peerNoteChanges.push({ index: p, prevNotes: state.notes[p], newNotes: state.notes[p] & ~(1 << (d - 1)) });
          }
        });
      }
      pushHistory({ index: i, prevValue, newValue: d, prevNotes, newNotes: 0, peerNoteChanges });
      state.values[i] = d;
      state.notes[i] = 0;
      peerNoteChanges.forEach(({ index, newNotes }) => { state.notes[index] = newNotes; });
    }
    persist();
    renderAll();
    checkWin();
  }

  function eraseSelected() {
    if (generating || paused) return;
    const i = state.selected;
    if (i < 0 || isGiven(i)) return;
    const prevValue = state.values[i];
    const prevNotes = state.notes[i];
    if (!prevValue && !prevNotes) return;
    pushHistory({ index: i, prevValue, newValue: 0, prevNotes, newNotes: 0 });
    state.values[i] = 0;
    state.notes[i] = 0;
    persist();
    renderAll();
  }

  function undo() {
    if (generating || paused || state.historyIndex === 0) return;
    state.historyIndex--;
    applyEntry(state.history[state.historyIndex], 'undo');
    persist();
    renderAll();
  }

  function redo() {
    if (generating || paused || state.historyIndex === state.history.length) return;
    applyEntry(state.history[state.historyIndex], 'redo');
    state.historyIndex++;
    persist();
    renderAll();
  }

  function giveHint() {
    if (generating || paused) return;
    let i = state.selected;
    if (i < 0 || state.values[i] !== 0) {
      const empties = [];
      for (let k = 0; k < CELLS; k++) if (!state.values[k]) empties.push(k);
      if (empties.length === 0) return;
      i = empties[Math.floor(Math.random() * empties.length)];
      state.selected = i;
    }
    const correct = state.solution[i];
    const prevValue = state.values[i];
    const prevNotes = state.notes[i];
    pushHistory({ index: i, prevValue, newValue: correct, prevNotes, newNotes: 0, isHint: true });
    state.values[i] = correct;
    state.notes[i] = 0;
    state.hintsUsed++;
    persist();
    renderAll();
    cellEls[i].classList.add('hint-flash');
    setTimeout(() => cellEls[i].classList.remove('hint-flash'), 900);
    announce(`Hint: placed ${correct} at row ${((i / 9) | 0) + 1}, column ${(i % 9) + 1}`);
    checkWin();
  }

  function checkWin() {
    if (state.values.some((v) => !v)) return;
    if (!SudokuEngine.isSolved(state.values)) return;
    state.completed = true;
    stopTimer();
    const d = state.difficulty;
    stats[d].completed++;
    if (stats[d].bestTime == null || state.elapsed < stats[d].bestTime) {
      stats[d].bestTime = state.elapsed;
    }
    saveJSON(STATS_KEY, stats);
    localStorage.removeItem(STATE_KEY);
    renderStats();
    winSummaryEl.textContent = `${DIFFICULTY_LABEL[d]} · ${formatTime(state.elapsed)}${state.hintsUsed ? ` · ${state.hintsUsed} hint${state.hintsUsed > 1 ? 's' : ''}` : ''}`;
    winScrim.classList.remove('hidden');
    winDialog.classList.remove('hidden');
    announce('Congratulations, puzzle solved!');
  }

  // ---------------------------------------------------------------------
  // Timer
  // ---------------------------------------------------------------------
  function startTimer() {
    if (timerHandle || paused || state.completed) return;
    timerHandle = setInterval(() => {
      state.elapsed++;
      timerEl.textContent = formatTime(state.elapsed);
      if (state.elapsed % 5 === 0) persist();
    }, 1000);
  }
  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function togglePause() {
    if (generating || state.completed) return;
    paused = !paused;
    pauseOverlayEl.classList.toggle('hidden', !paused);
    timerBtn.setAttribute('aria-label', paused ? 'Resume timer' : 'Pause timer');
    if (paused) stopTimer(); else startTimer();
  }

  // ---------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------
  function openMenu() {
    menuPanel.classList.remove('hidden');
    menuScrim.classList.remove('hidden');
    menuBtn.setAttribute('aria-expanded', 'true');
    renderStats();
    updateActiveDifficultyBtn();
  }
  function closeMenu() {
    menuPanel.classList.add('hidden');
    menuScrim.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  function updateActiveDifficultyBtn() {
    document.querySelectorAll('.difficulty-btn').forEach((btn) => {
      btn.classList.toggle('active', state && btn.dataset.difficulty === state.difficulty);
    });
  }

  // ---------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------
  menuBtn.addEventListener('click', openMenu);
  closeMenuBtn.addEventListener('click', closeMenu);
  menuScrim.addEventListener('click', closeMenu);

  document.querySelectorAll('.difficulty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const difficulty = btn.dataset.difficulty;
      closeMenu();
      generate(difficulty);
    });
  });

  contrastToggle.addEventListener('change', () => {
    settings.highContrast = contrastToggle.checked;
    saveJSON(SETTINGS_KEY, settings);
    applySettingsToUI();
  });
  highlightSameToggle.addEventListener('change', () => {
    settings.highlightSame = highlightSameToggle.checked;
    saveJSON(SETTINGS_KEY, settings);
    renderAll();
  });
  autoClearNotesToggle.addEventListener('change', () => {
    settings.autoClearNotes = autoClearNotesToggle.checked;
    saveJSON(SETTINGS_KEY, settings);
  });
  showTimerToggle.addEventListener('change', () => {
    settings.showTimer = showTimerToggle.checked;
    saveJSON(SETTINGS_KEY, settings);
    applySettingsToUI();
  });

  numpadEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.num-btn');
    if (!btn) return;
    inputDigit(Number(btn.dataset.num));
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  eraseBtn.addEventListener('click', eraseSelected);
  notesBtn.addEventListener('click', () => {
    notesMode = !notesMode;
    renderAll();
  });
  hintBtn.addEventListener('click', giveHint);
  timerBtn.addEventListener('click', togglePause);
  resumeBtn.addEventListener('click', togglePause);

  winNewGameBtn.addEventListener('click', () => {
    winScrim.classList.add('hidden');
    winDialog.classList.add('hidden');
    generate(state.difficulty);
  });

  document.addEventListener('keydown', (e) => {
    if (generating) return;
    if (!menuPanel.classList.contains('hidden') || !winDialog.classList.contains('hidden')) return;
    const key = e.key;
    if (/^[1-9]$/.test(key)) { inputDigit(Number(key)); return; }
    if (key === 'Backspace' || key === 'Delete' || key === '0') { eraseSelected(); return; }
    if (key.toLowerCase() === 'n') { notesMode = !notesMode; renderAll(); return; }
    if (key.toLowerCase() === 'h') { giveHint(); return; }
    if (key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) { e.shiftKey ? redo() : undo(); return; }
    if (key.toLowerCase() === 'p') { togglePause(); return; }

    if (paused) return;
    const sel = state.selected < 0 ? 0 : state.selected;
    let r = (sel / 9) | 0, c = sel % 9;
    if (key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (key === 'ArrowDown') r = Math.min(8, r + 1);
    else if (key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (key === 'ArrowRight') c = Math.min(8, c + 1);
    else return;
    e.preventDefault();
    state.selected = r * 9 + c;
    cellEls[state.selected].focus({ preventScroll: true });
    persist();
    renderAll();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state && !state.completed && !paused) togglePause();
  });

  // ---------------------------------------------------------------------
  // Real viewport height (mobile browsers resize their address/toolbar
  // chrome without firing a proper layout viewport change, so 100vh/100dvh
  // alone can size #app taller than what's actually visible and push the
  // number pad off screen). Track the true visible height in a CSS var.
  // ---------------------------------------------------------------------
  function syncViewportHeight() {
    const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty('--vh100', `${h / 100}px`);
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  function boot() {
    syncViewportHeight();
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', syncViewportHeight);

    buildBoardDOM();
    applySettingsToUI();
    renderStats();

    const saved = loadJSON(STATE_KEY, null);
    if (saved && saved.puzzle && saved.puzzle.length === CELLS) {
      state = saved;
      renderAll();
      startTimer();
      setStatus('Resumed your saved game.');
      checkWin();
    } else {
      generate('medium');
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  boot();
})();
