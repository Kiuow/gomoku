import type { GomokuRoom, Move, PlayerColor, WinRateInfo } from '@shared/api.interface';

interface RapfiBridge {
  ensure(): Promise<boolean>;
  findBestMove(board: number[], player: number, budget: number): Promise<Move | null>;
  analyze(board: number[], player: number, budget: number): Promise<{ move: Move | null; eval: number | null } | null>;
  newGame(): void;
  onChange(fn: (state: string) => void): void;
}

declare global {
  interface Window { RapfiBridge?: RapfiBridge }
}

let activeRoomCode: string | null = null;

function completesFive(board: GomokuRoom['board'], row: number, col: number, color: PlayerColor): boolean {
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === color) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

function forcedMove(board: GomokuRoom['board'], color: PlayerColor): Move | null {
  for (const target of [color, color === 'black' ? 'white' : 'black'] as PlayerColor[]) {
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (board[row][col] === null && completesFive(board, row, col, target)) return { row, col };
      }
    }
  }
  return null;
}

export async function rapfiMove(room: GomokuRoom, color: PlayerColor, budget = 2000): Promise<Move | null> {
  const forced = forcedMove(room.board, color);
  if (forced) return forced;
  const bridge = window.RapfiBridge;
  if (!bridge || !await bridge.ensure()) return null;
  if (activeRoomCode !== room.roomCode) {
    bridge.newGame();
    activeRoomCode = room.roomCode;
  }
  const board = room.board.flat().map(cell => cell === 'black' ? 1 : cell === 'white' ? 2 : 0);
  const move = await bridge.findBestMove(board, color === 'black' ? 1 : 2, budget);
  return move && room.board[move.row]?.[move.col] == null ? move : null;
}

export async function rapfiWinRate(room: GomokuRoom): Promise<WinRateInfo | null> {
  if (room.status === 'ended') {
    const black = room.winner === 'black' ? 100 : 0;
    const white = room.winner === 'white' ? 100 : 0;
    return { black, white, draw: room.winner ? 0 : 100,
      description: room.winner ? `${room.winner === 'black' ? '黑' : '白'}方获胜` : '平局',
      advantage: room.winner ?? 'balanced',
      level: room.winner === 'black' ? 'winning' : room.winner === 'white' ? 'losing' : 'balanced' };
  }
  const bridge = window.RapfiBridge;
  if (!bridge || !await bridge.ensure()) return null;
  if (activeRoomCode !== room.roomCode) {
    bridge.newGame();
    activeRoomCode = room.roomCode;
  }
  const board = room.board.flat().map(cell => cell === 'black' ? 1 : cell === 'white' ? 2 : 0);
  const result = await bridge.analyze(board, room.currentPlayer === 'black' ? 1 : 2, 600);
  if (!result || !Number.isFinite(result.eval)) return null;
  // Rapfi 的 Eval 是当前行棋方视角的搜索分数，不是直接的百分比。
  const blackScore = room.currentPlayer === 'black' ? result.eval! : -result.eval!;
  const draw = Math.round(8 * Math.exp(-Math.abs(blackScore) / 450));
  const black = Math.round((100 - draw) / (1 + Math.exp(-blackScore / 450)));
  const white = 100 - draw - black;
  const advantage = black >= 55 ? 'black' : white >= 55 ? 'white' : 'balanced';
  const level = black >= 90 ? 'winning' : black >= 70 ? 'big_advantage' : black >= 55 ? 'slight_advantage'
    : black >= 45 ? 'balanced' : black >= 30 ? 'slight_disadvantage' : black >= 10 ? 'big_disadvantage' : 'losing';
  const description = advantage === 'balanced' ? '局势接近' : `${advantage === 'black' ? '黑' : '白'}方${Math.max(black, white) >= 70 ? '优势' : '稍优'}`;
  return { black, white, draw, description, advantage, level };
}
