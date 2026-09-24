import { findBestMove } from '../server/modules/gomoku/gomoku-ai.search.ts';
import { evaluateBoard, evaluatePositionBoth } from '../server/modules/gomoku/gomoku-ai.engine.ts';

const SIZE = 15;
const REQUEST_TIMEOUT_MS = 30000;
const other = color => color === 'black' ? 'white' : 'black';
const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
const isAi = id => id === 'ai_black' || id === 'ai_white';
const isSolo = room => room.roomCode.startsWith('S') && (isAi(room.blackPlayer) || isAi(room.whitePlayer));
const id = () => crypto.randomUUID();
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function checkWin(board, row, col, color) {
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const line = [{ row, col }];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = col + dc * sign;
      while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === color) {
        line.push({ row: r, col: c });
        r += dr * sign; c += dc * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

function play(room, color, row, col) {
  if (room.status !== 'playing') return '游戏未开始或已结束';
  if (room.undoRequestStatus === 'pending' || room.restartRequestStatus === 'pending') return '请先处理对局请求';
  if (room.currentPlayer !== color) return '还没轮到你落子';
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= SIZE || col >= SIZE) return '落子位置超出棋盘范围';
  if (room.board[row][col] !== null) return '该位置已有棋子';
  room.board[row][col] = color;
  room.moveHistory.push({ row, col, player: color });
  room.moveCount = room.moveHistory.length;
  room.lastMove = { row, col };
  room.currentPlayer = other(color);
  room.winningLine = checkWin(room.board, row, col, color);
  if (room.winningLine || room.moveCount === SIZE * SIZE) {
    room.status = 'ended';
    room.winner = room.winningLine ? color : null;
  }
  return null;
}

function rewind(room, count) {
  room.moveHistory.splice(-Math.min(count, room.moveHistory.length));
  room.board = emptyBoard();
  for (const move of room.moveHistory) room.board[move.row][move.col] = move.player;
  room.moveCount = room.moveHistory.length;
  room.lastMove = room.moveHistory.length ? { row: room.moveHistory.at(-1).row, col: room.moveHistory.at(-1).col } : null;
  room.currentPlayer = room.moveHistory.length ? other(room.moveHistory.at(-1).player) : 'black';
  room.status = 'playing'; room.winner = null; room.winningLine = null;
  room.undoRequestBy = null; room.undoRequestStatus = null;
}

function roomShape(code, blackPlayer, whitePlayer, difficulty = null) {
  return {
    id: id(), roomCode: code, board: emptyBoard(), currentPlayer: 'black',
    blackPlayer, whitePlayer, status: difficulty ? 'playing' : 'waiting',
    winner: null, winningLine: null, lastMove: null, moveCount: 0, moveHistory: [],
    undoRequestBy: null, undoRequestStatus: null, aiDifficulty: difficulty, aiPendingSince: null,
    restartRequestBy: null, restartRequestStatus: null,
  };
}

function choose(board, color, difficulty, history = []) {
  const level = ['easy', 'normal', 'hard', 'hell', 'godlike'].includes(difficulty) ? difficulty : 'hard';
  try {
    const result = findBestMove(board, color, level === 'godlike' ? 'hell' : level, history);
    if (result && board[result.row]?.[result.col] === null) return result;
  } catch (_) {}
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] === null) return { row: r, col: c };
  return null;
}

function winRate(board) {
  const score = evaluateBoard(board, 'black');
  const magnitude = Math.abs(score);
  const edge = magnitude >= 100000 ? 0.99 : magnitude >= 10000 ? 0.9 : magnitude >= 5000 ? 0.75 : magnitude >= 500 ? 0.6 : magnitude >= 200 ? 0.55 : 0.5;
  const draw = magnitude < 200 ? 10 : magnitude < 5000 ? 5 : 2;
  const lead = Math.round((100 - draw) * edge);
  const trail = 100 - draw - lead;
  const black = score >= 0 ? lead : trail;
  const white = score >= 0 ? trail : lead;
  const [level, description, advantage] = black >= 90 ? ['winning', '黑方必胜', 'black']
    : black >= 70 ? ['big_advantage', '黑方大优', 'black']
    : black >= 55 ? ['slight_advantage', '黑方稍优', 'black']
    : black >= 45 ? ['balanced', '势均力敌', 'balanced']
    : black >= 30 ? ['slight_disadvantage', '黑方稍劣', 'white']
    : black >= 10 ? ['big_disadvantage', '黑方大劣', 'white']
    : ['losing', '黑方必败', 'white'];
  return { black, white, draw, level, description, advantage };
}

function hint(room, color, difficulty) {
  if (!room || room.status !== 'playing') return { valid: false, hint: null, analysis: null, winRate: null, message: '游戏未开始或已结束' };
  const move = choose(room.board, color, difficulty, room.moveHistory);
  let analysis = null;
  if (move) {
    const { attackScore, defenseScore } = evaluatePositionBoth(room.board, move.row, move.col, color, color === 'white');
    const intention = attackScore > defenseScore * 1.5 ? 'attack' : defenseScore > attackScore * 1.5 ? 'defense' : 'balanced';
    const urgent = Math.max(attackScore, defenseScore) >= 10000;
    analysis = {
      intention,
      intentionText: intention === 'attack' ? '进攻为主，主动出击' : intention === 'defense' ? '防守优先，化解威胁' : '攻守兼备，把握关键',
      alternatives: [],
      pattern: urgent ? '关键连线落点' : '发展棋形的要点',
      reasoning: intention === 'attack' ? '此处有利于延伸己方连线' : intention === 'defense' ? '此处能阻断对手的进攻路线' : '此处兼顾己方发展与对手威胁',
      nextSteps: urgent ? '优先处理连续成五的机会与威胁' : '观察对手回应，再沿优势方向继续布局',
    };
  }
  return { valid: !!move, hint: move, winRate: winRate(room.board), analysis };
}

export class GomokuRooms {
  constructor(state) { this.state = state; }
  key(code) { return `room:${code}`; }
  async load(code) { return this.state.storage.get(this.key(code)); }
  async save(room) { await this.state.storage.put(this.key(room.roomCode), room); }
  async chat(code) { return await this.state.storage.get(`chat:${code}`) || []; }
  async system(code, content) {
    const messages = await this.chat(code);
    messages.push({ id: id(), roomCode: code, senderId: null, senderColor: null, content, msgType: 'system', createdAt: new Date().toISOString() });
    await this.state.storage.put(`chat:${code}`, messages.slice(-200));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    let data = {};
    if (request.method === 'POST') {
      try { data = await request.json(); } catch (_) { return json({ message: '请求格式错误' }, 400); }
    }
    try { return json(await this.route(path, request.method, data)); }
    catch (error) { return json({ message: error.message || '服务器错误' }, error.status || 500); }
  }

  async route(path, method, data) {
    const fail = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
    const load = async code => {
      const room = await this.load(String(code || ''));
      if (!room) fail('房间不存在', 404);
      let expired = false;
      for (const kind of ['undo', 'restart']) {
        if (room[`${kind}RequestStatus`] === 'pending' &&
            (!room[`${kind}RequestedAt`] || Date.now() - room[`${kind}RequestedAt`] > REQUEST_TIMEOUT_MS)) {
          room[`${kind}RequestStatus`] = 'rejected';
          room[`${kind}RequestedAt`] = null;
          expired = true;
        }
      }
      if (expired) await this.save(room);
      if (room.status === 'ended' && !room.winner && room.moveCount < SIZE * SIZE && room.moveHistory.length) {
        const last = room.moveHistory.at(-1);
        if (checkWin(room.board, last.row, last.col, last.player)) {
          room.winner = last.player;
          room.winningLine = checkWin(room.board, last.row, last.col, last.player);
          await this.save(room);
        }
      }
      return room;
    };
    const playerColor = (room, playerId) => room.blackPlayer === playerId ? 'black' : room.whitePlayer === playerId ? 'white' : null;
    const requirePlayer = (room, playerId) => playerColor(room, playerId) || fail('你不是该房间的玩家');
    const save = async room => { await this.save(room); return { room }; };

    if (path === '/api/gomoku/rooms' && method === 'POST') {
      const playerId = String(data.playerId || '');
      if (!playerId) fail('缺少玩家标识');
      let code = String(data.roomCode || '').toUpperCase();
      if (code && !/^[A-Z0-9]{4,20}$/.test(code)) fail('房间号格式不正确，需为4-20位字母或数字组合');
      if (code) { if (await this.load(code)) fail('该房间号已存在'); }
      else {
        for (let i = 0; i < 30; i++) {
          code = String(100000 + Math.floor(Math.random() * 900000));
          if (!await this.load(code)) break;
        }
        if (await this.load(code)) fail('无法生成唯一房间号，请稍后再试');
      }
      const color = data.playerColor === 'white' ? 'white' : 'black';
      const room = roomShape(code, color === 'black' ? playerId : null, color === 'white' ? playerId : null);
      await this.save(room);
      return { room, playerColor: color };
    }

    if (path === '/api/gomoku/rooms/join' && method === 'POST') {
      const room = await load(data.roomCode);
      const playerId = String(data.playerId || '');
      let color = playerColor(room, playerId);
      if (!color) {
        if (room.status !== 'waiting' && !isAi(room.blackPlayer) && !isAi(room.whitePlayer)) fail('房间状态不允许加入');
        color = !room.blackPlayer || isAi(room.blackPlayer) ? 'black' : !room.whitePlayer || isAi(room.whitePlayer) ? 'white' : null;
        if (!color) fail('房间已满');
        room[color === 'black' ? 'blackPlayer' : 'whitePlayer'] = playerId;
        if (room.blackPlayer && room.whitePlayer) room.status = 'playing';
        await this.save(room);
        await this.system(room.roomCode, `${color === 'black' ? '黑方' : '白方'} 加入了房间`);
      }
      return { room, playerColor: color };
    }

    const roomGet = /^\/api\/gomoku\/rooms\/([^/]+)$/.exec(path);
    if (roomGet && method === 'GET') return { room: await load(decodeURIComponent(roomGet[1])) };
    const soloGet = /^\/api\/gomoku\/solo\/([^/]+)$/.exec(path);
    if (soloGet && method === 'GET') {
      const room = await load(decodeURIComponent(soloGet[1]));
      if (isSolo(room) && room.status === 'playing' && room.aiPendingSince && Date.now() - room.aiPendingSince > 12000) {
        const color = room.currentPlayer;
        if (isAi(color === 'black' ? room.blackPlayer : room.whitePlayer)) {
          const move = choose(room.board, color, room.aiDifficulty || 'hard', room.moveHistory);
          if (move) play(room, color, move.row, move.col);
          room.aiPendingSince = null;
          await this.save(room);
        }
      }
      return { room };
    }

    if (path === '/api/gomoku/solo/create') {
      const playerId = String(data.playerId || '');
      const color = data.playerColor === 'white' ? 'white' : 'black';
      const difficulty = ['easy', 'normal', 'hard', 'hell', 'godlike'].includes(data.difficulty) ? data.difficulty : 'hard';
      const code = data.roomCode || `S${id().replace(/-/g, '').slice(0, 12).toUpperCase()}_${difficulty}`;
      const room = roomShape(code, color === 'black' ? playerId : 'ai_black', color === 'white' ? playerId : 'ai_white', difficulty);
      if (color === 'white') {
        if (data.deferAi) room.aiPendingSince = Date.now();
        else { const move = choose(room.board, 'black', difficulty); if (move) play(room, 'black', move.row, move.col); }
      }
      await this.save(room);
      return { room, playerColor: color };
    }

    if (path === '/api/gomoku/solo/difficulty') {
      const room = await load(data.roomCode);
      requirePlayer(room, data.playerId);
      if (!isSolo(room)) fail('不是单人棋局');
      if (!['easy', 'normal', 'hard', 'hell'].includes(data.difficulty)) fail('难度无效');
      room.aiDifficulty = data.difficulty;
      await this.save(room);
      return { room };
    }

    if (path === '/api/gomoku/analyze-board') {
      let board;
      try { board = typeof data.board === 'string' ? JSON.parse(data.board) : data.board; } catch (_) { fail('棋盘格式错误'); }
      if (!Array.isArray(board) || board.length !== SIZE) fail('棋盘格式错误');
      return hint({ board, status: 'playing', moveHistory: [] }, data.currentPlayer === 'white' ? 'white' : 'black', data.difficulty || 'hard');
    }

    if (path === '/api/gomoku/rooms/chat') {
      await load(data.roomCode);
      const messages = await this.chat(data.roomCode);
      return { valid: true, messages: data.sinceTime ? messages.filter(m => m.createdAt > data.sinceTime) : messages };
    }
    if (path === '/api/gomoku/rooms/chat/send') {
      const room = await load(data.roomCode);
      if (isSolo(room)) return { valid: false, message: '单人模式不支持聊天' };
      const color = playerColor(room, data.playerId);
      if (!color) return { valid: false, message: '你不是该房间的玩家，无法发送消息' };
      const content = String(data.content || '').trim().slice(0, 500);
      if (!content) return { valid: false, message: '消息内容不能为空' };
      const chatMessage = { id: id(), roomCode: room.roomCode, senderId: data.playerId, senderColor: color, content, msgType: 'player', createdAt: new Date().toISOString() };
      const messages = await this.chat(room.roomCode);
      messages.push(chatMessage);
      await this.state.storage.put(`chat:${room.roomCode}`, messages.slice(-200));
      return { valid: true, chatMessage };
    }

    if (path === '/api/gomoku/rooms/move' || path === '/api/gomoku/solo/move') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      const message = play(room, color, data.row, data.col);
      if (message) return { room, valid: false, message };
      if (path.includes('/solo/') && room.status === 'playing' && !data.deferAi && room.aiDifficulty !== 'godlike') {
        const aiColor = room.currentPlayer;
        const move = choose(room.board, aiColor, room.aiDifficulty || 'hard', room.moveHistory);
        if (move) play(room, aiColor, move.row, move.col);
      }
      if (path.includes('/solo/') && room.status === 'playing' && isAi(room.currentPlayer === 'black' ? room.blackPlayer : room.whitePlayer)) {
        room.aiPendingSince = Date.now();
      }
      await this.save(room);
      return path.includes('/solo/') ? { room, valid: true, aiThinking: !!room.aiPendingSince, opponentAnalysis: null } : { room, valid: true };
    }

    if (path === '/api/gomoku/solo/ai-reply') {
      const room = await load(data.roomCode);
      requirePlayer(room, data.playerId);
      if (!isSolo(room) || room.status !== 'playing') return { room, valid: false, message: '游戏已结束' };
      const color = room.currentPlayer;
      if (!isAi(color === 'black' ? room.blackPlayer : room.whitePlayer)) return { room, valid: false, message: '当前不是 AI 回合' };
      const fallbackDifficulty = room.aiDifficulty === 'hell' || room.aiDifficulty === 'godlike' ? 'hard' : room.aiDifficulty === 'hard' ? 'normal' : room.aiDifficulty;
      const chosen = room.board[data.row]?.[data.col] === null ? { row: data.row, col: data.col } : choose(room.board, color, fallbackDifficulty || 'hard', room.moveHistory);
      if (!chosen) return { room, valid: false, message: '棋盘已满' };
      play(room, color, chosen.row, chosen.col);
      room.aiPendingSince = null;
      await this.save(room);
      return { room, valid: true };
    }

    if (path === '/api/gomoku/rooms/ai-move' || path === '/api/gomoku/solo/ai-move') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      if (room.status !== 'playing' || room.currentPlayer !== color) return { room, valid: false, message: '还没轮到你落子' };
      const move = choose(room.board, color, data.difficulty || 'hell', room.moveHistory);
      if (!move) return { room, valid: false, message: '棋盘已满' };
      play(room, color, move.row, move.col);
      if (path.includes('/solo/') && room.status === 'playing') {
        const aiMove = choose(room.board, room.currentPlayer, room.aiDifficulty || 'hard', room.moveHistory);
        if (aiMove) play(room, room.currentPlayer, aiMove.row, aiMove.col);
      }
      await this.save(room);
      return { room, valid: true, opponentAnalysis: null };
    }

    if (path === '/api/gomoku/rooms/ai-hint' || path === '/api/gomoku/solo/ai-hint') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      return hint(room, color, data.difficulty || 'hell');
    }
    if (path === '/api/gomoku/rooms/analyze') {
      const room = await load(data.roomCode);
      const result = hint(room, room.currentPlayer, data.difficulty || 'hell');
      return { valid: result.valid, bestMove: result.hint, analysis: result.analysis, winRate: result.winRate };
    }
    if (path === '/api/gomoku/rooms/winrate' || path === '/api/gomoku/solo/winrate') {
      const room = await load(data.roomCode);
      if (room.status === 'ended') return { valid: true, winRate: {
        black: room.winner === 'black' ? 100 : 0,
        white: room.winner === 'white' ? 100 : 0,
        draw: room.winner ? 0 : 100,
        level: room.winner === 'black' ? 'winning' : room.winner === 'white' ? 'losing' : 'balanced',
        description: room.winner ? `${room.winner === 'black' ? '黑' : '白'}方获胜` : '平局',
        advantage: room.winner || 'balanced',
      } };
      return { valid: true, winRate: winRate(room.board) };
    }

    if (path === '/api/gomoku/rooms/restart') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      if (isSolo(room) || room.status === 'waiting' || !room.blackPlayer || !room.whitePlayer) return { room, success: false, message: '对方尚未加入房间' };
      if (room.restartRequestStatus === 'pending' || room.undoRequestStatus === 'pending') return { room, success: false, message: '请先处理当前请求' };
      room.restartRequestBy = color; room.restartRequestStatus = 'pending'; room.restartRequestedAt = Date.now();
      if (isAi(room[color === 'black' ? 'whitePlayer' : 'blackPlayer'])) {
        room.board = emptyBoard(); room.currentPlayer = 'black'; room.status = 'playing';
        room.winner = null; room.winningLine = null; room.lastMove = null; room.moveCount = 0; room.moveHistory = [];
        room.restartRequestStatus = 'accepted'; room.restartRequestedAt = null;
        if (isAi(room.blackPlayer)) {
          const move = choose(room.board, 'black', room.aiDifficulty || 'hard');
          if (move) play(room, 'black', move.row, move.col);
        }
      }
      await this.save(room);
      return { room, success: true };
    }
    if (path === '/api/gomoku/rooms/restart-respond') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      if (room.restartRequestStatus !== 'pending' || room.restartRequestBy === color) return { room, success: false, message: '没有待处理的重新开始请求' };
      if (data.accept) {
        room.board = emptyBoard(); room.currentPlayer = 'black'; room.status = 'playing';
        room.winner = null; room.winningLine = null; room.lastMove = null; room.moveCount = 0; room.moveHistory = [];
        room.undoRequestBy = null; room.undoRequestStatus = null; room.undoRequestedAt = null;
      }
      room.restartRequestStatus = data.accept ? 'accepted' : 'rejected'; room.restartRequestedAt = null;
      await this.save(room);
      return { room, success: true };
    }
    if (path === '/api/gomoku/solo/restart') {
      const room = await load(data.roomCode);
      requirePlayer(room, data.playerId);
      room.board = emptyBoard(); room.currentPlayer = 'black'; room.status = isSolo(room) || room.blackPlayer && room.whitePlayer ? 'playing' : 'waiting';
      room.winner = null; room.winningLine = null; room.lastMove = null; room.moveCount = 0; room.moveHistory = [];
      room.undoRequestBy = null; room.undoRequestStatus = null; room.aiPendingSince = null;
      if (isSolo(room) && isAi(room.blackPlayer)) {
        if (data.deferAi) room.aiPendingSince = Date.now();
        else { const move = choose(room.board, 'black', room.aiDifficulty); if (move) play(room, 'black', move.row, move.col); }
      }
      await this.save(room);
      return { room };
    }

    if (path === '/api/gomoku/solo/undo') {
      const room = await load(data.roomCode);
      requirePlayer(room, data.playerId);
      if (!isSolo(room) || !room.moveCount) return { room, success: false, message: '没有可悔的棋' };
      const count = isAi(room.moveHistory.at(-1).player === 'black' ? room.blackPlayer : room.whitePlayer) ? 2 : 1;
      rewind(room, count);
      room.aiPendingSince = null;
      await this.save(room);
      return { room, success: true };
    }
    if (path === '/api/gomoku/rooms/undo-request') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      if (!room.moveCount || room.undoRequestStatus === 'pending' || room.restartRequestStatus === 'pending' || !room.blackPlayer || !room.whitePlayer) return { room, success: false, message: '暂时不能悔棋' };
      room.undoRequestBy = color; room.undoRequestStatus = 'pending'; room.undoRequestedAt = Date.now();
      if (isAi(room[color === 'black' ? 'whitePlayer' : 'blackPlayer'])) {
        const lastColor = room.moveHistory.at(-1).player;
        rewind(room, lastColor === color ? 1 : 2);
        room.undoRequestBy = color; room.undoRequestStatus = 'accepted'; room.undoRequestedAt = null;
      }
      await this.save(room);
      return { room, success: true };
    }
    if (path === '/api/gomoku/rooms/undo-respond') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      if (room.undoRequestStatus !== 'pending' || room.undoRequestBy === color) return { room, success: false, message: '没有待处理的悔棋请求' };
      if (data.accept) rewind(room, 1);
      room.undoRequestStatus = data.accept ? 'accepted' : 'rejected'; room.undoRequestedAt = null;
      await this.save(room);
      return { room, success: true };
    }

    if (path === '/api/gomoku/rooms/ai-substitute' || path === '/api/gomoku/rooms/remove-ai-substitute') {
      const room = await load(data.roomCode);
      requirePlayer(room, data.playerId);
      const color = data.targetColor === 'black' ? 'black' : 'white';
      const key = color === 'black' ? 'blackPlayer' : 'whitePlayer';
      if (path.includes('remove-ai')) {
        if (!isAi(room[key])) return { room, success: false, message: '该方不是 AI' };
        room[key] = null; room.status = 'waiting';
      } else {
        if (room[key] && !isAi(room[key])) return { room, success: false, message: '该位置已有玩家' };
        room[key] = `ai_${color}`; room.status = 'playing';
        if (room.currentPlayer === color) { const move = choose(room.board, color, data.difficulty || 'hell', room.moveHistory); if (move) play(room, color, move.row, move.col); }
      }
      await this.save(room);
      return { room, success: true };
    }

    if (path === '/api/gomoku/rooms/leave') {
      const room = await load(data.roomCode);
      const color = requirePlayer(room, data.playerId);
      room[color === 'black' ? 'blackPlayer' : 'whitePlayer'] = null;
      if (room.undoRequestStatus === 'pending') room.undoRequestStatus = 'rejected';
      if (room.restartRequestStatus === 'pending') room.restartRequestStatus = 'rejected';
      if (room.status !== 'ended') room.status = 'waiting';
      await this.save(room);
      await this.system(room.roomCode, `${color === 'black' ? '黑方' : '白方'} 离开了房间`);
      return { success: true };
    }

    fail('接口不存在', 404);
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/healthz') return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    if (path.startsWith('/api/gomoku/')) {
      const getCode = /^\/api\/gomoku\/(?:rooms|solo)\/([^/]+)$/.exec(path);
      let code = getCode ? decodeURIComponent(getCode[1]) : '';
      if (request.method === 'POST') {
        let data;
        try { data = await request.clone().json(); }
        catch { return json({ message: '请求格式错误' }, 400); }
        code = String(data.roomCode || '');
        if (path === '/api/gomoku/rooms' && !code) {
          code = String(100000 + Math.floor(Math.random() * 900000));
          request = new Request(request, { body: JSON.stringify({ ...data, roomCode: code }) });
        } else if (path === '/api/gomoku/solo/create') {
          code = `S${id().replace(/-/g, '').slice(0, 12).toUpperCase()}_${data.difficulty || 'hard'}`;
          request = new Request(request, { body: JSON.stringify({ ...data, roomCode: code }) });
        }
      }
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code || 'analysis'));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
