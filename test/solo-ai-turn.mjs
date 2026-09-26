import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['worker/index.mjs'], bundle: true, platform: 'node', format: 'esm', write: false });
const { GomokuRooms } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const values = new Map();
const rooms = new GomokuRooms({ storage: {
  get: async key => structuredClone(values.get(key)),
  put: async (key, value) => { values.set(key, structuredClone(value)); },
} });
const post = (path, data) => rooms.route(`/api/gomoku/solo/${path}`, 'POST', data);
const playerId = 'solo-player';
const roomCode = 'S_STALE_AI_TEST';

const first = await post('create', { roomCode, playerId, playerColor: 'white', difficulty: 'hell', deferAi: true });
const oldTurn = first.room;
assert.equal(oldTurn.moveCount, 0);
assert.ok(oldTurn.aiPendingSince);

const restarted = await post('restart', { roomCode, playerId, deferAi: true });
assert.equal(restarted.room.moveCount, 0);
assert.notEqual(restarted.room.aiPendingSince, oldTurn.aiPendingSince);

const stale = await post('ai-reply', {
  roomCode, playerId, expectedMoveCount: oldTurn.moveCount,
  expectedPendingSince: oldTurn.aiPendingSince, row: 7, col: 7,
});
assert.equal(stale.valid, false, 'the previous game must not place a stone after restart');
assert.equal(stale.room.moveCount, 0);

const current = await post('ai-reply', {
  roomCode, playerId, expectedMoveCount: restarted.room.moveCount,
  expectedPendingSince: restarted.room.aiPendingSince, row: 7, col: 7,
});
assert.equal(current.valid, true);
assert.equal(current.room.moveCount, 1);
assert.equal(current.room.board[7][7], 'black');
assert.equal((await post('undo', { roomCode, playerId })).success, false, 'white cannot undo the AI opening');

const whiteMove = await post('move', { roomCode, playerId, row: 7, col: 8, deferAi: true });
const undoneWhileThinking = await post('undo', { roomCode, playerId });
assert.equal(undoneWhileThinking.success, true);
assert.equal(undoneWhileThinking.room.moveCount, 1, 'undo before AI reply removes only the human move');
assert.equal(undoneWhileThinking.room.currentPlayer, 'white');
assert.equal((await post('ai-reply', {
  roomCode, playerId, expectedMoveCount: whiteMove.room.moveCount,
  expectedPendingSince: whiteMove.room.aiPendingSince,
})).valid, false, 'a pending AI reply must not survive undo');

const whiteAgain = await post('move', { roomCode, playerId, row: 7, col: 8, deferAi: true });
const blackReply = await post('ai-reply', {
  roomCode, playerId, expectedMoveCount: whiteAgain.room.moveCount,
  expectedPendingSince: whiteAgain.room.aiPendingSince,
});
assert.equal(blackReply.room.moveCount, 3);
const undonePair = await post('undo', { roomCode, playerId });
assert.equal(undonePair.room.moveCount, 1, 'undo after AI reply removes the human move and AI reply');
assert.equal(undonePair.room.currentPlayer, 'white');

for (const difficulty of ['easy', 'normal']) {
  const code = `S_${difficulty}_TURN`;
  await post('create', { roomCode: code, playerId, playerColor: 'black', difficulty });
  const moved = await post('move', { roomCode: code, playerId, row: 7, col: 7, deferAi: true });
  assert.equal(moved.valid, true);
  assert.equal(moved.room.moveCount, 1, 'the human stone must be saved before AI search');
  assert.equal(moved.aiThinking, true);
  const replyData = {
    roomCode: code, playerId, expectedMoveCount: moved.room.moveCount,
    expectedPendingSince: moved.room.aiPendingSince,
  };
  const reply = await post('ai-reply', replyData);
  assert.equal(reply.valid, true);
  assert.equal(reply.room.moveCount, 2);
  assert.equal((await post('ai-reply', replyData)).valid, false, 'a duplicate AI reply must not add another stone');
  const nextCol = reply.room.board[7][8] === null ? 8 : 9;
  const secondMove = await post('move', { roomCode: code, playerId, row: 7, col: nextCol, deferAi: true });
  assert.equal(secondMove.valid, true);
  assert.equal(secondMove.room.moveCount, 3);
  const secondReply = await post('ai-reply', {
    roomCode: code, playerId, expectedMoveCount: secondMove.room.moveCount,
    expectedPendingSince: secondMove.room.aiPendingSince,
  });
  assert.equal(secondReply.valid, true, `${difficulty} must answer the second human move`);
  assert.equal(secondReply.room.moveCount, 4);
  const undone = await post('undo', { roomCode: code, playerId });
  assert.equal(undone.room.moveCount, 2, 'black undo removes the latest human move and AI reply');

  const pending = await post('move', { roomCode: code, playerId, row: 7, col: nextCol, deferAi: true });
  const stalePending = { ...pending.room, aiPendingSince: Date.now() - 6000 };
  values.set(`room:${code}`, stalePending);
  const recovered = await rooms.route(`/api/gomoku/solo/${code}`, 'GET', {});
  assert.equal(recovered.room.moveCount, 4, `${difficulty} must recover an abandoned AI reply`);
  assert.equal(recovered.room.aiPendingSince, null);
}

console.log('Solo AI turn checks passed');
