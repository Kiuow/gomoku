import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['worker/index.mjs'], bundle: true, platform: 'node', format: 'esm', write: false });
const { GomokuRooms } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const values = new Map();
const rooms = new GomokuRooms({ storage: {
  get: async key => structuredClone(values.get(key)),
  put: async (key, value) => { values.set(key, structuredClone(value)); },
} });
const call = (path, data) => rooms.route(`/api/gomoku/${path}`, 'POST', data);
const black = { roomCode: '123456', playerId: 'black-player' };
const white = { roomCode: '123456', playerId: 'white-player' };

await call('rooms', black);
await call('rooms/join', white);
await call('rooms/move', { ...black, row: 7, col: 7 });

assert.equal((await call('rooms/undo-request', black)).success, true);
assert.equal((await call('rooms/undo-respond', { ...white, accept: false })).room.undoRequestStatus, 'rejected');
assert.equal((await call('rooms/undo-request', black)).success, true, 'a closed/rejected dialog must not block another request');
assert.equal((await call('rooms/undo-respond', { ...white, accept: true })).room.moveCount, 0);

await call('rooms/move', { ...black, row: 7, col: 7 });
assert.equal((await call('rooms/restart', black)).room.moveCount, 1, 'request alone must preserve the game');
assert.equal((await call('rooms/restart', white)).success, false, 'requester cannot restart without approval');
assert.equal((await call('rooms/restart-respond', { ...white, accept: false })).room.moveCount, 1);
assert.equal((await call('rooms/restart', black)).success, true);
const restarted = await call('rooms/restart-respond', { ...white, accept: true });
assert.equal(restarted.room.moveCount, 0);
assert.equal(restarted.room.status, 'playing');

await call('rooms/move', { ...black, row: 7, col: 7 });
await call('rooms/undo-request', black);
const stale = values.get('room:123456');
stale.undoRequestedAt = Date.now() - 31000;
values.set('room:123456', stale);
assert.equal((await call('rooms/undo-request', black)).success, true, 'unanswered requests must expire');
await call('rooms/undo-respond', { ...white, accept: false });
await call('rooms/restart', black);
const pendingRestart = values.get('room:123456');
pendingRestart.restartRequestedAt = Date.now() - 29000;
values.set('room:123456', pendingRestart);
assert.equal((await call('rooms/restart', black)).success, false, 'request must remain pending before 30 seconds');
pendingRestart.restartRequestedAt = Date.now() - 31000;
values.set('room:123456', pendingRestart);
assert.equal((await call('rooms/restart', black)).success, true, 'restart request must expire after 30 seconds');

console.log('Room request checks passed');
