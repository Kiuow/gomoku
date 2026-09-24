import type { PlayerColor, Move } from '@shared/api.interface';

// ============================================================
// 常量与类型定义
// ============================================================

export const BOARD_SIZE = 15;

// 棋型分数（攻击方向，数值越大越危险）
export const SCORE = {
  FIVE: 10000000,        // 成五
  OPEN_FOUR: 1000000,    // 活四
  DOUBLE_FOUR: 9000000,  // 双四（组合）
  FOUR_THREE: 8000000,   // 四三（组合）
  CLOSED_FOUR: 100000,   // 冲四
  DOUBLE_THREE: 800000,  // 双活三（组合）
  OPEN_THREE: 50000,     // 活三
  CLOSED_THREE: 5000,    // 眠三
  OPEN_TWO: 2000,        // 活二
  CLOSED_TWO: 200,       // 眠二
  OPEN_ONE: 50,          // 活一
} as const;

// 棋型类型枚举
export type PatternType =
  | 'FIVE'
  | 'OPEN_FOUR'
  | 'CLOSED_FOUR'
  | 'OPEN_THREE'
  | 'CLOSED_THREE'
  | 'OPEN_TWO'
  | 'CLOSED_TWO'
  | 'OPEN_ONE'
  | 'NONE';

// 方向：水平、垂直、主对角线、副对角线
const DIRS: Array<[number, number]> = [
  [0, 1],   // 水平
  [1, 0],   // 垂直
  [1, 1],   // 主对角
  [1, -1],  // 副对角
];

// ============================================================
// 1. 位置权重表
// ============================================================

/**
 * 15x15 位置权重表（精细版）。
 * 中心(天元)最高 120，内圈、中圈、外圈逐次递减。
 * 星位(3,3)等位置有额外战略加成。
 * 边角约 3-5。
 */
function buildPositionWeights(): number[][] {
  const center = (BOARD_SIZE - 1) / 2;
  const weights: number[][] = [];
  const starPositions = new Set(['3,3', '3,11', '11,3', '11,11']);
  const outerStarPositions = new Set(['5,5', '5,9', '9,5', '9,9']);

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const distCenter = Math.sqrt(
        (r - center) * (r - center) + (c - center) * (c - center),
      );
      // 高斯型衰减，中心最高，远离中心快速下降
      const base = Math.round(120 * Math.exp(-(distCenter * distCenter) / 32));
      // 星位加成
      let bonus = 0;
      if (starPositions.has(`${r},${c}`)) bonus = 12;
      else if (outerStarPositions.has(`${r},${c}`)) bonus = 6;
      // 离边缘 1 格以内略减分（太靠边发展潜力差）
      const edgeDist = Math.min(r, c, BOARD_SIZE - 1 - r, BOARD_SIZE - 1 - c);
      const edgePenalty = edgeDist === 0 ? -8 : edgeDist === 1 ? -3 : 0;
      row.push(Math.max(2, base + bonus + edgePenalty));
    }
    weights.push(row);
  }
  return weights;
}

export const POSITION_WEIGHTS: number[][] = buildPositionWeights();

/**
 * 精细版位置权重表（用于 evaluateBoardFine）。
 * 中心(天元)最高 150，内圈、中圈、外圈阶梯化递减。
 * 星位(3,3)(3,11)(11,3)(11,11) 有额外战略加成。
 * 边角约 5-10。
 */
function buildPositionWeightsFine(): number[][] {
  const center = (BOARD_SIZE - 1) / 2;
  const weights: number[][] = [];
  const starPositions = new Set(['3,3', '3,11', '11,3', '11,11']);
  const outerStarPositions = new Set(['5,5', '5,9', '9,5', '9,9']);
  const innerRingPositions = new Set(['7,5', '7,9', '5,7', '9,7']);

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const distCenter = Math.sqrt(
        (r - center) * (r - center) + (c - center) * (c - center),
      );
      // 更高中心值 + 更平缓衰减，拉开中央与边缘的差距
      const base = Math.round(150 * Math.exp(-(distCenter * distCenter) / 28));
      // 星位加成（更显著）
      let bonus = 0;
      if (r === 7 && c === 7) bonus = 20; // 天元额外加成
      else if (starPositions.has(`${r},${c}`)) bonus = 18;
      else if (outerStarPositions.has(`${r},${c}`)) bonus = 10;
      else if (innerRingPositions.has(`${r},${c}`)) bonus = 6;
      // 离边缘 1 格以内略减分
      const edgeDist = Math.min(r, c, BOARD_SIZE - 1 - r, BOARD_SIZE - 1 - c);
      const edgePenalty = edgeDist === 0 ? -10 : edgeDist === 1 ? -4 : 0;
      row.push(Math.max(5, base + bonus + edgePenalty));
    }
    weights.push(row);
  }
  return weights;
}

export const POSITION_WEIGHTS_FINE: number[][] = buildPositionWeightsFine();

// ============================================================
// 2. Zobrist 哈希
// ============================================================

function generateRandomBigInt(): bigint {
  // 优先使用 crypto.randomBigInt（如可用），否则降级到 Math.random 拼接
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new BigUint64Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  // 降级方案：用两个 32 位随机数拼成 64 位
  const high = BigInt(Math.floor(Math.random() * 0x100000000));
  const low = BigInt(Math.floor(Math.random() * 0x100000000));
  return (high << 32n) | low;
}

function buildZobristTable(): bigint[][] {
  const table: bigint[][] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    const row: bigint[] = [];
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      row.push(generateRandomBigInt());
    }
    table.push(row);
  }
  return table;
}

// Workers 不允许模块加载阶段生成随机数；首次搜索时再初始化。
export let ZOBRIST_BLACK: bigint[][] = [];
export let ZOBRIST_WHITE: bigint[][] = [];

/**
 * 计算棋盘的 Zobrist 哈希值。
 */
export function computeZobristHash(board: (string | null)[][]): bigint {
  if (!ZOBRIST_BLACK.length) {
    ZOBRIST_BLACK = buildZobristTable();
    ZOBRIST_WHITE = buildZobristTable();
  }
  let hash = 0n;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const cell = board[r][c];
      if (cell === 'black') {
        hash ^= ZOBRIST_BLACK[r][c];
      } else if (cell === 'white') {
        hash ^= ZOBRIST_WHITE[r][c];
      }
    }
  }
  return hash;
}

// ============================================================
// 3. 置换表（Transposition Table）
// ============================================================

export type TTFlag = 'exact' | 'lower' | 'upper';

export interface TTEntry {
  hash: bigint;
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove?: Move;
}

export class TranspositionTable {
  private table: Map<bigint, TTEntry>;
  private maxSize: number;

  constructor(maxSize = 200000) {
    this.table = new Map();
    this.maxSize = maxSize;
  }

  put(hash: bigint, entry: Omit<TTEntry, 'hash'>): void {
    // 超过上限时清理一半旧条目（按插入顺序，Map 保留插入顺序）
    if (this.table.size >= this.maxSize) {
      const half = Math.floor(this.maxSize / 2);
      let count = 0;
      for (const key of this.table.keys()) {
        if (count >= half) break;
        this.table.delete(key);
        count += 1;
      }
    }
    // 总是用新的替换旧的（深度优先简单起见直接覆盖）
    this.table.set(hash, { ...entry, hash });
  }

  get(hash: bigint): TTEntry | undefined {
    return this.table.get(hash);
  }

  clear(): void {
    this.table.clear();
  }

  size(): number {
    return this.table.size;
  }
}

// ============================================================
// 4. 棋型识别
// ============================================================

export interface LineAnalysis {
  type: PatternType;
  count: number;       // 连续同色子数量（不含跳位）
  openEnds: number;    // 开放端数量 0/1/2
  hasGap: boolean;     // 是否为跳型
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * 根据连续子数、开放端数、是否跳型，返回棋型类型。
 */
export function getPatternType(
   count: number,
   openEnds: number,
   hasGap: boolean,
 ): PatternType {
   // 跳型：中间有空位，但整体威胁更高。
   // 五子棋中，跳三/跳二比普通连子更危险（填补空位后直接升级一级棋型）。
   // 因此跳型按 "总子数" 定级，而不是 effective = count - 1。
   // 跳型比同级连续型略弱（扣半级），但远高于低一级的连续型。
   // 为简化处理：跳型 n 子 ≈ 连续型 n-1 子的价值，但保持类型名称一致。
   // 实际效果：跳活三（总4子两端空）= 活三级别（比连续活三略弱但远高于眠三）
   //            跳活二（总3子两端空）= 活二级别
   //            跳眠三（总4子一端堵）= 眠三级别
   //            跳眠二（总3子一端堵）= 眠二级别
   const effective = hasGap ? count : count;

   if (effective >= 5) return 'FIVE';
   if (effective === 4) {
     if (openEnds === 2) return 'OPEN_FOUR';
     if (openEnds === 1) return 'CLOSED_FOUR';
     return 'NONE';
   }
   if (effective === 3) {
     if (hasGap) {
       // 跳三：总3子中间空。两端开放=跳活二级别=OPEN_TWO；一端开放=跳眠二=CLOSED_TWO
       if (openEnds === 2) return 'OPEN_TWO';
       if (openEnds === 1) return 'CLOSED_TWO';
       return 'NONE';
     }
     if (openEnds === 2) return 'OPEN_THREE';
     if (openEnds === 1) return 'CLOSED_THREE';
     return 'NONE';
   }
   if (effective === 2) {
     if (hasGap) {
       // 跳二：总2子中间空1。威胁=普通连二（一步成眠三）。
       // 两端开放 → OPEN_TWO；一端开放 → CLOSED_TWO
       if (openEnds === 2) return 'OPEN_TWO';
       if (openEnds === 1) return 'CLOSED_TWO';
       return 'NONE';
     }
     if (openEnds === 2) return 'OPEN_TWO';
     if (openEnds === 1) return 'CLOSED_TWO';
     return 'NONE';
   }
   if (effective === 1 && openEnds === 2 && !hasGap) return 'OPEN_ONE';
   return 'NONE';
 }

/**
 * 获取棋型对应的分数。
 */
export function getPatternScore(type: PatternType): number {
   switch (type) {
     case 'FIVE': return SCORE.FIVE;
     case 'OPEN_FOUR': return SCORE.OPEN_FOUR;
     case 'CLOSED_FOUR': return SCORE.CLOSED_FOUR;
     case 'OPEN_THREE': return SCORE.OPEN_THREE;
     case 'CLOSED_THREE': return SCORE.CLOSED_THREE;
     case 'OPEN_TWO': return SCORE.OPEN_TWO;
     case 'CLOSED_TWO': return SCORE.CLOSED_TWO;
     case 'OPEN_ONE': return SCORE.OPEN_ONE;
     default: return 0;
   }
 }

/**
  * 跳型棋型判定。
  * 跳型：两段同色子中间隔 1 个空位。
  * gapTotal = 两段总子数（不含中间空位）。
  * 补中间空位后，连续子数 = gapTotal + 1。
  *
  * 跳四（gapTotal=4，补位成五）：对方只需堵 1 个点 = 冲四级别
  * 跳三（gapTotal=3，补位成四）：两端开放 → 活三；一端堵 → 眠三
  * 跳二（gapTotal=2，补位成三）：两端开放 → 活二；一端堵 → 眠二
  * 跳一（gapTotal=1，补位成二）：两端开放 → 活一
  */
export function getGapPatternType(
  gapTotal: number,
  openEnds: number,
): PatternType {
  const level = gapTotal + 1; // 补位后达到的连续子数
  if (level >= 5) return 'CLOSED_FOUR'; // 跳四 = 冲四（只有一个点要堵）
  if (level === 4) {
    if (openEnds === 2) return 'OPEN_THREE'; // 跳活三
    if (openEnds === 1) return 'CLOSED_THREE'; // 跳眠三
    return 'NONE';
  }
  if (level === 3) {
    if (openEnds === 2) return 'OPEN_TWO'; // 跳活二
    if (openEnds === 1) return 'CLOSED_TWO'; // 跳眠二
    return 'NONE';
  }
  if (level === 2 && openEnds === 2) return 'OPEN_ONE';
  return 'NONE';
}

/**
 * 沿某一方向数连续同色子，以及末端是否开放。
 * 返回: { count, open, endR, endC } — endR/endC 是连续子之后的第一个非己方位置
 */
function countAlong(
  board: (string | null)[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  player: PlayerColor,
): { count: number; open: boolean; endR: number; endC: number } {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (
    r >= 0 && r < BOARD_SIZE &&
    c >= 0 && c < BOARD_SIZE &&
    board[r][c] === player
  ) {
    count += 1;
    r += dr;
    c += dc;
  }
  const open =
    r >= 0 && r < BOARD_SIZE &&
    c >= 0 && c < BOARD_SIZE &&
    board[r][c] === null;
  return { count, open, endR: r, endC: c };
}

/**
 * 分析 (row,col) 落 player 子后，在 (dr,dc) 方向上形成的棋型。
 * 支持识别连续型和简单跳型（如 XX_X 也是冲四，X_XX 是跳活三）。
 */
export function analyzeLine(
  board: (string | null)[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  player: PlayerColor,
): LineAnalysis {
  // 正方向统计
  const pos = countAlong(board, row, col, dr, dc, player);
  // 反方向统计
  const neg = countAlong(board, row, col, -dr, -dc, player);

  const totalCount = pos.count + neg.count + 1; // +1 是落子本身
  let openEnds = (pos.open ? 1 : 0) + (neg.open ? 1 : 0);
  let hasGap = false;

  // 起始/结束位置（沿正方向的端点）
  let startRow = row - dr * neg.count;
  let startCol = col - dc * neg.count;
  let endRow = row + dr * pos.count;
  let endCol = col + dc * pos.count;

  // 如果连续数 < 5，检查跳型：两端第一个空位外侧是否还有同色子
   if (totalCount < 5) {
     // 检查正方向跳位
     if (pos.open) {
       const gapR = pos.endR;
       const gapC = pos.endC;
       const afterR = gapR + dr;
       const afterC = gapC + dc;
       if (
         isInside(afterR, afterC) &&
         board[afterR][afterC] === player
       ) {
         const after = countAlong(board, gapR, gapC, dr, dc, player);
         const gapTotal = totalCount + after.count;
         if (gapTotal <= 5) {
           // 跳型：两段子中间隔1个空位
           // 总子数 = gapTotal，补空位后连续子数 = gapTotal + 1
           // 开放端 = 反方向是否开放 + 跳位后正方向是否开放
           const gapOpenEnds = (neg.open ? 1 : 0) + (after.open ? 1 : 0);
           const endR = afterR + dr * (after.count - 1);
           const endC = afterC + dc * (after.count - 1);
           const type = getGapPatternType(gapTotal, gapOpenEnds);
           return {
             type,
             count: gapTotal,
             openEnds: gapOpenEnds,
             hasGap: true,
             startRow,
             startCol,
             endRow: endR,
             endCol: endC,
           };
         }
       }
     }

     // 检查反方向跳位（仅当正方向没有跳型时）
     if (neg.open && !hasGap) {
       const gapR = neg.endR;
       const gapC = neg.endC;
       const afterR = gapR - dr;
       const afterC = gapC - dc;
       if (
         isInside(afterR, afterC) &&
         board[afterR][afterC] === player
       ) {
         const after = countAlong(board, gapR, gapC, -dr, -dc, player);
         const gapTotal = totalCount + after.count;
         if (gapTotal <= 5) {
           const gapOpenEnds = (pos.open ? 1 : 0) + (after.open ? 1 : 0);
           const startR = afterR - dr * (after.count - 1);
           const startC = afterC - dc * (after.count - 1);
           const type = getGapPatternType(gapTotal, gapOpenEnds);
           return {
             type,
             count: gapTotal,
             openEnds: gapOpenEnds,
             hasGap: true,
             startRow: startR,
             startCol: startC,
             endRow,
             endCol,
           };
         }
       }
     }
   }

  const type = getPatternType(totalCount, openEnds, hasGap);
  return {
    type,
    count: totalCount,
    openEnds,
    hasGap,
    startRow,
    startCol,
    endRow,
    endCol,
  };
}

// ============================================================
// 5. 位置评分函数
// ============================================================

/**
 * 在 (row,col) 落子后，对 player 方在 4 个方向的棋型评分之和。
 * 用于候选点排序（仅评估己方攻击分）。
 */
export function evaluatePosition(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
): number {
  if (board[row][col] !== null) return 0;

  // 模拟落子
  board[row][col] = player;

  let score = 0;
  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, player);
    score += getPatternScore(analysis.type);
  }

  // 撤销落子
  board[row][col] = null;

  // 加上位置权重加成
  score += POSITION_WEIGHTS[row][col];

  return score;
}

/**
 * 同时评估进攻和防守分数（落己方子的进攻分 + 落对方子的防守分 × 防守系数）。
 * 白棋模式下进攻权重提升、纯防守点优先级降低。
 */
export function evaluatePositionBoth(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
  isWhiteMode: boolean = false,
): { attackScore: number; defenseScore: number; totalScore: number } {
  const opponent = getOpponent(player);
  if (board[row][col] !== null) {
    return { attackScore: 0, defenseScore: 0, totalScore: 0 };
  }

  // 进攻分
  board[row][col] = player;
  let attackScore = 0;
  let openTwoDirs = 0;
  let openThreeDirsAttack = 0;
  let closedFourDirsAttack = 0;
  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, player);
    const base = getPatternScore(analysis.type);
    let weighted = base;
    // 白棋进攻加成：在候选点评分阶段对白棋进攻棋型额外加权
    if (isWhiteMode) {
      if (analysis.type === 'OPEN_TWO') weighted = base * 1.3;
      else if (analysis.type === 'OPEN_THREE') weighted = base * 1.4;
      else if (analysis.type === 'CLOSED_FOUR') weighted = base * 1.3;
    }
    attackScore += weighted;
    if (analysis.type === 'OPEN_TWO') openTwoDirs += 1;
    if (analysis.type === 'OPEN_THREE') openThreeDirsAttack += 1;
    if (analysis.type === 'CLOSED_FOUR') closedFourDirsAttack += 1;
  }
  board[row][col] = null;

  // 防守分
  board[row][col] = opponent;
  let defenseScore = 0;
  let openThreeDirs = 0;
  let closedThreeDirs = 0;
  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, opponent);
    defenseScore += getPatternScore(analysis.type);
    if (analysis.type === 'OPEN_THREE') openThreeDirs += 1;
    else if (analysis.type === 'CLOSED_THREE') closedThreeDirs += 1;
  }
  board[row][col] = null;

  // 双活三 或 活三+眠三：防守分 ×1.5
  const doubleThree = openThreeDirs >= 2 || (openThreeDirs >= 1 && closedThreeDirs >= 2);
  let defenseWeight = doubleThree ? 1.5 : 1.0;

  // 白棋模式：进攻权重 ×1.1，防守权重 ×1.3（重视防守）
  let attackWeight = 1.0;
  if (isWhiteMode) {
    attackWeight = 1.1;
    defenseWeight *= 1.3;
  }

  const totalScore =
    attackScore * attackWeight +
    defenseScore * defenseWeight +
    POSITION_WEIGHTS[row][col];
  return { attackScore, defenseScore, totalScore };
}

/**
 * 白棋专用单步评估：在 evaluatePosition 基础上对白棋进攻棋型加分。
 * 用于白棋候选点排序时优先选择有反击潜力的位置。
 */
export function evaluatePositionWhite(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
): number {
  if (board[row][col] !== null) return 0;
  if (player !== 'white') return evaluatePosition(board, row, col, player);

  // 模拟落子
  board[row][col] = 'white';

  let score = 0;
  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, 'white');
    const base = getPatternScore(analysis.type);
    // 白棋进攻加成
    let weighted = base;
    if (analysis.type === 'OPEN_TWO') weighted = base * 1.3;
    else if (analysis.type === 'OPEN_THREE') weighted = base * 1.4;
    else if (analysis.type === 'CLOSED_FOUR') weighted = base * 1.3;
    // OPEN_FOUR 不加（活四本身就是杀）
    score += weighted;
  }

  // 撤销落子
  board[row][col] = null;

  // 加上位置权重加成
  score += POSITION_WEIGHTS[row][col];

  return score;
}

// ============================================================
// 6. 候选点生成
// ============================================================

/**
 * 生成候选落子点，按评分排序。
 * @param board 棋盘
 * @param player 当前执子方
 * @param count 返回的候选点数量
 * @param expandThreats 是否在有威胁时扩大候选范围
 */
export function getCandidates(
  board: (string | null)[][],
  player: PlayerColor,
  count: number,
  expandThreats = false,
): Array<{ row: number; col: number; score: number }> {
  // 检查空棋盘
  let hasStone = false;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        hasStone = true;
        break;
      }
    }
    if (hasStone) break;
  }

  if (!hasStone) {
    return [{ row: 7, col: 7, score: POSITION_WEIGHTS[7][7] }];
  }

  // 收集已有棋子周围指定距离内的空位
  const searchRadius = expandThreats ? 2 : 2; // 基础范围都是 2
  const candidates = new Set<string>();

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        for (let dr = -searchRadius; dr <= searchRadius; dr += 1) {
          for (let dc = -searchRadius; dc <= searchRadius; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (
              nr >= 0 && nr < BOARD_SIZE &&
              nc >= 0 && nc < BOARD_SIZE &&
              board[nr][nc] === null
            ) {
              candidates.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
  }

  // expandThreats: 检测棋盘上是否有活三/冲四，有则扩大搜索半径到 3
  if (expandThreats) {
    let hasThreat = false;
    const opponent = getOpponent(player);
    for (let r = 0; r < BOARD_SIZE && !hasThreat; r += 1) {
      for (let c = 0; c < BOARD_SIZE && !hasThreat; c += 1) {
        if (board[r][c] === null) continue;
        const stoneColor = board[r][c] as PlayerColor;
        for (const [dr, dc] of DIRS) {
          const analysis = analyzeLine(board, r, c, dr, dc, stoneColor);
          if (
            analysis.type === 'OPEN_THREE' ||
            analysis.type === 'CLOSED_FOUR' ||
            analysis.type === 'OPEN_FOUR'
          ) {
            hasThreat = true;
            break;
          }
        }
      }
    }

    if (hasThreat) {
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        for (let c = 0; c < BOARD_SIZE; c += 1) {
          if (board[r][c] !== null) {
            for (let dr = -3; dr <= 3; dr += 1) {
              for (let dc = -3; dc <= 3; dc += 1) {
                if (Math.abs(dr) <= 2 && Math.abs(dc) <= 2) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (
                  nr >= 0 && nr < BOARD_SIZE &&
                  nc >= 0 && nc < BOARD_SIZE &&
                  board[nr][nc] === null
                ) {
                  candidates.add(`${nr},${nc}`);
                }
              }
            }
          }
        }
      }
    }
  }

  // 评分排序（白棋使用进攻加权的评分）
  const isWhite = player === 'white';
  const scored: Array<{ row: number; col: number; score: number }> = [];
  for (const key of candidates) {
    const [r, c] = key.split(',').map(Number);
    const { totalScore } = evaluatePositionBoth(board, r, c, player, isWhite);
    scored.push({ row: r, col: c, score: totalScore });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

/**
 * 智能候选点生成（神仙级用）。
 * 在基础候选点之上加入：
 * 1. 潜在威胁点：虽然周围没有紧邻棋子但战略价值高的位置
 *    （如双方棋子间隔2格的中间点，星位等战略要地）
 * 2. 发展潜力加权：优先选择能同时形成多方向发展的点
 * 3. 攻击/防守双向排序：不仅看己方攻击分，还考虑对手在该点的威胁
 */
export function getCandidatesSmart(
  board: (string | null)[][],
  player: PlayerColor,
  count: number,
): Array<{ row: number; col: number; score: number }> {
  const opponent = getOpponent(player);
  const candidates = new Set<string>();

  let hasStone = false;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        hasStone = true;
        break;
      }
    }
    if (hasStone) break;
  }

  if (!hasStone) {
    return [{ row: 7, col: 7, score: POSITION_WEIGHTS[7][7] }];
  }

  // 基础：已有棋子周围 2 格内的所有空位
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (
              nr >= 0 && nr < BOARD_SIZE &&
              nc >= 0 && nc < BOARD_SIZE &&
              board[nr][nc] === null
            ) {
              candidates.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
  }

  // 潜在威胁点：双方棋子间隔 3 格的战略要地（"远点"）
  // 这些点虽然不紧邻棋子，但可能是后续发展的关键位置
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        for (let dr = -3; dr <= 3; dr += 1) {
          for (let dc = -3; dc <= 3; dc += 1) {
            // 跳过 2 格以内（已在基础范围内）和同格
            if (Math.abs(dr) <= 2 && Math.abs(dc) <= 2) continue;
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (
              nr >= 0 && nr < BOARD_SIZE &&
              nc >= 0 && nc < BOARD_SIZE &&
              board[nr][nc] === null &&
              POSITION_WEIGHTS[nr][nc] >= 40
            ) {
              // 只加入位置权重较高的远点
              candidates.add(`${nr},${nc}`);
            }
          }
        }
      }
    }
  }

  // 评分：攻击分 + 防守分 × 防守权重 + 发展潜力分 + 位置权重
  // 白棋模式：进攻权重 ×1.25，防守权重 ×1.1，纯防守点降权
  const isWhite = player === 'white';
  const scored: Array<{ row: number; col: number; score: number }> = [];
  for (const key of candidates) {
    const [r, c] = key.split(',').map(Number);
    const { attackScore, defenseScore } = evaluatePositionBoth(board, r, c, player, false);
    const potential = evaluatePotential(board, r, c, player);
    const oppPotential = evaluatePotential(board, r, c, opponent);

    // 双三防守检测
    let openThreeDirs = 0;
    let closedThreeDirs = 0;
    board[r][c] = opponent;
    for (const [dr, dc] of DIRS) {
      const analysis = analyzeLine(board, r, c, dr, dc, opponent);
      if (analysis.type === 'OPEN_THREE') openThreeDirs += 1;
      else if (analysis.type === 'CLOSED_THREE') closedThreeDirs += 1;
    }
    board[r][c] = null;
    const doubleThree = openThreeDirs >= 2 || (openThreeDirs >= 1 && closedThreeDirs >= 2);
    let defenseWeight = doubleThree ? 1.5 : 1.05;

    // 白棋专属权重调整：重视防守
    let attackWeight = 1.0;
    if (isWhite) {
      attackWeight = 1.1;
      defenseWeight *= 1.4;
    }

    // 综合评分：进攻 + 防守 + 己方发展潜力 - 对方发展潜力(遏制) + 位置
    const totalScore =
      attackScore * attackWeight +
      defenseScore * defenseWeight +
      potential * 0.5 +
      oppPotential * 0.3 +
      POSITION_WEIGHTS[r][c];

    scored.push({ row: r, col: c, score: totalScore });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

// 棋型发展潜力加分（一个棋型能向多少个方向发展成更强棋型）
export const PATTERN_POTENTIAL: Record<string, number> = {
  OPEN_THREE: 8000,    // 活三 → 活四 潜力巨大
  CLOSED_THREE: 1500,  // 眠三 → 冲四
  OPEN_TWO: 600,       // 活二 → 活三
  CLOSED_TWO: 80,      // 眠二 → 眠三
  OPEN_ONE: 20,        // 活一 → 活二
};

/**
 * 评估棋型发展潜力：某个点落子后，能在几个方向上形成有发展潜力的棋型。
 * 用于精细评估，优先选择能同时在多个方向发展的点。
 */
export function evaluatePotential(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
): number {
  if (board[row][col] !== null) return 0;
  board[row][col] = player;
  let potential = 0;
  for (const [dr, dc] of DIRS) {
    const analysis = analyzeLine(board, row, col, dr, dc, player);
    switch (analysis.type) {
      case 'OPEN_THREE':
        potential += PATTERN_POTENTIAL.OPEN_THREE;
        break;
      case 'CLOSED_THREE':
        potential += PATTERN_POTENTIAL.CLOSED_THREE;
        break;
      case 'OPEN_TWO':
        potential += PATTERN_POTENTIAL.OPEN_TWO;
        break;
      case 'CLOSED_TWO':
        potential += PATTERN_POTENTIAL.CLOSED_TWO;
        break;
      case 'OPEN_ONE':
        potential += PATTERN_POTENTIAL.OPEN_ONE;
        break;
      default:
        break;
    }
  }
  board[row][col] = null;
  return potential;
}

/**
 * 对一条线上的所有棋型进行扫描，返回该 player 的总得分。
 * 扫描算法：逐格遍历，遇到 player 棋子累加计数，遇到空位或对手时结算。
 */
function scanLine(
  line: Array<string | null>,
  player: PlayerColor,
): number {
  let score = 0;
  let count = 0;       // 当前连续己方棋子数
  let leftOpen = false; // 左侧是否开放
  let i = 0;

  while (i < line.length) {
    const cell = line[i];

    if (cell === player) {
      count += 1;
      i += 1;
    } else if (cell === null) {
      if (count > 0) {
        // 结算一段棋型：右侧开放（当前是空位）
        // 检查右侧是否还有同色子（跳型）
        let j = i + 1;
        let jumpCount = 0;
        while (j < line.length && line[j] === player) {
          jumpCount += 1;
          j += 1;
        }
        const rightOpen = j < line.length && line[j] === null;

        if (jumpCount > 0) {
          // 跳型
          const total = count + jumpCount;
          const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
          const type = getPatternType(total, openEnds, true);
          score += getPatternScore(type);
          // 跳到跳型后面继续
          count = 0;
          leftOpen = rightOpen;
          i = j;
        } else {
          // 普通连续型，右侧开放
          const type = getPatternType(count, leftOpen ? 2 : 1, false);
          score += getPatternScore(type);
          count = 0;
          leftOpen = true; // 刚经过空位，下一段左侧开放
          i += 1;
        }
      } else {
        leftOpen = true;
        i += 1;
      }
    } else {
      // 遇到对手棋子
      if (count > 0) {
        // 结算：右侧封闭
        const type = getPatternType(count, leftOpen ? 1 : 0, false);
        score += getPatternScore(type);
        count = 0;
      }
      leftOpen = false;
      i += 1;
    }
  }

  // 行末结算
  if (count > 0) {
    const type = getPatternType(count, leftOpen ? 1 : 0, false);
    score += getPatternScore(type);
  }

  return score;
}

/**
 * 从棋盘提取指定方向的所有线。
 */
function extractLines(
  board: (string | null)[][],
  dr: number,
  dc: number,
): Array<Array<string | null>> {
  const lines: Array<Array<string | null>> = [];

  if (dr === 0 && dc === 1) {
    // 水平线：每行一条
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      const line: Array<string | null> = [];
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        line.push(board[r][c]);
      }
      lines.push(line);
    }
  } else if (dr === 1 && dc === 0) {
    // 垂直线：每列一条
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const line: Array<string | null> = [];
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        line.push(board[r][c]);
      }
      lines.push(line);
    }
  } else if (dr === 1 && dc === 1) {
    // 主对角线（左上→右下）：共 2*N-1 条
    for (let k = -(BOARD_SIZE - 1); k <= BOARD_SIZE - 1; k += 1) {
      const line: Array<string | null> = [];
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        const c = r - k;
        if (c >= 0 && c < BOARD_SIZE) {
          line.push(board[r][c]);
        }
      }
      if (line.length > 0) lines.push(line);
    }
  } else if (dr === 1 && dc === -1) {
    // 副对角线（右上→左下）：共 2*N-1 条
    for (let k = 0; k <= 2 * (BOARD_SIZE - 1); k += 1) {
      const line: Array<string | null> = [];
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        const c = k - r;
        if (c >= 0 && c < BOARD_SIZE) {
          line.push(board[r][c]);
        }
      }
      if (line.length > 0) lines.push(line);
    }
  }

  return lines;
}

/**
 * 计算一方玩家的全局总得分。
 * 沿 4 个方向逐线扫描，累加所有棋型分数。
 */
function evaluatePlayer(
  board: (string | null)[][],
  player: PlayerColor,
): number {
  let total = 0;
  for (const [dr, dc] of DIRS) {
    const lines = extractLines(board, dr, dc);
    for (const line of lines) {
      total += scanLine(line, player);
    }
  }
  return total;
}

/**
 * 带棋型计数的评估：返回总分和各级棋型出现的方向数。
 * 用于精细评估中计算多方向组合奖励（双三、四三、双四等）。
 */
interface PlayerEvalCounts {
  total: number;
  fiveCount: number;
  openFourCount: number;
  closedFourCount: number;
  openThreeCount: number;
  closedThreeCount: number;
  openTwoCount: number;
}

function evaluatePlayerWithCounts(
  board: (string | null)[][],
  player: PlayerColor,
): PlayerEvalCounts {
  let total = 0;
  let fiveCount = 0;
  let openFourCount = 0;
  let closedFourCount = 0;
  let openThreeCount = 0;
  let closedThreeCount = 0;
  let openTwoCount = 0;

  for (const [dr, dc] of DIRS) {
    const lines = extractLines(board, dr, dc);
    for (const line of lines) {
      const lineScore = scanLine(line, player);
      total += lineScore;
      // 基于分数量级粗略估计该方向棋型等级
      // 注意：一条线上可能有多个棋型，但方向级别的组合检测
      // 用 "该方向最高棋型级别" 近似已经足够
      if (lineScore >= SCORE.FIVE) {
        fiveCount += 1;
      } else if (lineScore >= SCORE.OPEN_FOUR) {
        openFourCount += 1;
      } else if (lineScore >= SCORE.CLOSED_FOUR) {
        closedFourCount += 1;
      } else if (lineScore >= SCORE.OPEN_THREE) {
        openThreeCount += 1;
      } else if (lineScore >= SCORE.CLOSED_THREE) {
        closedThreeCount += 1;
      } else if (lineScore >= SCORE.OPEN_TWO) {
        openTwoCount += 1;
      }
    }
  }

  return {
    total,
    fiveCount,
    openFourCount,
    closedFourCount,
    openThreeCount,
    closedThreeCount,
    openTwoCount,
  };
}

/**
 * 对整个棋盘评分。
 * 正值表示 aiPlayer 占优，负值表示对手占优。
 * 对称评估：aiPlayer 总分 - opponent 总分，无偏向防守方的系数。
 */
 const FIRST_MOVE_ADVANTAGE = 1.3;

export function evaluateBoard(
   board: (string | null)[][],
   aiPlayer: PlayerColor,
 ): number {
   const opponent = getOpponent(aiPlayer);
   let aiScore = evaluatePlayer(board, aiPlayer);
   let oppScore = evaluatePlayer(board, opponent);
   // 先手优势加权：黑棋（先手）的进攻棋型威胁更大，乘以系数
   // 这让白棋更重视防守黑棋的潜在威胁
   if (aiPlayer === 'black') {
     aiScore *= FIRST_MOVE_ADVANTAGE;
   } else if (opponent === 'black') {
     oppScore *= FIRST_MOVE_ADVANTAGE;
   }
   return aiScore - oppScore;
 }

/**
 * 精细版全局评估（神仙级AI用）。
 * 在基础评估之上加入：
 * 1. 细粒度位置权重修正（中心区域棋子价值更高）
 * 2. 棋型发展潜力评估
 * 3. 多方向棋型组合奖励（双三、四三、双四）
 * 4. 白棋进攻加成（抵消先手劣势）
 */
export function evaluateBoardFine(
  board: (string | null)[][],
  aiPlayer: PlayerColor,
): number {
  const opponent = getOpponent(aiPlayer);
  const aiCounts = evaluatePlayerWithCounts(board, aiPlayer);
  const oppCounts = evaluatePlayerWithCounts(board, opponent);

  // --- 多方向棋型组合奖励 ---
  // 双四、四三、双三等组合威胁远大于各方向分数之和
  let aiComboBonus = 0;
  let oppComboBonus = 0;

  if (aiCounts.openFourCount >= 2) {
    // 双活四：几乎必胜，追加组合奖励（扣除已累加的 2 个活四基础分）
    aiComboBonus += SCORE.DOUBLE_FOUR - 2 * SCORE.OPEN_FOUR;
  }
  if (aiCounts.openFourCount >= 1 && aiCounts.openThreeCount >= 1) {
    // 四三杀：一步必胜级别，追加组合奖励
    aiComboBonus += SCORE.FOUR_THREE - SCORE.OPEN_FOUR - SCORE.OPEN_THREE;
  }
  if (aiCounts.openThreeCount >= 2) {
    // 双活三：极大威胁，追加组合奖励（扣除已累加的 2 个活三基础分）
    aiComboBonus += SCORE.DOUBLE_THREE - 2 * SCORE.OPEN_THREE;
  }

  if (oppCounts.openFourCount >= 2) {
    oppComboBonus += SCORE.DOUBLE_FOUR - 2 * SCORE.OPEN_FOUR;
  }
  if (oppCounts.openFourCount >= 1 && oppCounts.openThreeCount >= 1) {
    oppComboBonus += SCORE.FOUR_THREE - SCORE.OPEN_FOUR - SCORE.OPEN_THREE;
  }
  if (oppCounts.openThreeCount >= 2) {
    oppComboBonus += SCORE.DOUBLE_THREE - 2 * SCORE.OPEN_THREE;
  }

  // 位置加权（使用更精细的权重表）：统计双方棋子的位置权重之和
  let posAi = 0;
  let posOpp = 0;
  let stoneCount = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      const cell = board[r][c];
      if (cell === aiPlayer) {
        posAi += POSITION_WEIGHTS_FINE[r][c];
        stoneCount += 1;
      } else if (cell === opponent) {
        posOpp += POSITION_WEIGHTS_FINE[r][c];
        stoneCount += 1;
      }
    }
  }

  // 发展潜力评估：遍历所有空位，计算双方在该点的发展潜力
  let potentialAi = 0;
  let potentialOpp = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) continue;
      let hasNeighbor = false;
      for (let dr = -2; dr <= 2 && !hasNeighbor; dr += 1) {
        for (let dc = -2; dc <= 2 && !hasNeighbor; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (isInside(nr, nc) && board[nr][nc] !== null) {
            hasNeighbor = true;
          }
        }
      }
      if (!hasNeighbor) continue;
      potentialAi += evaluatePotential(board, r, c, aiPlayer) * 0.1;
      potentialOpp += evaluatePotential(board, r, c, opponent) * 0.1;
    }
  }

  const baseDiff = (aiCounts.total + aiComboBonus) - (oppCounts.total + oppComboBonus);
  const posDiff = posAi - posOpp;
  const potDiff = potentialAi - potentialOpp;

  // 综合：基础得分 + 组合奖励 + 位置分 + 潜力分
  const earlyWeight = Math.max(0, 1 - stoneCount / 100);
  let total = baseDiff + posDiff * 0.5 * earlyWeight + potDiff * 0.3;

  // 白棋进攻加成：当 AI 执白时，对白方的进攻棋型额外加权
  // 鼓励积极反击，抵消黑棋先手优势
  // 注意：加成不宜过大，否则会高估进攻忽视防守
  if (aiPlayer === 'white') {
    const whiteAttackScore =
      aiCounts.openTwoCount * SCORE.OPEN_TWO * 0.1 +
      aiCounts.openThreeCount * SCORE.OPEN_THREE * 0.15 +
      aiCounts.closedFourCount * SCORE.CLOSED_FOUR * 0.1;
    total += whiteAttackScore;
  }

  return total;
}

// ============================================================
// 8. 工具函数
// ============================================================

/**
 * 创建空棋盘。
 */
export function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

/**
 * 深拷贝棋盘。
 */
export function cloneBoard(board: (string | null)[][]): (string | null)[][] {
  const newBoard: (string | null)[][] = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    newBoard.push(board[r].slice());
  }
  return newBoard;
}

/**
 * 判断坐标是否在棋盘内。
 */
export function isInside(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * 检查 (row,col) 落子后是否形成五连。
 * 返回获胜的 5 个棋子坐标数组，未获胜返回 null。
 */
export function checkWin(
  board: (string | null)[][],
  row: number,
  col: number,
  player: PlayerColor,
): Move[] | null {
  for (const [dr, dc] of DIRS) {
    const line: Move[] = [{ row, col }];

    // 正方向
    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 && r < BOARD_SIZE &&
      c >= 0 && c < BOARD_SIZE &&
      board[r][c] === player
    ) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }

    // 反方向
    r = row - dr;
    c = col - dc;
    while (
      r >= 0 && r < BOARD_SIZE &&
      c >= 0 && c < BOARD_SIZE &&
      board[r][c] === player
    ) {
      line.unshift({ row: r, col: c });
      r -= dr;
      c -= dc;
    }

    if (line.length >= 5) {
      return line.slice(0, 5);
    }
  }
  return null;
}

/**
 * 获取对手颜色。
 */
export function getOpponent(player: PlayerColor): PlayerColor {
  return player === 'black' ? 'white' : 'black';
}

// ============================================================
// 导出方向常量（供上层模块使用）
// ============================================================

export { DIRS };
