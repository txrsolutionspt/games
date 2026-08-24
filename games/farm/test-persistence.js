#!/usr/bin/env node

/**
 * Unit tests for persistence.js's save/load round trip — the exact code
 * path the in-game "Save" button (and the debounced autosave) both call.
 * Run with: node test-persistence.js
 *
 * localStorage doesn't exist under plain Node, so this stubs a minimal
 * in-memory shim and installs it as a global before requiring
 * config.js/persistence.js — the same ambient-global relationship the
 * browser provides via <script> load order (config.js before
 * persistence.js), just satisfied here instead.
 */

const assert = require('assert');

function makeLocalStorage() {
  const store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
}

global.localStorage = makeLocalStorage();
global.CONFIG = require('./js/config.js');

const createInitialState = require('./js/state.js').createInitialState;
const Persistence = require('./js/persistence.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✅ ' + name);
    passed++;
  } catch (e) {
    console.log('  ❌ ' + name);
    console.log('     ' + e.message);
    failed++;
  }
}

function freshLocalStorage() {
  global.localStorage = makeLocalStorage();
}

test('save then load preserves the coin count exactly', function () {
  freshLocalStorage();
  const state = createInitialState();
  state.coins = 137;
  Persistence.saveNow(state);
  const loaded = Persistence.load();
  assert.strictEqual(loaded.coins, 137);
});

test('save then load preserves a planted crop exactly (kind, id, growth state)', function () {
  freshLocalStorage();
  const state = createInitialState();
  const occupant = { kind: 'crop', id: 'wheat', plantedAt: state.clock.tick, waterGiven: 0, state: 'growing' };
  state.plots[0].occupant = occupant;
  Persistence.saveNow(state);
  const loaded = Persistence.load();
  assert.deepStrictEqual(loaded.plots[0].occupant, occupant);
});

test('save then load preserves coins AND several planted crops together', function () {
  freshLocalStorage();
  const state = createInitialState();
  state.coins = 42;
  state.plots[0].occupant = { kind: 'crop', id: 'wheat', plantedAt: 0, waterGiven: 1, state: 'growing' };
  state.plots[3].occupant = { kind: 'crop', id: 'carrot', plantedAt: 5, waterGiven: 2, state: 'ready' };
  state.plots[7].occupant = { kind: 'crop', id: 'tomato', plantedAt: 12, waterGiven: 0, state: 'growing' };
  Persistence.saveNow(state);
  const loaded = Persistence.load();
  assert.strictEqual(loaded.coins, 42);
  assert.deepStrictEqual(loaded.plots[0].occupant, state.plots[0].occupant);
  assert.deepStrictEqual(loaded.plots[3].occupant, state.plots[3].occupant);
  assert.deepStrictEqual(loaded.plots[7].occupant, state.plots[7].occupant);
});

test('a second save after harvesting reflects the updated coins and cleared plot', function () {
  freshLocalStorage();
  const state = createInitialState();
  state.coins = 60;
  state.plots[0].occupant = { kind: 'crop', id: 'wheat', plantedAt: 0, waterGiven: 2, state: 'ready' };
  Persistence.saveNow(state);

  // simulate a harvest: coins go up, the plot clears
  state.coins += 15;
  state.plots[0].occupant = null;
  Persistence.saveNow(state);

  const loaded = Persistence.load();
  assert.strictEqual(loaded.coins, 75);
  assert.strictEqual(loaded.plots[0].occupant, null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
