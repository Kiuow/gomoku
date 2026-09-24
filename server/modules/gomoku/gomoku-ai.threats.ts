import type { PlayerColor, Move } from '@shared/api.interface';
import { 
   BOARD_SIZE, 
   SCORE, 
   DIRS, 
   analyzeLine, 
   getOpponent, 
   isInside, 
   checkWin,
   cloneBoard,
 } from './gomoku-ai.engine';

 import type { PatternType } from './gomoku-ai.engine';

const MAX_VCF_NODES = 200000;
const MAX_VCT_NODES = 80000;

interface ThreatCounter {
  count: number;
  stopped: boolean;
}

function createThreatCounter(): ThreatCounter {
  return { count: 0, stopped: false };
}

function checkThreatTime(counter: ThreatCounter, limit: number): boolean {
  if (counter.stopped) return true;
  if (counter.count >= limit) {
    counter.stopped = true;
    return true;
  }
  return false;
}

// ============================================================
// 1. 候选点收集（已棋子周围2格内的空位）
// ============================================================

/**
 * 收集已有棋子周围 2 格内的所有空位，作为候选搜索点。
 */
function getCandidatePoints(board: (string | null)[][]): Move[] {
  const candidates: Move[] = [];
  const seen = new Set<string>();

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            const key = `${nr},${nc}`;
            if (
              isInside(nr, nc) &&
              board[nr][nc] === null &&
              !seen.has(key)
            ) {
              seen.add(key);
              candidates.push({ row: nr, col: nc });
            }
          }
        }
      }
    }
  }

  return candidates;
}

// ============================================================
// 2. 威胁点生成函数
// ============================================================

/**
 * 在 (row,col) 落 player 子后，返回 4 个方向上最强的棋型类型。
 */
function getStrongestPattern(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
): PatternType {
  let best: PatternType = 'NONE';
  const priority: PatternType[] = [
    'FIVE',
    'OPEN_FOUR',
    'CLOSED_FOUR',
    'OPEN_THREE',
    'CLOSED_THREE',
    'OPEN_TWO',
    'CLOSED_TWO',
    'OPEN_ONE',
    'NONE',
  ];

  board[row][col] = player;
  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, player);
    if (priority.indexOf(analysis.type) < priority.indexOf(best)) {
      best = analysis.type;
    }
  }
  board[row][col] = null;

  return best;
}

export interface FourPoint {
  row: number;
  col: number;
  type: 'open_four' | 'closed_four';
}

/**
 * 找所有能形成冲四/活四的点。
 * 只遍历已棋子周围 2 格内的空位。
 * 返回的 type 取最强类型（活四 > 冲四）。
 */
export function findFourPoints(
  board: (string | null)[][],
  player: PlayerColor,
): FourPoint[] {
  const result: FourPoint[] = [];
  const candidates = getCandidatePoints(board);

  for (const { row, col } of candidates) {
    const pattern = getStrongestPattern(board, row, col, player);
    if (pattern === 'OPEN_FOUR') {
      result.push({ row, col, type: 'open_four' });
    } else if (pattern === 'CLOSED_FOUR') {
      result.push({ row, col, type: 'closed_four' });
    }
  }

  // 活四在前，冲四在后
  result.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === 'open_four' ? -1 : 1;
  });

  return result;
}

export interface ThreePoint {
  row: number;
  col: number;
  type: 'open_three' | 'closed_three';
}

/**
 * 找所有能形成活三/眠三的点。
 * 注意：如果某个点能形成四（活四/冲四），它不会出现在这里；
 * 本函数只返回最强棋型为活三或眠三的点。
 */
export function findThreePoints(
  board: (string | null)[][],
  player: PlayerColor,
): ThreePoint[] {
  const result: ThreePoint[] = [];
  const candidates = getCandidatePoints(board);

  for (const { row, col } of candidates) {
    const pattern = getStrongestPattern(board, row, col, player);
    if (pattern === 'OPEN_THREE') {
      result.push({ row, col, type: 'open_three' });
    } else if (pattern === 'CLOSED_THREE') {
      result.push({ row, col, type: 'closed_three' });
    }
  }

  // 活三在前，眠三在后
  result.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === 'open_three' ? -1 : 1;
  });

  return result;
}

export interface DefensePoint {
  row: number;
  col: number;
  threatLevel: number;
}

/**
 * 找对方（opponent）能形成四或活三的位置（必须防守的点）。
 * 按威胁等级从高到低排序：活四 > 冲四 > 活三 > 眠三。
 * threatLevel 使用 SCORE 中对应值。
 */
export function findDefensePoints(
  board: (string | null)[][],
  opponent: PlayerColor,
): DefensePoint[] {
  const result: DefensePoint[] = [];
  const candidates = getCandidatePoints(board);

  for (const { row, col } of candidates) {
    const pattern = getStrongestPattern(board, row, col, opponent);
    let threatLevel = 0;
    switch (pattern) {
      case 'FIVE':
        threatLevel = SCORE.FIVE;
        break;
      case 'OPEN_FOUR':
        threatLevel = SCORE.OPEN_FOUR;
        break;
      case 'CLOSED_FOUR':
        threatLevel = SCORE.CLOSED_FOUR;
        break;
      case 'OPEN_THREE':
        threatLevel = SCORE.OPEN_THREE;
        break;
      case 'CLOSED_THREE':
        threatLevel = SCORE.CLOSED_THREE;
        break;
      default:
        break;
    }
    if (threatLevel > 0) {
      result.push({ row, col, threatLevel });
    }
  }

  // 威胁等级从高到低排序
  result.sort((a, b) => b.threatLevel - a.threatLevel);
  return result;
}

// ============================================================
// 3. VCF 求解器（Victory by Continuous Fours）
// ============================================================

export interface VCFResult {
  found: boolean;
  moves: Move[];
  depth: number;
}

/**
 * VCF 核心搜索（AND-OR 搜索）。
 * - 进攻方回合（OR 节点）：找到一条冲四路线能赢即可
 * - 防守方回合（AND 节点）：所有防守点下都能赢才算 VCF 成立
 *
 * 使用棋盘就地修改（落子/提子），不克隆棋盘。
 *
 * @param board 当前棋盘（会被就地修改，调用后恢复原样）
 * @param attacker 进攻方
 * @param depth 剩余深度（只计进攻方步数）
 * @param isAttackerTurn 当前是否进攻方回合
 */
function vcfSearch(
   board: (string | null)[][],
   attacker: PlayerColor,
   depth: number,
   isAttackerTurn: boolean,
   counter: ThreatCounter,
 ): VCFResult {
  counter.count += 1;
  if (checkThreatTime(counter, MAX_VCF_NODES)) {
    return { found: false, moves: [], depth: 0 };
  }

   if (depth <= 0) {
     return { found: false, moves: [], depth: 0 };
   }

  if (isAttackerTurn) {
    // ── 进攻方回合（OR 节点）──
    const candidates = getCandidatePoints(board);

    // 1. 先检查直接成五的点
    for (const point of candidates) {
      board[point.row][point.col] = attacker;
      const won = checkWin(board, point.row, point.col, attacker) !== null;
      board[point.row][point.col] = null;
      if (won) {
        return {
          found: true,
          moves: [{ row: point.row, col: point.col }],
          depth: 1,
        };
      }
    }

    // 2. 再检查冲四点
    const fourPoints = findFourPoints(board, attacker);

    for (const point of fourPoints) {
      board[point.row][point.col] = attacker;

      // 活四直接获胜（对方无法防守活四）
      if (point.type === 'open_four') {
        board[point.row][point.col] = null;
        return {
          found: true,
          moves: [{ row: point.row, col: point.col }],
          depth: 1,
        };
      }

      const result = vcfSearch(board, attacker, depth - 1, false, counter);
      board[point.row][point.col] = null;

      if (result.found) {
        return {
          found: true,
          moves: [{ row: point.row, col: point.col }, ...result.moves],
          depth: result.depth + 1,
        };
      }
    }

    return { found: false, moves: [], depth: 0 };
  } else {
    // ── 防守方回合（AND 节点）──
    // 找进攻方所有四级别威胁点（即防守方需要堵的点）
    const defPoints = findDefensePoints(board, attacker)
      .filter((p: DefensePoint) => p.threatLevel >= SCORE.CLOSED_FOUR);

    if (defPoints.length === 0) {
      // 没有需要防守的，进攻失败
      return { found: false, moves: [], depth: 0 };
    }

    let maxDepth = 0;

    for (const defPoint of defPoints) {
      const defender = getOpponent(attacker);
      board[defPoint.row][defPoint.col] = defender;

      const result = vcfSearch(board, attacker, depth, true, counter);
      board[defPoint.row][defPoint.col] = null;

      if (!result.found) {
        // 只要有一个防守点能防住，VCF 就不成立
        return { found: false, moves: [], depth: 0 };
      }

      if (result.depth > maxDepth) {
        maxDepth = result.depth;
      }
    }

    // 所有防守点都防不住，VCF 成立
    return { found: true, moves: [], depth: maxDepth };
  }
}

/**
 * 求解 VCF（连续冲四获胜）。
 * @param board 棋盘
 * @param attacker 进攻方
 * @param maxDepth 最大进攻步数（默认 20）
 */
export function solveVCF(
   board: (string | null)[][],
   attacker: PlayerColor,
   maxDepth: number = 10,
 ): VCFResult {
   const counter = createThreatCounter();
   const boardCopy = cloneBoard(board);
   return vcfSearch(boardCopy, attacker, maxDepth, true, counter);
 }

// ============================================================
// 4. VCT 求解器（Victory by Continuous Threats）
// ============================================================

export interface VCTResult {
  found: boolean;
  moves: Move[];
  depth: number;
}

/**
 * VCT 核心搜索。
 * 与 VCF 类似，但威胁范围扩大到活三（冲四 + 活三）。
 * 进攻方每步先检查 VCF，如果已经能 VCF 就直接走 VCF。
 *
 * @param board 当前棋盘（就地修改）
 * @param attacker 进攻方
 * @param depth 剩余深度（只计进攻方步数）
 * @param isAttackerTurn 当前是否进攻方回合
 */
function vctSearch(
   board: (string | null)[][],
   attacker: PlayerColor,
   depth: number,
   isAttackerTurn: boolean,
   counter: ThreatCounter,
 ): VCTResult {
  counter.count += 1;
  if (checkThreatTime(counter, MAX_VCT_NODES)) {
    return { found: false, moves: [], depth: 0 };
  }

   if (depth <= 0) {
     return { found: false, moves: [], depth: 0 };
   }

   if (isAttackerTurn) {
     // 先检查 VCF（深度6，快速判断是否已有必胜）
     const vcfResult = vcfSearch(board, attacker, 6, true, counter);
     if (vcfResult.found) {
      return {
        found: true,
        moves: vcfResult.moves,
        depth: vcfResult.depth,
      };
    }

    // 威胁点 = 四点 + 活三点（按威胁从高到低排序）
    const fourPoints = findFourPoints(board, attacker);
    const threePoints = findThreePoints(board, attacker)
      .filter((p: ThreePoint) => p.type === 'open_three');

    // 先冲四，再活三
    const threatPoints: Array<{ row: number; col: number; isFour: boolean }> = [
      ...fourPoints.map((p: FourPoint) => ({ row: p.row, col: p.col, isFour: true })),
      ...threePoints.map((p: ThreePoint) => ({ row: p.row, col: p.col, isFour: false })),
    ];

    for (const point of threatPoints) {
      board[point.row][point.col] = attacker;

      // 检查是否直接成五
      if (checkWin(board, point.row, point.col, attacker) !== null) {
        board[point.row][point.col] = null;
        return {
          found: true,
          moves: [{ row: point.row, col: point.col }],
          depth: 1,
        };
      }

      // 活四直接获胜
      if (point.isFour) {
        // 需要确认是不是活四
        const pattern = getStrongestPatternAt(board, point.row, point.col, attacker);
        if (pattern === 'OPEN_FOUR') {
          board[point.row][point.col] = null;
          return {
            found: true,
            moves: [{ row: point.row, col: point.col }],
            depth: 1,
          };
        }
      }

      const result = vctSearch(board, attacker, depth - 1, false, counter);
      board[point.row][point.col] = null;

      if (result.found) {
        return {
          found: true,
          moves: [{ row: point.row, col: point.col }, ...result.moves],
          depth: result.depth + 1,
        };
      }
    }

    return { found: false, moves: [], depth: 0 };
  } else {
    // ── 防守方回合（AND 节点）──
    // 防守点：对方所有四和活三的威胁点
    const defPoints = findDefensePoints(board, attacker)
      .filter((p: DefensePoint) => p.threatLevel >= SCORE.OPEN_THREE);

    if (defPoints.length === 0) {
      return { found: false, moves: [], depth: 0 };
    }

    let maxDepth = 0;

    for (const defPoint of defPoints) {
      const defender = getOpponent(attacker);
      board[defPoint.row][defPoint.col] = defender;

      const result = vctSearch(board, attacker, depth, true, counter);
      board[defPoint.row][defPoint.col] = null;

      if (!result.found) {
        // 只要有一个防守点能防住，VCT 就不成立
        return { found: false, moves: [], depth: 0 };
      }

      if (result.depth > maxDepth) {
        maxDepth = result.depth;
      }
    }

    // 所有防守点都防不住，VCT 成立
    return { found: true, moves: [], depth: maxDepth };
  }
}

/**
 * 在已落子的位置，返回最强棋型类型（不落子，直接分析）。
 * 与 getStrongestPattern 不同：此函数假设 (row,col) 已经是 player 的棋子。
 */
function getStrongestPatternAt(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
): PatternType {
  let best: PatternType = 'NONE';
  const priority: PatternType[] = [
    'FIVE',
    'OPEN_FOUR',
    'CLOSED_FOUR',
    'OPEN_THREE',
    'CLOSED_THREE',
    'OPEN_TWO',
    'CLOSED_TWO',
    'OPEN_ONE',
    'NONE',
  ];

  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, player);
    if (priority.indexOf(analysis.type) < priority.indexOf(best)) {
      best = analysis.type;
    }
  }

  return best;
}

/**
 * 求解 VCT（连续威胁获胜：活三 + 冲四）。
 * @param board 棋盘
 * @param attacker 进攻方
 * @param maxDepth 最大进攻步数（默认 15）
 */
export function solveVCT(
   board: (string | null)[][],
   attacker: PlayerColor,
   maxDepth: number = 8,
 ): VCTResult {
   const counter = createThreatCounter();
   const boardCopy = cloneBoard(board);
   return vctSearch(boardCopy, attacker, maxDepth, true, counter);
 }

// ============================================================
// 5. 便捷函数
// ============================================================

/**
 * 检查玩家是否有 VCF 必胜，如果有返回第一步。
 */
export function findVCFMove(
  board: (string | null)[][],
  player: PlayerColor,
  maxDepth?: number,
): Move | null {
  const result = solveVCF(board, player, maxDepth);
  if (result.found && result.moves.length > 0) {
    return result.moves[0];
  }
  return null;
}

/**
 * 检查玩家是否有 VCT 必胜，如果有返回第一步。
 */
export function findVCTMove(
  board: (string | null)[][],
  player: PlayerColor,
  maxDepth?: number,
): Move | null {
  const result = solveVCT(board, player, maxDepth);
  if (result.found && result.moves.length > 0) {
    return result.moves[0];
  }
  return null;
}

/**
 * 检查对方的 VCF 威胁，返回必须防守的点（最紧急的一个）。
 * 即：如果对手有 VCF 必胜，返回对手 VCF 的第一步（也就是我方应该堵的点）。
 * 如果对手没有 VCF 必胜，返回 null。
 */
export function findVCFDefense(
  board: (string | null)[][],
  defender: PlayerColor,
  maxDepth?: number,
): Move | null {
  const opponent = getOpponent(defender);
  const result = solveVCF(board, opponent, maxDepth);
  if (result.found && result.moves.length > 0) {
    return result.moves[0];
  }
  return null;
}
