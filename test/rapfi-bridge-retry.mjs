import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const timers = new Map();
const workers = [];
let timerId = 0;
class FakeWorker {
  constructor() { workers.push(this); }
  terminate() {}
  postMessage() {}
}
const window = {};
vm.runInNewContext(readFileSync('client/public/rapfi-bridge.js', 'utf8'), {
  window,
  document: { currentScript: { src: 'http://localhost:8787/rapfi-bridge.js' } },
  Worker: FakeWorker,
  URL,
  setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
  clearTimeout: id => timers.delete(id),
});

const first = window.RapfiBridge.ensure();
workers[0].onerror({ message: 'temporary network failure' });
assert.equal(await first, false);
assert.equal(window.RapfiBridge.status(), 'failed');
const retry = [...timers.values()].find(timer => timer.ms === 15000);
assert.ok(retry, 'a failed engine should schedule its own retry');
retry.fn();
assert.equal(workers.length, 2);
workers[1].onmessage({ data: { type: 'ready' } });
assert.equal(window.RapfiBridge.status(), 'ready');
assert.equal(await window.RapfiBridge.ensure(), true);

const move = window.RapfiBridge.findBestMove(Array(225).fill(0), 1, 3000);
assert.ok([...timers.values()].some(timer => timer.ms === 3500), 'three seconds of search gets only half a second of slack');
const timeout = [...timers.values()].find(timer => timer.ms === 3500);
timeout.fn();
assert.equal(await move, null);
assert.equal(window.RapfiBridge.status(), 'failed', 'timed-out engine must be restarted');

console.log('Rapfi recovery check passed');
