import type { PlayerColor, Move, MoveWithPlayer, AiDifficulty } from '@shared/api.interface';
import {
  BOARD_SIZE,
  SCORE,
  POSITION_WEIGHTS,
  TranspositionTable,
  computeZobristHash,
  getCandidates,
  getCandidatesSmart,
  evaluateBoard,
  evaluateBoardFine,
  evaluatePosition,
  evaluatePositionWhite,
  checkWin,
  getOpponent,
  isInside,
  cloneBoard,
  DIRS,
} from './gomoku-ai.engine';
import {
  findVCFMove,
  findVCTMove,
  findVCFDefense,
  findDefensePoints,
  findFourPoints,
} from './gomoku-ai.threats';
import { queryOpening, OPENING_MAX_MOVES } from './gomoku-ai.opening';

// ============================================================
// 1. 历史启发表（History Heuristic）
// ============================================================

/**
 * 历史启发：记录某个走法在历史搜索中引发剪枝的频率，
 * 深度平方加权，用于候选点排序。
 */
class HistoryHeuristic {
  private table: number[][];

  constructor() {
    this.table = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => 0),
    );
  }

  addScore(move: Move, depth: number): void {
    this.table[move.row][move.col] += depth * depth;
  }

  getScore(move: Move): number {
    return this.table[move.row][move.col];
  }

  clear(): void {
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        this.table[r][c] = 0;
      }
    }
  }
}

// ============================================================
// 2. 杀手启发（Killer Moves）
// ============================================================

/**
 * 杀手启发：每层保留 2 个引发剪枝的"杀手走法"，
 * 下一次搜索到相同深度时优先尝试这些走法。
 */
class KillerMoves {
  private killers: Array<[Move | null, Move | null]>;

  constructor(maxDepth: number) {
    this.killers = Array.from(
      { length: maxDepth + 2 },
      () => [null, null] as [Move | null, Move | null],
    );
  }

  addKiller(depth: number, move: Move): void {
    const k = this.killers[depth];
    if (k[0] && k[0].row === move.row && k[0].col === move.col) return;
    k[1] = k[0];
    k[0] = move;
  }

  isKiller(depth: number, move: Move): boolean {
    const k = this.killers[depth];
    return (
      (k[0] !== null && k[0].row === move.row && k[0].col === move.col) ||
      (k[1] !== null && k[1].row === move.row && k[1].col === move.col)
    );
  }

  getKillers(depth: number): Move[] {
    const k = this.killers[depth];
    const result: Move[] = [];
    if (k[0] !== null) result.push(k[0]);
    if (k[1] !== null) result.push(k[1]);
    return result;
  }
}

// ============================================================
// 3. 搜索配置与结果类型
// ============================================================

export interface SearchConfig {
  maxDepth: number;         // 最大搜索深度
  timeLimitMs: number;      // 时间限制（毫秒）
  candidateCount: number;   // 每层候选点数量
  useVCF: boolean;          // 是否启用 VCF
  vcfDepth: number;         // VCF 搜索深度
  useVCT: boolean;          // 是否启用 VCT
  vctDepth: number;         // VCT 搜索深度
  useOpeningBook: boolean;  // 是否使用开局库
  useNullMove: boolean;     // 是否使用空着裁剪
  randomJitter: number;     // 随机扰动（0=关闭）
  useFineEval: boolean;     // 是否使用精细评估
  useSmartCandidates: boolean; // 是否使用智能候选点
  useMCTS: boolean;         // 是否使用 MCTS 辅助
  mctsSimulations?: number; // 每个候选点 MCTS 模拟次数（默认 40）
  endgameThreshold: number; // 残局模式棋子数阈值
  endgameMaxDepth: number;  // 残局最大深度
  defenseDepthBonus: number; // 防守时额外深度
  whiteDepthBonus: number;  // 白棋额外深度补偿
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depthReached: number;
  nodes: number;
  timeMs: number;
  vcfFound: boolean;
  vctFound: boolean;
  openingBookMove: boolean;
}

// ============================================================
// 4. 搜索引擎主类
// ============================================================

/**
 * 五子棋 AI 搜索引擎。
 *
 * 核心技术：
 * - 迭代加深（Iterative Deepening）
 * - Alpha-Beta 剪枝
 * - 置换表（Transposition Table）
 * - 历史启发（History Heuristic）
 * - 杀手启发（Killer Moves）
 * - 空着裁剪（Null Move Pruning）
 * - VCF / VCT 优先
 * - 开局库
 */
export class GomokuAI {
  private tt: TranspositionTable;
  private history: HistoryHeuristic;
  private killers: KillerMoves;
  private startTime = 0;
  private timeLimitMs = 5000;
  private nodes = 0;
  private stopped = false;
  private readonly maxInternalDepth = 24;
  private useFineEval = false;
  private useSmartCandidates = false;
  private useMCTS = false;
  private mctsSimulations = 40;

  constructor(ttSize = 100000) {
    this.tt = new TranspositionTable(ttSize);
    this.history = new HistoryHeuristic();
    this.killers = new KillerMoves(this.maxInternalDepth);
  }

  /**
   * 主搜索入口。
   *
   * 搜索流程：
   * 1. 开局库查询（如启用且历史足够）
   * 2. 己方 VCF 检查（有必胜直接走）
   * 3. 对方 VCF 防守检查（对方必胜必须防守）
   * 4. 己方 VCT 检查（地狱模式启用）
   * 5. 迭代加深 + Alpha-Beta 搜索
   */
  search(
     board: (string | null)[][],
     playerColor: PlayerColor,
     config: SearchConfig,
     moveHistory: MoveWithPlayer[] = [],
   ): SearchResult {
      const effectiveConfig: SearchConfig = { ...config };
      if (playerColor === 'white') {
        effectiveConfig.maxDepth = config.maxDepth + (config.whiteDepthBonus || 1);
      }

      // 残局加深搜索层数，但仍遵守所选难度的时间预算。
      let stoneCount = 0;
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        for (let c = 0; c < BOARD_SIZE; c += 1) {
          if (board[r][c] !== null) stoneCount += 1;
        }
      }
      if (stoneCount >= (config.endgameThreshold || 45)) {
        effectiveConfig.maxDepth = Math.max(effectiveConfig.maxDepth, config.endgameMaxDepth || 20);
      }

      // 防守加成：检测对方是否有高级别威胁，有则搜索更深
      if (config.defenseDepthBonus && config.defenseDepthBonus > 0) {
        const opponent = getOpponent(playerColor);
        let maxOppThreat = 0;
        for (let r = 0; r < BOARD_SIZE && maxOppThreat < SCORE.OPEN_THREE; r += 1) {
          for (let c = 0; c < BOARD_SIZE && maxOppThreat < SCORE.OPEN_THREE; c += 1) {
            if (board[r][c] !== opponent) continue;
            for (const [dr, dc] of DIRS) {
              // 简化：通过 evaluatePosition 估算对方威胁
            }
          }
        }
        // 用 findDefensePoints 检测对方威胁等级
        const oppThreats = findDefensePoints(board, opponent);
        if (oppThreats.some((p) => p.threatLevel >= SCORE.OPEN_THREE)) {
          effectiveConfig.maxDepth += config.defenseDepthBonus;
        }
      }

      this.startTime = Date.now();
      this.timeLimitMs = effectiveConfig.timeLimitMs;
      this.nodes = 0;
      this.stopped = false;
      this.history.clear();
      this.useFineEval = !!effectiveConfig.useFineEval;
      this.useSmartCandidates = !!effectiveConfig.useSmartCandidates;
      this.useMCTS = !!effectiveConfig.useMCTS;
      this.mctsSimulations = effectiveConfig.mctsSimulations || 40;

      // 白棋 VCT 深度补偿 +1（白棋搜索更积极的 VCT 反击）
      if (playerColor === 'white') {
        effectiveConfig.vctDepth = (effectiveConfig.vctDepth || 6) + 1;
      }

    let vcfFound = false;
    let vctFound = false;
    let openingBookMove = false;

      // --- Step 0b: 白棋防守优先搜索 ---
      // 当对方有高等级威胁时，减少候选点换取搜索深度，确保防守正确。
      // 注意：VCF(成五威胁) 和 冲四 已经在后面的 Step 2/3 处理，
      // 这里处理活三和眠三堆积的情况，避免浅层搜索选错防守点。
      if (playerColor === 'white') {
        const opp = getOpponent(playerColor);
        const oppThreats = findDefensePoints(board, opp);
        const openThreeThreats = oppThreats.filter(p => p.threatLevel >= SCORE.OPEN_THREE).length;
        const closedThreeThreats = oppThreats.filter(p => p.threatLevel >= SCORE.CLOSED_THREE).length;

        if (openThreeThreats >= 1) {
          // 对方有活三 → 候选点收紧到 6 个，深度 +5
          effectiveConfig.candidateCount = Math.min(effectiveConfig.candidateCount, 6);
          effectiveConfig.maxDepth = (effectiveConfig.maxDepth || 10) + 5;
        } else if (closedThreeThreats >= 3) {
          // 对方有多个眠三（进攻态势明显）→ 候选点收紧到 8 个，深度 +3
          effectiveConfig.candidateCount = Math.min(effectiveConfig.candidateCount, 8);
          effectiveConfig.maxDepth = (effectiveConfig.maxDepth || 10) + 3;
        }
      }

      // --- Step 2: 己方 VCF ---
       if (effectiveConfig.useVCF) {
        const vcfMove = findVCFMove(board, playerColor, effectiveConfig.vcfDepth || 8);
        if (vcfMove !== null) {
        const elapsed = Date.now() - this.startTime;
        return {
          move: vcfMove,
          score: SCORE.FIVE,
          depthReached: 0,
          nodes: this.nodes,
          timeMs: elapsed,
          vcfFound: true,
          vctFound: false,
          openingBookMove: false,
        };
      }
    }

    // --- Step 2b: 对方冲四防守（单个冲四威胁，非VCF） ---
    // 如果对方有 CLOSED_FOUR 级别威胁但还没形成 VCF，也必须认真防守。
    // 白棋尤其需要：单个冲四 + 活三的组合可能很快形成VCF。
    if (playerColor === 'white') {
      const opp = getOpponent(playerColor);
      const closedFourThreats = findDefensePoints(board, opp)
        .filter(p => p.threatLevel >= SCORE.CLOSED_FOUR && p.threatLevel < SCORE.OPEN_FOUR);
      if (closedFourThreats.length >= 1) {
        // 对方有冲四威胁：在防守点 + 反击点中做深度搜索
        closedFourThreats.sort((a, b) => b.threatLevel - a.threatLevel);
        const defenseMove = { row: closedFourThreats[0].row, col: closedFourThreats[0].col };
        const { bestMove, bestScore, depthReached } = this.searchWithDefensePriority(
          board,
          playerColor,
          effectiveConfig,
          defenseMove,
        );
        const elapsed = Date.now() - this.startTime;
        return {
          move: bestMove,
          score: bestScore,
          depthReached,
          nodes: this.nodes,
          timeMs: elapsed,
          vcfFound: false,
          vctFound: false,
          openingBookMove,
        };
      }
    }

    // --- Step 3: 对方 VCF 防守 ---
     if (config.useVCF) {
       const defenseMove = findVCFDefense(board, playerColor, effectiveConfig.vcfDepth || 8);
       if (defenseMove !== null) {
         // 对方有 VCF 必胜，必须防守；用迭代加深在防守点中选最优
         const { bestMove, bestScore, depthReached } = this.searchWithDefensePriority(
           board,
           playerColor,
           effectiveConfig,
           defenseMove,
         );
        const elapsed = Date.now() - this.startTime;
        return {
          move: bestMove,
          score: bestScore,
          depthReached,
          nodes: this.nodes,
          timeMs: elapsed,
          vcfFound: false,
          vctFound: false,
          openingBookMove,
        };
      }
    }

     // --- Step 1b: 开局库（在VCF检查之后使用，避免开局库漏防） ---
     // 白棋特殊策略：
     // 1. 仅前4手（2回合）内使用开局库，之后交给搜索（开局库质量参差，避免中后期被坑）
     // 2. 走法需通过威胁校验：走了之后对方不能有活三，且眠三数量不增加
      if (effectiveConfig.useOpeningBook && moveHistory.length > 0) {
       const maxBookMoves = playerColor === 'white' ? 6 : OPENING_MAX_MOVES;
       if (moveHistory.length < maxBookMoves) {
         const bookMove = queryOpening(moveHistory);
         if (bookMove && isInside(bookMove.row, bookMove.col)
             && board[bookMove.row][bookMove.col] === null) {
           let useBook = true;
           if (playerColor === 'white') {
             const opponent = getOpponent(playerColor);
             // 检查走之前对方已有多少威胁点
             const oppThreatsBefore = findDefensePoints(board, opponent);
             const closedThreeBefore = oppThreatsBefore.filter(p => p.threatLevel >= SCORE.CLOSED_THREE).length;
             // 模拟走开局库这步
             board[bookMove.row][bookMove.col] = playerColor;
             const oppThreatsAfter = findDefensePoints(board, opponent);
             const openThreeAfter = oppThreatsAfter.filter(p => p.threatLevel >= SCORE.OPEN_THREE).length;
             const closedThreeAfter = oppThreatsAfter.filter(p => p.threatLevel >= SCORE.CLOSED_THREE).length;
             board[bookMove.row][bookMove.col] = null;
             // 漏防判定：走了之后对方有活三，或者有 2 个及以上眠三
             if (openThreeAfter > 0 || closedThreeAfter >= 2) {
               useBook = false;
             }
           }
           if (useBook) {
             const elapsed = Date.now() - this.startTime;
             return {
               move: bookMove,
               score: 0,
               depthReached: 0,
               nodes: 0,
               timeMs: elapsed,
               vcfFound: false,
               vctFound: false,
               openingBookMove: true,
             };
           }
         }
       }
     }

     // --- Step 4: 对方 VCT 威胁检测（白棋防守型局面优先检查） ---
      // 白棋在防守型局面下，优先检测对方的 VCT 威胁，再考虑己方进攻
      let oppVCTDefenseMove: Move | null = null;
      if (playerColor === 'white' && effectiveConfig.useVCT) {
        const currentEval = evaluateBoard(board, playerColor);
        const opponent = getOpponent(playerColor);
        // 防守型局面：对方分数明显高于己方
        if (currentEval < -SCORE.OPEN_THREE * 0.5) {
          // 先检查对方有没有 VCT 威胁
          oppVCTDefenseMove = findVCFDefense(
            board, playerColor, Math.floor((effectiveConfig.vctDepth || 6) / 2)
          );
        }
      }

     // --- Step 5: 己方 VCT（仅高难度） ---
       // 注意：仅在对方没有活三/冲四级别的反威胁时才走 VCT。
       // 如果对方已有威胁，盲目走己方 VCT 可能被对方反杀（VCT 假设对方必须防守，但对方有反威胁时不一定守）。
       // 例外：当己方分数落后较大（超过 OPEN_THREE 级别）时，主动尝试 VCT 寻找反击机会（劣势方搏杀策略）。
       // 白棋专属：即使对方有威胁，也会尝试 VCT 反击（白棋主动反击策略）
       if (effectiveConfig.useVCT) {
         const opponent = getOpponent(playerColor);
         const oppThreats = findDefensePoints(board, opponent)
           .filter((p) => p.threatLevel >= SCORE.OPEN_THREE);

         const currentEval = evaluateBoard(board, playerColor);
         const isLosingBadly = currentEval < -SCORE.OPEN_THREE;
         // 白棋总是更积极地尝试 VCT（即使对方有威胁，也找反击机会）
         const whiteAggressiveVCT = playerColor === 'white' && currentEval < 0;

         if (oppThreats.length === 0 || isLosingBadly || whiteAggressiveVCT) {
           // 对方无明显威胁，或己方大劣主动搏杀，或白棋积极反击
           const vctMove = findVCTMove(board, playerColor, effectiveConfig.vctDepth || 6);
           if (vctMove !== null) {
             vctFound = true;
             const elapsed = Date.now() - this.startTime;
             return {
               move: vctMove,
               score: SCORE.OPEN_FOUR,
               depthReached: 0,
               nodes: this.nodes,
               timeMs: elapsed,
               vcfFound: false,
               vctFound: true,
               openingBookMove: false,
             };
           }
         }
       }

     // --- Step 5b: 对方 VCT 防守（白棋防守型局面且无己方 VCT 时） ---
      if (oppVCTDefenseMove !== null && playerColor === 'white') {
        const elapsed = Date.now() - this.startTime;
        return {
          move: oppVCTDefenseMove,
          score: -SCORE.OPEN_THREE,
          depthReached: 0,
          nodes: this.nodes,
          timeMs: elapsed,
          vcfFound: false,
          vctFound: false,
          openingBookMove: false,
        };
      }

      // --- Step 5a: 白棋防守优先搜索（对方有多个眠三以上威胁时） ---
      // 白棋在对方进攻态势明显时，减少候选点数量以换取搜索深度，
      // 避免浅层搜索选错防守点（偏好进攻分高但防守弱的点）。
      if (playerColor === 'white') {
        const opponent = getOpponent(playerColor);
        const oppThreats = findDefensePoints(board, opponent);
        const closedThreePlus = oppThreats.filter(p => p.threatLevel >= SCORE.CLOSED_THREE);
        // 对方有 2 个及以上眠三威胁点 = 明显进攻态势 → 收紧候选点换深度
        if (closedThreePlus.length >= 2) {
          effectiveConfig.candidateCount = Math.min(
            effectiveConfig.candidateCount,
            6,
          );
          effectiveConfig.maxDepth = Math.max(
            effectiveConfig.maxDepth,
            (effectiveConfig.maxDepth || 10) + 2,
          );
        }
      }

      // --- Step 5: 迭代加深 + Alpha-Beta ---
     const { bestMove, bestScore, depthReached } = this.iterativeDeepening(
       board,
       playerColor,
       effectiveConfig,
     );

    // --- Step 6: MCTS 辅助（神仙级） ---
    let finalMove = bestMove;
    let finalScore = bestScore;

    if (this.useMCTS && bestMove !== null && !this.checkTime()) {
      const remainingTime = this.timeLimitMs - (Date.now() - this.startTime);
      if (remainingTime > 2000) {
        const topCandidates = this.orderMoves(
          board,
          playerColor,
          5,
          bestMove,
          0,
          this.useSmartCandidates,
        );
        const mctsResults = this.mctsEvaluateCandidates(
          board,
          playerColor,
          topCandidates,
          Math.min(remainingTime * 0.7, 5000),
        );

        // 综合评分：minimax 分数归一化 + MCTS 胜率加权
        let bestCombined = -Infinity;
        for (const m of topCandidates) {
          const key = `${m.row},${m.col}`;
          const winRate = mctsResults.get(key) ?? 0.5;
          // 快速评估该点的 minimax 分数近似
          const approxScore = this.quickEvalMove(board, m, playerColor);
          // 归一化：把分数映射到 0~1 区间，再与胜率加权
          const scoreNorm = Math.tanh(approxScore / 50000) * 0.5 + 0.5;
          const combined = scoreNorm * 0.6 + winRate * 0.4;
          if (combined > bestCombined) {
            bestCombined = combined;
            finalMove = m;
          }
        }
      }
    }

     const elapsed = Date.now() - this.startTime;

     // 随机扰动（低难度用，增加变化）
     if (config.randomJitter > 0 && finalMove !== null) {
       const jitter = (Math.random() - 0.5) * 2 * config.randomJitter;
       finalScore = bestScore + jitter;
     }

    return {
      move: finalMove,
      score: finalScore,
      depthReached,
      nodes: this.nodes,
      timeMs: elapsed,
      vcfFound,
      vctFound,
      openingBookMove,
    };
  }

  /**
   * 当对方有 VCF 时，优先搜索防守点。
   * 将必防点作为首选，但仍通过迭代加深确认最优防守。
   */
  private searchWithDefensePriority(
      board: (string | null)[][],
      playerColor: PlayerColor,
      config: SearchConfig,
      mustDefend: Move,
    ): { bestMove: Move | null; bestScore: number; depthReached: number } {
     // 先检查是否存在更高优先级的威胁（比如我方直接能成五）
     const myFours = findFourPoints(board, playerColor);
     if (myFours.length > 0 && myFours[0].type === 'open_four') {
       // 我方有活四，直接走活四更优
       return {
         bestMove: { row: myFours[0].row, col: myFours[0].col },
         bestScore: SCORE.OPEN_FOUR,
         depthReached: 1,
       };
     }

     // 查找所有高级别防守点（成五/活四/冲四级别）
     const opponent = getOpponent(playerColor);
     const defPoints = findDefensePoints(board, opponent)
       .filter((p) => p.threatLevel >= SCORE.CLOSED_FOUR);

     if (defPoints.length === 0) {
       // 没有明确防守点，正常搜索
       return this.iterativeDeepening(board, playerColor, config);
     }

     // 如果对方有直接成五威胁（FIVE级别），必须堵
     const fiveThreats = defPoints.filter((p) => p.threatLevel >= SCORE.FIVE);
     if (fiveThreats.length > 0) {
       // 堵最紧急的那个点（如果有多个成五威胁，选一个堵即可——能双五的话堵不住）
       return {
         bestMove: { row: fiveThreats[0].row, col: fiveThreats[0].col },
         bestScore: -SCORE.FIVE,
         depthReached: 1,
       };
     }

     // 如果对方有活四威胁，也必须堵
     const openFourThreats = defPoints.filter((p) => p.threatLevel >= SCORE.OPEN_FOUR);
     if (openFourThreats.length > 0) {
       return {
         bestMove: { row: openFourThreats[0].row, col: openFourThreats[0].col },
         bestScore: -SCORE.OPEN_FOUR,
         depthReached: 1,
       };
     }

      // 冲四级别的威胁：在防守点 + 我方反击点范围内做深度搜索
      // 收集所有防守点
      const defensePoints = defPoints.map(p => ({ row: p.row, col: p.col }));
      // 收集我方的反击（成五/活四/冲四）点
      const myAttackPoints = findDefensePoints(board, playerColor)
        .filter(p => p.threatLevel >= SCORE.CLOSED_FOUR)
        .map(p => ({ row: p.row, col: p.col }));

      // 合并去重
      const pointSet = new Map<string, { row: number; col: number }>();
      for (const dp of defensePoints) pointSet.set(`${dp.row},${dp.col}`, dp);
      for (const ap of myAttackPoints) pointSet.set(`${ap.row},${ap.col}`, ap);
      const candidateList = Array.from(pointSet.values());

      if (candidateList.length === 0) {
        return this.iterativeDeepening(board, playerColor, config);
      }

      // 用受限候选做搜索，减少分支提升深度
      const defenseConfig: SearchConfig = {
        ...config,
        candidateCount: candidateList.length,
        timeLimitMs: Math.min(config.timeLimitMs, 15000),
        maxDepth: (config.maxDepth || 10) + 4,
      };
      return this.iterativeDeepening(board, playerColor, defenseConfig);
   }

  /**
   * 快速评估一步走法的得分（浅搜索 + 静态评估）。
   * 用于 MCTS 综合评分时的快速估算。
   */
  private quickEvalMove(
    board: (string | null)[][],
    move: Move,
    playerColor: PlayerColor,
  ): number {
    board[move.row][move.col] = playerColor;
    const score = this.useFineEval
      ? evaluateBoardFine(board, playerColor)
      : evaluateBoard(board, playerColor);
    board[move.row][move.col] = null;
    return score;
  }

  /**
   * MCTS 辅助评估：对 top candidates 进行快速模拟对局，
   * 用胜率辅助排序，弥补 minimax 在深度不足时的盲区。
   * 返回每个候选点的胜率估计（0~1，1 = 必胜）。
   */
  private mctsEvaluateCandidates(
    board: (string | null)[][],
    playerColor: PlayerColor,
    candidates: Move[],
    timeLimitMs: number,
  ): Map<string, number> {
    const result = new Map<string, number>();
    const startTime = Date.now();
    const simulationsPerMove = this.mctsSimulations;

    for (const move of candidates) {
      if (Date.now() - startTime > timeLimitMs) break;
      const key = `${move.row},${move.col}`;
      let wins = 0;
      let total = 0;

      for (let i = 0; i < simulationsPerMove; i += 1) {
        if (Date.now() - startTime > timeLimitMs) break;
        const boardCopy = cloneBoard(board);
        boardCopy[move.row][move.col] = playerColor;
        const winner = this.quickPlayout(boardCopy, getOpponent(playerColor));
        total += 1;
        if (winner === playerColor) wins += 1;
        else if (winner === null) wins += 0.5; // 平局算一半
      }

      result.set(key, total > 0 ? wins / total : 0.5);
    }

    return result;
  }

  /**
   * 快速模拟对局：双方都走贪心启发式（一步评估最高的点），
   * 直到一方获胜或棋盘满。返回胜方颜色或 null(平局)。
   */
  private quickPlayout(
    board: (string | null)[][],
    startingPlayer: PlayerColor,
  ): PlayerColor | null {
    let current = startingPlayer;
    let lastMove: Move | null = null;

    for (let step = 0; step < 60; step += 1) {
      // 取 top-3 候选，随机选一个（增加多样性）
      const cands = getCandidates(board, current, 3);
      if (cands.length === 0) return null;

      const idx = Math.floor(Math.random() * Math.min(2, cands.length));
      const move = { row: cands[idx].row, col: cands[idx].col };
      board[move.row][move.col] = current;
      lastMove = move;

      // 检查获胜
      if (lastMove) {
        const win = checkWin(board, lastMove.row, lastMove.col, current);
        if (win !== null) return current;
      }

      current = getOpponent(current);
    }

    // 超过步数限制，按评估分数判定
    return null;
  }

  /**
   * 迭代加深搜索。
   * 从 depth=1 开始逐步加深，时间到则返回上一层的最优解。
   */
  private iterativeDeepening(
    board: (string | null)[][],
    playerColor: PlayerColor,
    config: SearchConfig,
  ): { bestMove: Move | null; bestScore: number; depthReached: number } {
    let bestMove: Move | null = null;
    let bestScore = 0;
    let depthReached = 0;

    // 初始候选：如果棋盘为空，下天元
    let hasStone = false;
    for (let r = 0; r < BOARD_SIZE && !hasStone; r += 1) {
      for (let c = 0; c < BOARD_SIZE && !hasStone; c += 1) {
        if (board[r][c] !== null) hasStone = true;
      }
    }
    if (!hasStone) {
      return {
        bestMove: { row: 7, col: 7 },
        bestScore: POSITION_WEIGHTS[7][7],
        depthReached: 1,
      };
    }

    const maxDepth = Math.min(config.maxDepth, this.maxInternalDepth);
    const boardCopy = cloneBoard(board);

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      if (this.stopped) break;
      if (this.checkTime()) break;

      const alphaInitial = -SCORE.FIVE * 2;
      const betaInitial = SCORE.FIVE * 2;

      const score = this.alphaBeta(
        boardCopy,
        depth,
        alphaInitial,
        betaInitial,
        true,
        playerColor,
        playerColor,
        null,
        0,
        config.candidateCount,
        false,
        config.useNullMove,
      );

      if (this.stopped) {
        // 超时，丢弃当前不完整的深度结果
        break;
      }

      // 从置换表中取出根节点的 bestMove
      const rootHash = computeZobristHash(boardCopy);
      const entry = this.tt.get(rootHash);
      if (entry && entry.bestMove) {
        bestMove = entry.bestMove;
        bestScore = score;
        depthReached = depth;
      } else if (bestMove === null) {
        // 第一层至少要有一个走法
        const candidates = getCandidates(boardCopy, playerColor, 1);
        if (candidates.length > 0) {
          bestMove = { row: candidates[0].row, col: candidates[0].col };
          bestScore = score;
          depthReached = depth;
        }
      }

      // 如果已经找到必胜/必败，可以提前停止
      if (Math.abs(score) >= SCORE.FIVE) {
        break;
      }
    }

    return { bestMove, bestScore, depthReached };
  }

  /**
   * Alpha-Beta 搜索核心。
   *
   * @param board 当前棋盘（就地修改，使用后恢复）
   * @param depth 剩余搜索深度
   * @param alpha alpha 值
   * @param beta beta 值
   * @param isMaximizing 是否为最大化玩家（AI 方）
   * @param aiPlayer AI 玩家颜色（评估视角）
   * @param currentPlayer 当前落子方
   * @param lastMove 上一步落子（用于判胜）
   * @param plyFromRoot 距根节点的步数
   * @param candidateCount 每层候选点数量
   * @param nullMoveDone 是否已做过空着（避免连续空着）
   * @param useNullMove 是否启用空着裁剪
   * @returns 该节点的评估分数
   */
  private alphaBeta(
    board: (string | null)[][],
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    aiPlayer: PlayerColor,
    currentPlayer: PlayerColor,
    lastMove: Move | null,
    plyFromRoot: number,
    candidateCount: number,
    nullMoveDone: boolean,
    useNullMove: boolean,
  ): number {
    this.nodes += 1;

    // 时间检查
    if (this.nodes % 1024 === 0 && this.checkTime()) {
      this.stopped = true;
      return isMaximizing ? alpha : beta;
    }

    // 终止条件：上一步成五
    if (lastMove !== null) {
      const winner = getOpponent(currentPlayer);
      if (checkWin(board, lastMove.row, lastMove.col, winner) !== null) {
        // 距离根节点越近（越快赢/输），绝对值越大
        const distanceBonus = (plyFromRoot > 0 ? 1000 - plyFromRoot * 10 : 1000);
        if (winner === aiPlayer) {
          return SCORE.FIVE + distanceBonus;
        }
        return -SCORE.FIVE - distanceBonus;
      }
    }

    // 终止条件：深度为 0
    if (depth <= 0) {
      return this.useFineEval
        ? evaluateBoardFine(board, aiPlayer)
        : evaluateBoard(board, aiPlayer);
    }

    // 置换表查询
    const hash = computeZobristHash(board);
    const ttEntry = this.tt.get(hash);
    let ttBestMove: Move | undefined;
    if (ttEntry && ttEntry.depth >= depth) {
      ttBestMove = ttEntry.bestMove;
      if (ttEntry.flag === 'exact') {
        return ttEntry.score;
      }
      if (ttEntry.flag === 'lower' && ttEntry.score >= beta) {
        return ttEntry.score;
      }
      if (ttEntry.flag === 'upper' && ttEntry.score <= alpha) {
        return ttEntry.score;
      }
    }

    // 空着裁剪（Null Move Pruning）
    // 仅在非 PV 节点(beta - alpha > 1)、深度足够、未连续空着、优势方使用
    if (
      useNullMove &&
      !nullMoveDone &&
      depth >= 3 &&
      beta - alpha === 1 &&
      lastMove !== null
    ) {
      const opponent = getOpponent(currentPlayer);
      // 粗略评估：如果当前方劣势，空着风险大，跳过
      const staticEval = evaluateBoard(board, aiPlayer);
      const sideToMoveAdvantage = isMaximizing
        ? staticEval
        : -staticEval;
      if (sideToMoveAdvantage >= SCORE.OPEN_THREE) {
        // 做一次空着：让对方直接走
        const R = depth >= 6 ? 3 : 2;
        const nullScore = this.alphaBeta(
          board,
          depth - R - 1,
          beta,
          beta - 1,
          !isMaximizing,
          aiPlayer,
          opponent,
          null,
          plyFromRoot + 1,
          candidateCount,
          true,
          useNullMove,
        );
        if (this.stopped) {
          return isMaximizing ? alpha : beta;
        }
        if (isMaximizing && nullScore >= beta) {
          return beta;
        }
        if (!isMaximizing && nullScore <= alpha) {
          return alpha;
        }
      }
    }

    // 生成并排序候选点
    const candidates = this.orderMoves(
      board,
      currentPlayer,
      candidateCount,
      ttBestMove,
      plyFromRoot,
      this.useSmartCandidates,
    );

    if (candidates.length === 0) {
      return evaluateBoard(board, aiPlayer);
    }

    const originalAlpha = alpha;
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let bestMoveInNode: Move | null = null;
    let madeMove = false;

    for (let i = 0; i < candidates.length; i += 1) {
      const move = candidates[i];
      if (board[move.row][move.col] !== null) continue;

      board[move.row][move.col] = currentPlayer;
      madeMove = true;

      const opponent = getOpponent(currentPlayer);
      let score: number;

      if (i === 0) {
        // 第一个候选走全深度（PV 节点）
        score = this.alphaBeta(
          board,
          depth - 1,
          alpha,
          beta,
          !isMaximizing,
          aiPlayer,
          opponent,
          { row: move.row, col: move.col },
          plyFromRoot + 1,
          candidateCount,
          false,
          useNullMove,
        );
      } else {
        // 后续候选用零窗口浅搜索（PVS 思想）
        score = this.alphaBeta(
          board,
          depth - 1,
          alpha,
          alpha + 1,
          !isMaximizing,
          aiPlayer,
          opponent,
          { row: move.row, col: move.col },
          plyFromRoot + 1,
          candidateCount,
          false,
          useNullMove,
        );
        // 如果落在 (alpha, beta) 区间内，再做全窗口搜索
        if (!this.stopped && score > alpha && score < beta) {
          score = this.alphaBeta(
            board,
            depth - 1,
            alpha,
            beta,
            !isMaximizing,
            aiPlayer,
            opponent,
            { row: move.row, col: move.col },
            plyFromRoot + 1,
            candidateCount,
            false,
            useNullMove,
          );
        }
      }

      board[move.row][move.col] = null;

      if (this.stopped) {
        return isMaximizing ? alpha : beta;
      }

      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMoveInNode = { row: move.row, col: move.col };
        }
        if (score > alpha) {
          alpha = score;
        }
        if (alpha >= beta) {
          // 剪枝：更新杀手走法和历史启发
          this.killers.addKiller(plyFromRoot, { row: move.row, col: move.col });
          this.history.addScore({ row: move.row, col: move.col }, depth);
          break;
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMoveInNode = { row: move.row, col: move.col };
        }
        if (score < beta) {
          beta = score;
        }
        if (alpha >= beta) {
          // 剪枝：更新杀手走法和历史启发
          this.killers.addKiller(plyFromRoot, { row: move.row, col: move.col });
          this.history.addScore({ row: move.row, col: move.col }, depth);
          break;
        }
      }
    }

    // 如果没有有效走法（理论上不会出现）
    if (!madeMove) {
      return evaluateBoard(board, aiPlayer);
    }

    // 存入置换表
    let flag: 'exact' | 'lower' | 'upper';
    if (bestScore <= originalAlpha) {
      flag = 'upper';
    } else if (bestScore >= beta) {
      flag = 'lower';
    } else {
      flag = 'exact';
    }

    this.tt.put(hash, {
      depth,
      score: bestScore,
      flag,
      bestMove: bestMoveInNode ?? undefined,
    });

    return bestScore;
  }

  /**
   * 候选点排序。
   *
   * 排序策略：
   * 1. 置换表 bestMove 排第一
   * 2. 杀手走法排第二、第三
   * 3. 其余按 evaluatePosition 分数 + 历史启发得分排序
   */
  private orderMoves(
    board: (string | null)[][],
    player: PlayerColor,
    count: number,
    ttBestMove: Move | undefined,
    ply: number,
    useSmart: boolean = false,
  ): Move[] {
    // 获取基础候选
    const baseCandidates = useSmart
      ? getCandidatesSmart(board, player, count + 6)
      : getCandidates(board, player, count + 4);
    const candidates: Move[] = [];
    const seen = new Set<string>();

    // 1. TT bestMove 优先
    if (ttBestMove && isInside(ttBestMove.row, ttBestMove.col)
        && board[ttBestMove.row][ttBestMove.col] === null) {
      candidates.push(ttBestMove);
      seen.add(`${ttBestMove.row},${ttBestMove.col}`);
    }

    // 2. 杀手走法
    const killers = this.killers.getKillers(ply);
    for (const km of killers) {
      const key = `${km.row},${km.col}`;
      if (
        !seen.has(key) &&
        isInside(km.row, km.col) &&
        board[km.row][km.col] === null
      ) {
        candidates.push(km);
        seen.add(key);
      }
    }

    // 3. 其余按综合得分排序
    // 白棋使用 evaluatePositionWhite 计算额外反击加成
    const rest: Array<{ move: Move; score: number }> = [];
    for (const c of baseCandidates) {
      const key = `${c.row},${c.col}`;
      if (seen.has(key)) continue;
      const histScore = this.history.getScore({ row: c.row, col: c.col });
      // 白棋额外加一层 position-based 进攻分（鼓励选择有反击潜力的点）
      let whiteBonus = 0;
      if (player === 'white') {
        whiteBonus = evaluatePositionWhite(board, c.row, c.col, 'white') * 0.1;
      }
      rest.push({
        move: { row: c.row, col: c.col },
        score: c.score + histScore + whiteBonus,
      });
    }
    rest.sort((a, b) => b.score - a.score);

    for (const r of rest) {
      candidates.push(r.move);
      if (candidates.length >= count) break;
    }

    return candidates;
  }

  /**
   * 检查搜索时间是否已到。
   */
  private checkTime(): boolean {
    return Date.now() - this.startTime >= this.timeLimitMs;
  }
}

// ============================================================
// 5. 难度配置
// ============================================================

export const DIFFICULTY_CONFIGS: Record<AiDifficulty, SearchConfig> = {
  easy: {
    maxDepth: 3,
    timeLimitMs: 250,
    candidateCount: 8,
    useVCF: false,
    vcfDepth: 6,
    useVCT: false,
    vctDepth: 4,
    useOpeningBook: true,
    useNullMove: false,
    randomJitter: 500,
    useFineEval: false,
    useSmartCandidates: false,
    useMCTS: false,
    endgameThreshold: 50,
    endgameMaxDepth: 12,
    defenseDepthBonus: 0,
    whiteDepthBonus: 1,
  },
  normal: {
    maxDepth: 5,
    timeLimitMs: 700,
    candidateCount: 10,
    useVCF: false,
    vcfDepth: 7,
    useVCT: false,
    vctDepth: 5,
    useOpeningBook: true,
    useNullMove: true,
    randomJitter: 0,
    useFineEval: false,
    useSmartCandidates: false,
    useMCTS: false,
    endgameThreshold: 48,
    endgameMaxDepth: 16,
    defenseDepthBonus: 0,
    whiteDepthBonus: 1,
  },
  hard: {
     maxDepth: 7,
     timeLimitMs: 1500,
     candidateCount: 12,
     useVCF: true,
     vcfDepth: 8,
     useVCT: true,
     vctDepth: 6,
     useOpeningBook: true,
     useNullMove: true,
     randomJitter: 0,
     useFineEval: false,
     useSmartCandidates: false,
     useMCTS: false,
     endgameThreshold: 45,
     endgameMaxDepth: 20,
     defenseDepthBonus: 1,
     whiteDepthBonus: 1,
   },
   hell: {
     maxDepth: 14,
     timeLimitMs: 8000,
     candidateCount: 18,
     useVCF: true,
     vcfDepth: 8,
     useVCT: true,
     vctDepth: 6,
     useOpeningBook: true,
     useNullMove: true,
     randomJitter: 0,
     useFineEval: false,
     useSmartCandidates: false,
     useMCTS: false,
     endgameThreshold: 45,
     endgameMaxDepth: 20,
     defenseDepthBonus: 1,
     whiteDepthBonus: 1,
   },
    godlike: {
      maxDepth: 20,
      timeLimitMs: 20000,
      candidateCount: 8,
      useVCF: true,
      vcfDepth: 15,
      useVCT: true,
      vctDepth: 10,
      useOpeningBook: true,
      useNullMove: true,
      randomJitter: 0,
      useFineEval: false,
      useSmartCandidates: true,
      useMCTS: false,
      mctsSimulations: 40,
      endgameThreshold: 40,
      endgameMaxDepth: 24,
      defenseDepthBonus: 3,
      whiteDepthBonus: 5,
    },
};

// ============================================================
// 6. 便捷调用入口
// ============================================================

/**
 * 快速调用：给定棋盘、玩家颜色和难度，返回最佳走法。
 */
export function findBestMove(
  board: (string | null)[][],
  playerColor: PlayerColor,
  difficulty: AiDifficulty,
  moveHistory: MoveWithPlayer[] = [],
): Move | null {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const ttSize = difficulty === 'godlike' ? 800000 : difficulty === 'hell' ? 200000 : 100000;
  const ai = new GomokuAI(ttSize);
  const result = ai.search(board, playerColor, config, moveHistory);
  return result.move;
}

/**
 * 带详细结果的调用：返回完整搜索结果（用于AI提示等需要分析信息的场景）。
 */
export function findBestMoveDetailed(
  board: (string | null)[][],
  playerColor: PlayerColor,
  difficulty: AiDifficulty,
  moveHistory: MoveWithPlayer[] = [],
): SearchResult {
  const config = DIFFICULTY_CONFIGS[difficulty];
  const ttSize = difficulty === 'godlike' ? 800000 : difficulty === 'hell' ? 200000 : 100000;
  const ai = new GomokuAI(ttSize);
  return ai.search(board, playerColor, config, moveHistory);
}
