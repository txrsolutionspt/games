importScripts('engine.js');

self.onmessage = function (e) {
  const { type, difficulty, reqId } = e.data || {};
  if (type === 'generate') {
    const result = SudokuEngine.generatePuzzle(difficulty);
    self.postMessage({ type: 'generated', reqId, difficulty, ...result });
  }
};
