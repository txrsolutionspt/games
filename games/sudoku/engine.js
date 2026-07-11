/*
 * Sudoku Engine: board generation, solving, and validation.
 * Pure JS, no dependencies. Works as a classic script in both the main
 * thread and inside a Web Worker (attaches to the shared global scope).
 */
(function (global) {
  'use strict';

  const SIZE = 9;
  const BOX = 3;
  const CELLS = SIZE * SIZE;

  const DIFFICULTIES = {
    easy: { label: 'Easy', min: 40, max: 46, restarts: 1 },
    medium: { label: 'Medium', min: 32, max: 39, restarts: 1 },
    hard: { label: 'Hard', min: 27, max: 31, restarts: 6 },
    expert: { label: 'Expert', min: 22, max: 26, restarts: 20 },
  };

  function rngInt(max) {
    return Math.floor(Math.random() * max);
  }

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rngInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function rowOf(i) { return (i / SIZE) | 0; }
  function colOf(i) { return i % SIZE; }
  function boxOf(i) { return (rowOf(i) / BOX | 0) * BOX + (colOf(i) / BOX | 0); }

  // Precompute peer indices (same row/col/box) for each cell.
  const PEERS = new Array(CELLS);
  const ROW_CELLS = new Array(SIZE);
  const COL_CELLS = new Array(SIZE);
  const BOX_CELLS = new Array(SIZE);
  for (let r = 0; r < SIZE; r++) {
    ROW_CELLS[r] = [];
    for (let c = 0; c < SIZE; c++) ROW_CELLS[r].push(r * SIZE + c);
  }
  for (let c = 0; c < SIZE; c++) {
    COL_CELLS[c] = [];
    for (let r = 0; r < SIZE; r++) COL_CELLS[c].push(r * SIZE + c);
  }
  for (let b = 0; b < SIZE; b++) {
    BOX_CELLS[b] = [];
    const br = (b / BOX | 0) * BOX;
    const bc = (b % BOX) * BOX;
    for (let r = 0; r < BOX; r++) {
      for (let c = 0; c < BOX; c++) BOX_CELLS[b].push((br + r) * SIZE + (bc + c));
    }
  }
  for (let i = 0; i < CELLS; i++) {
    const r = rowOf(i), c = colOf(i), b = boxOf(i);
    const set = new Set([...ROW_CELLS[r], ...COL_CELLS[c], ...BOX_CELLS[b]]);
    set.delete(i);
    PEERS[i] = [...set];
  }

  /** Bitmask solver state built from a flat 81-length board (0 = empty). */
  function buildMasks(board) {
    const rows = new Array(SIZE).fill(0);
    const cols = new Array(SIZE).fill(0);
    const boxes = new Array(SIZE).fill(0);
    for (let i = 0; i < CELLS; i++) {
      const v = board[i];
      if (!v) continue;
      const bit = 1 << (v - 1);
      rows[rowOf(i)] |= bit;
      cols[colOf(i)] |= bit;
      boxes[boxOf(i)] |= bit;
    }
    return { rows, cols, boxes };
  }

  function candidatesMask(masks, i) {
    const used = masks.rows[rowOf(i)] | masks.cols[colOf(i)] | masks.boxes[boxOf(i)];
    return 0x1ff & ~used;
  }

  function popcount(n) {
    n -= (n >> 1) & 0x55555555;
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
  }

  /**
   * Counts solutions up to `limit` using MRV backtracking with bitmasks.
   * Returns the number of solutions found (capped at `limit`).
   * If `collectFirst` is true, `out.solution` receives a full solved board.
   */
  function countSolutions(board, limit, out) {
    const work = board.slice();
    const masks = buildMasks(work);
    let empties = [];
    for (let i = 0; i < CELLS; i++) if (!work[i]) empties.push(i);
    let count = 0;

    function place(i, v) {
      const bit = 1 << (v - 1);
      work[i] = v;
      masks.rows[rowOf(i)] |= bit;
      masks.cols[colOf(i)] |= bit;
      masks.boxes[boxOf(i)] |= bit;
    }
    function remove(i, v) {
      const bit = 1 << (v - 1);
      work[i] = 0;
      masks.rows[rowOf(i)] &= ~bit;
      masks.cols[colOf(i)] &= ~bit;
      masks.boxes[boxOf(i)] &= ~bit;
    }

    function backtrack(remaining) {
      if (count >= limit) return;
      if (remaining.length === 0) {
        count++;
        if (out && !out.solution) out.solution = work.slice();
        return;
      }
      // MRV: pick the empty cell with fewest candidates.
      let bestIdx = -1, bestMask = 0, bestPop = 10, bestPos = -1;
      for (let k = 0; k < remaining.length; k++) {
        const i = remaining[k];
        const m = candidatesMask(masks, i);
        const p = popcount(m);
        if (p < bestPop) {
          bestPop = p; bestIdx = i; bestMask = m; bestPos = k;
          if (p === 0) break;
        }
      }
      if (bestPop === 0) return; // dead end
      const rest = remaining.slice(0, bestPos).concat(remaining.slice(bestPos + 1));
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << (d - 1);
        if (!(bestMask & bit)) continue;
        place(bestIdx, d);
        backtrack(rest);
        remove(bestIdx, d);
        if (count >= limit) return;
      }
    }

    backtrack(empties);
    return count;
  }

  /** Solves a board (first solution found), returns a new board or null. */
  function solveBoard(board) {
    const out = {};
    const n = countSolutions(board, 1, out);
    return n > 0 ? out.solution : null;
  }

  /** Generates a fully solved, valid 9x9 board via randomized backtracking. */
  function generateFullBoard() {
    const work = new Array(CELLS).fill(0);
    const masks = buildMasks(work);

    function place(i, v) {
      const bit = 1 << (v - 1);
      work[i] = v;
      masks.rows[rowOf(i)] |= bit;
      masks.cols[colOf(i)] |= bit;
      masks.boxes[boxOf(i)] |= bit;
    }
    function remove(i, v) {
      const bit = 1 << (v - 1);
      work[i] = 0;
      masks.rows[rowOf(i)] &= ~bit;
      masks.cols[colOf(i)] &= ~bit;
      masks.boxes[boxOf(i)] &= ~bit;
    }

    function fill(order) {
      if (order.length === 0) return true;
      let bestPos = 0, bestMask = -1, bestPop = 10;
      for (let k = 0; k < order.length; k++) {
        const m = candidatesMask(masks, order[k]);
        const p = popcount(m);
        if (p < bestPop) { bestPop = p; bestPos = k; bestMask = m; if (p <= 1) break; }
      }
      if (bestPop === 0) return false;
      const i = order[bestPos];
      const rest = order.slice(0, bestPos).concat(order.slice(bestPos + 1));
      const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const d of digits) {
        const bit = 1 << (d - 1);
        if (!(bestMask & bit)) continue;
        place(i, d);
        if (fill(rest)) return true;
        remove(i, d);
      }
      return false;
    }

    const order = [];
    for (let i = 0; i < CELLS; i++) order.push(i);
    fill(order);
    return work;
  }

  /**
   * Digs holes in a solved board until it hits the target clue count while
   * keeping the puzzle uniquely solvable. Uses rotational-symmetry removal
   * when possible, falling back to single-cell removal near the end.
   */
  function digPuzzle(solved, targetClues, attemptBudget) {
    const puzzle = solved.slice();
    let clueCount = CELLS;
    let attempts = 0;
    let progressed = true;

    while (clueCount > targetClues && progressed && attempts < attemptBudget) {
      progressed = false;
      const filled = [];
      for (let i = 0; i < CELLS; i++) if (puzzle[i] !== 0) filled.push(i);
      const order = shuffled(filled);

      for (let k = 0; k < order.length && clueCount > targetClues; k++) {
        if (attempts++ > attemptBudget) break;
        const i = order[k];
        if (puzzle[i] === 0) continue;
        const mirror = CELLS - 1 - i;
        const useSymmetry = mirror !== i && puzzle[mirror] !== 0 && (clueCount - 2) >= targetClues;

        const savedI = puzzle[i];
        const savedM = useSymmetry ? puzzle[mirror] : null;
        puzzle[i] = 0;
        if (useSymmetry) puzzle[mirror] = 0;

        const solCount = countSolutions(puzzle, 2, {});
        if (solCount === 1) {
          clueCount -= useSymmetry ? 2 : 1;
          progressed = true;
        } else {
          puzzle[i] = savedI;
          if (useSymmetry) puzzle[mirror] = savedM;
        }
      }
    }
    return { puzzle, clueCount };
  }

  /**
   * Digs multiple times from the same solved grid (fresh random removal
   * order each time) and keeps the lowest clue count reached, stopping
   * early once the target is hit. Harder difficulties get more restarts
   * since the greedy digger plateaus above their target clue count.
   */
  function digBest(solved, target, restarts, budgetEach) {
    let best = null;
    for (let r = 0; r < restarts; r++) {
      const result = digPuzzle(solved, target, budgetEach);
      if (!best || result.clueCount < best.clueCount) best = result;
      if (best.clueCount <= target) break;
    }
    return best;
  }

  /** Generates a full puzzle for the given difficulty key. */
  function generatePuzzle(difficulty) {
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    const solved = generateFullBoard();
    const target = diff.min + rngInt(diff.max - diff.min + 1);
    const { puzzle, clueCount } = digBest(solved, target, diff.restarts || 1, 4000);
    return {
      puzzle,
      solution: solved,
      difficulty,
      clues: clueCount,
    };
  }

  /** Returns the set of cell indices that conflict with the value at `i`. */
  function getConflicts(board, i) {
    const v = board[i];
    if (!v) return [];
    return PEERS[i].filter((p) => board[p] === v);
  }

  /** Returns true if the whole board is filled and rule-valid. */
  function isSolved(board) {
    for (let i = 0; i < CELLS; i++) {
      if (!board[i]) return false;
      if (getConflicts(board, i).length > 0) return false;
    }
    return true;
  }

  /** Returns the legal candidate digits (1-9) for an empty cell. */
  function getCandidates(board, i) {
    if (board[i]) return [];
    const masks = buildMasks(board);
    const m = candidatesMask(masks, i);
    const out = [];
    for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) out.push(d);
    return out;
  }

  const SudokuEngine = {
    SIZE,
    BOX,
    CELLS,
    DIFFICULTIES,
    PEERS,
    ROW_CELLS,
    COL_CELLS,
    BOX_CELLS,
    rowOf,
    colOf,
    boxOf,
    generatePuzzle,
    generateFullBoard,
    digPuzzle,
    solveBoard,
    countSolutions,
    getConflicts,
    getCandidates,
    isSolved,
  };

  global.SudokuEngine = SudokuEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = SudokuEngine;
})(typeof self !== 'undefined' ? self : this);
