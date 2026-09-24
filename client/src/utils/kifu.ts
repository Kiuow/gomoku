import type { PlayerColor, Move } from '@shared/api.interface';

export interface KifuMove {
  row: number;
  col: number;
  player: PlayerColor;
  moveTime?: number;
}

export type GameMode = 'solo' | 'online' | 'practice' | 'free';

export type GameResult = 'black' | 'white' | 'draw' | 'unknown';

export interface KifuRecord {
  id: string;
  name: string;
  mode: GameMode;
  result: GameResult;
  moves: KifuMove[];
  moveCount: number;
  createdAt: number;
  blackPlayer?: string;
  whitePlayer?: string;
  difficulty?: string;
}

const STORAGE_KEY = 'gomoku_kifu_records';
const MAX_RECORDS = 50;

export function loadKifuList(): KifuRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as KifuRecord[];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveKifu(record: Omit<KifuRecord, 'id' | 'createdAt'>): KifuRecord {
  const list = loadKifuList();
  const newRecord: KifuRecord = {
    ...record,
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    createdAt: Date.now(),
  };
  list.unshift(newRecord);
  if (list.length > MAX_RECORDS) {
    list.length = MAX_RECORDS;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return newRecord;
}

export function deleteKifu(id: string): void {
  const list = loadKifuList().filter((r: KifuRecord) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearAllKifu(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getKifuById(id: string): KifuRecord | null {
  const list = loadKifuList();
  return list.find((r: KifuRecord) => r.id === id) || null;
}

export function isKifuFull(): boolean {
  return loadKifuList().length >= MAX_RECORDS;
}

export const KIFU_MAX_RECORDS = MAX_RECORDS;

export function movesToSgf(record: KifuRecord): string {
  const date = new Date(record.createdAt);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const lines: string[] = [
    '(;GM[4]FF[4]SZ[15]',
    `GN[${record.name}]`,
    `DT[${dateStr}]`,
    `RE[${record.result === 'black' ? 'B+' : record.result === 'white' ? 'W+' : record.result === 'draw' ? '0' : ''}]`,
    `PB[${record.blackPlayer || '黑方'}]`,
    `PW[${record.whitePlayer || '白方'}]`,
    `KM[0]`,
    `RU[五子棋]`,
  ];
  for (let i = 0; i < record.moves.length; i++) {
    const m = record.moves[i];
    const colLetter = String.fromCharCode(97 + m.col);
    const rowLetter = String.fromCharCode(97 + (14 - m.row));
    const color = m.player === 'black' ? 'B' : 'W';
    lines.push(`;${color}[${colLetter}${rowLetter}]`);
  }
  lines.push(')');
  return lines.join('\n');
}

function sgfCoordToMove(coord: string, player: PlayerColor): KifuMove | null {
  if (coord.length !== 2) return null;
  const col = coord.charCodeAt(0) - 97;
  const row = 14 - (coord.charCodeAt(1) - 97);
  if (col < 0 || col > 14 || row < 0 || row > 14) return null;
  return { row, col, player };
}

export function sgfToKifu(sgfText: string): Omit<KifuRecord, 'id' | 'createdAt'> | null {
  const trimmed = sgfText.trim();
  if (!trimmed.startsWith('(')) return null;
  
  const moves: KifuMove[] = [];
  let name = '导入棋谱';
  let result: GameResult = 'unknown';
  let blackPlayer = '黑方';
  let whitePlayer = '白方';

  const nameMatch = trimmed.match(/GN\[([^\]]*)\]/);
  if (nameMatch) name = nameMatch[1];
  
  const reMatch = trimmed.match(/RE\[([^\]]*)\]/);
  if (reMatch) {
    const re = reMatch[1];
    if (re.startsWith('B+')) result = 'black';
    else if (re.startsWith('W+')) result = 'white';
    else if (re === '0' || re === 'Draw') result = 'draw';
  }

  const pbMatch = trimmed.match(/PB\[([^\]]*)\]/);
  if (pbMatch) blackPlayer = pbMatch[1];
  const pwMatch = trimmed.match(/PW\[([^\]]*)\]/);
  if (pwMatch) whitePlayer = pwMatch[1];

  const moveRegex = /;([BW])\[([a-z]{2})\]/g;
  let match: RegExpExecArray | null;
  while ((match = moveRegex.exec(trimmed)) !== null) {
    const player: PlayerColor = match[1] === 'B' ? 'black' : 'white';
    const move = sgfCoordToMove(match[2], player);
    if (move) moves.push(move);
  }

  if (moves.length === 0) return null;

  return {
    name,
    mode: 'free',
    result,
    moves,
    moveCount: moves.length,
    blackPlayer,
    whitePlayer,
  };
}

export function generateDefaultName(
  mode: GameMode,
  result: GameResult,
  date?: Date,
): string {
  const d = date || new Date();
  const dateStr = d.toISOString().slice(0, 10);
  const modeMap: Record<GameMode, string> = {
    solo: '单人',
    online: '联机',
    practice: '双人练习',
    free: '自由摆盘',
  };
  const resultMap: Record<GameResult, string> = {
    black: '黑胜',
    white: '白胜',
    draw: '平局',
    unknown: '未结束',
  };
  return `${dateStr} ${modeMap[mode]}-${resultMap[result]}`;
}

export function buildBoardFromMoves(moves: KifuMove[], upToIndex: number): string[][] {
  const board: string[][] = Array.from({ length: 15 }, () => Array(15).fill(''));
  const end = Math.min(upToIndex, moves.length);
  for (let i = 0; i < end; i++) {
    const m = moves[i];
    board[m.row][m.col] = m.player;
  }
  return board;
}

export function checkWinFromMoves(
  moves: KifuMove[],
  lastMoveIndex: number,
): { winner: PlayerColor; line: Move[] } | null {
  if (lastMoveIndex < 0 || lastMoveIndex >= moves.length) return null;
  const last = moves[lastMoveIndex];
  const board = buildBoardFromMoves(moves, lastMoveIndex + 1);
  const { row, col, player } = last;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (const [dr, dc] of directions) {
    const line: Move[] = [{ row, col }];
    for (let s = 1; s < 5; s++) {
      const nr = row + dr * s;
      const nc = col + dc * s;
      if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
      if (board[nr][nc] !== player) break;
      line.push({ row: nr, col: nc });
    }
    for (let s = 1; s < 5; s++) {
      const nr = row - dr * s;
      const nc = col - dc * s;
      if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
      if (board[nr][nc] !== player) break;
      line.unshift({ row: nr, col: nc });
    }
    if (line.length >= 5) {
      return { winner: player, line };
    }
  }
  return null;
}
