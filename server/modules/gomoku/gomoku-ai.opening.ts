import type { Move, MoveWithPlayer } from '@shared/api.interface';
import { BOARD_SIZE, isInside } from './gomoku-ai.engine';

// ============================================================
// 类型定义
// ============================================================

interface OpeningLine {
  name: string;
  moves: Move[];
}

// ============================================================
// 开局库数据（0-based 坐标，天元 = (7,7)）
// 颜色交替：黑-白-黑-白-...
// ============================================================

const OPENING_LINES: OpeningLine[] = [
  // ---------- 花月（Kagetsu）：黑必胜开局 ----------
  {
    name: '花月-正变',
    moves: [
      { row: 7, col: 7 },   // 黑1 天元
      { row: 6, col: 6 },   // 白2 斜
      { row: 8, col: 8 },   // 黑3 斜成二（花月定式）
      { row: 6, col: 8 },   // 白4 防守
      { row: 9, col: 9 },   // 黑5 延伸
      { row: 5, col: 9 },   // 白6
    ],
  },
  {
    name: '花月-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 7, col: 8 },   // 白4 水平挡
      { row: 6, col: 9 },   // 黑5 斜二
      { row: 8, col: 6 },   // 白6 防守
    ],
  },
  {
    name: '花月-黑3变I7',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },   // 黑3 另一方向斜
      { row: 8, col: 7 },   // 白4 挡
      { row: 6, col: 8 },   // 黑5 斜二
      { row: 5, col: 5 },   // 白6
    ],
  },

  // ---------- 浦月（Fuugetsu）：黑必胜开局 ----------
  {
    name: '浦月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 水平相邻（上）
      { row: 8, col: 6 },   // 黑3 斜跳（浦月定式）
      { row: 8, col: 7 },   // 白4 挡
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 6, col: 6 },   // 白6
    ],
  },
  {
    name: '浦月-白4变G7',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },   // 白4 斜挡
      { row: 9, col: 5 },   // 黑5
      { row: 7, col: 5 },   // 白6
    ],
  },

  // ---------- 疏星（Sosei）：平衡开局 ----------
  {
    name: '疏星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 水平（上）
      { row: 9, col: 7 },   // 黑3 对侧水平（疏星）
      { row: 6, col: 6 },   // 白4 斜
      { row: 8, col: 6 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },
  {
    name: '疏星-白4变I6',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 6, col: 8 },   // 白4 右上斜
      { row: 8, col: 8 },   // 黑5
      { row: 8, col: 6 },   // 白6
    ],
  },

  // ---------- 斜月（Shogetsu） ----------
  {
    name: '斜月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 8, col: 7 },   // 黑3 水平右（斜月）
      { row: 6, col: 8 },   // 白4 防守
      { row: 9, col: 6 },   // 黑5
      { row: 7, col: 6 },   // 白6
    ],
  },
  {
    name: '斜月-白4变I6',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 7 },
      { row: 8, col: 6 },   // 白4 左下
      { row: 6, col: 7 },   // 黑5 水平
      { row: 5, col: 5 },   // 白6
    ],
  },

  // ---------- 名月（Meigetsu） ----------
  {
    name: '名月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 7, col: 5 },   // 黑3 下方（名月）
      { row: 6, col: 8 },   // 白4 防守
      { row: 8, col: 8 },   // 黑5
      { row: 8, col: 6 },   // 白6
    ],
  },
  {
    name: '名月-白4变H6',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },   // 白4 垂直挡
      { row: 8, col: 8 },   // 黑5
      { row: 6, col: 8 },   // 白6
    ],
  },

  // ---------- 峡月（Kyogetsu） ----------
  {
    name: '峡月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },   // 白2 右下斜
      { row: 6, col: 6 },   // 黑3 左上斜（峡月）
      { row: 6, col: 8 },   // 白4 防守
      { row: 9, col: 5 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },
  {
    name: '峡月-白4变H6',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 7, col: 6 },   // 白4 垂直挡
      { row: 5, col: 5 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },

  // ---------- 溪月（Keigetsu） ----------
  {
    name: '溪月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },   // 白2 右下斜
      { row: 9, col: 7 },   // 黑3 水平右（溪月）
      { row: 6, col: 6 },   // 白4 防守
      { row: 8, col: 8 },   // 黑5
      { row: 9, col: 6 },   // 白6
    ],
  },
  {
    name: '溪月-白4变I8',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 8, col: 8 },   // 白4 右上
      { row: 6, col: 8 },   // 黑5
      { row: 6, col: 6 },   // 白6
    ],
  },

  // ---------- 瑞星（Zuisei） ----------
  {
    name: '瑞星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 水平上
      { row: 8, col: 7 },   // 黑3 水平下（瑞星）
      { row: 6, col: 6 },   // 白4 斜
      { row: 8, col: 8 },   // 黑5
      { row: 6, col: 8 },   // 白6
    ],
  },
  {
    name: '瑞星-白4变斜',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 8, col: 6 },   // 白4 右斜下
      { row: 6, col: 6 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },

  // ---------- 金星（Kinsei） ----------
  {
    name: '金星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 5, col: 7 },   // 黑3 跳左（金星）
      { row: 6, col: 8 },   // 白4 防守
      { row: 8, col: 6 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },
  {
    name: '金星-白4变F7',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },
      { row: 5, col: 6 },   // 白4 挡
      { row: 8, col: 6 },   // 黑5
      { row: 6, col: 8 },   // 白6
    ],
  },

  // ---------- 松月（Shogetsu / Matsu） ----------
  {
    name: '松月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 垂直下
      { row: 6, col: 7 },   // 黑3 水平左（松月）
      { row: 6, col: 6 },   // 白4 斜
      { row: 8, col: 8 },   // 黑5
      { row: 8, col: 6 },   // 白6
    ],
  },
  {
    name: '松月-白4变G8',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 6, col: 8 },   // 白4 右上斜
      { row: 8, col: 8 },   // 黑5
      { row: 8, col: 6 },   // 白6
    ],
  },

  // ---------- 寒星（Kansei） ----------
  {
    name: '寒星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 垂直下
      { row: 7, col: 9 },   // 黑3 跳右（寒星）
      { row: 6, col: 7 },   // 白4 防守
      { row: 8, col: 8 },   // 黑5
      { row: 6, col: 6 },   // 白6
    ],
  },

  // ---------- 丘月（Kyūgetsu） ----------
  {
    name: '丘月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 水平上
      { row: 7, col: 5 },   // 黑3 下跳（丘月）
      { row: 6, col: 6 },   // 白4 防守
      { row: 8, col: 6 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },

  // ---------- 游星（Yūsei） ----------
  {
    name: '游星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },   // 白2 右上斜
      { row: 8, col: 6 },   // 黑3 左下斜（游星）
      { row: 6, col: 6 },   // 白4 防守
      { row: 9, col: 5 },   // 黑5
      { row: 8, col: 8 },   // 白6
    ],
  },

  // ---------- 长星（Chōsei） ----------
  {
    name: '长星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 5, col: 5 },   // 黑3 斜延伸（长星）
      { row: 8, col: 8 },   // 白4 防守
      { row: 6, col: 8 },   // 黑5
      { row: 9, col: 9 },   // 白6
    ],
  },

  // ---------- 云月（Ungetsu） ----------
  {
    name: '云月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 8 },   // 白2 右下斜
      { row: 6, col: 6 },   // 黑3 左上斜（云月）
      { row: 8, col: 6 },   // 白4 防守
      { row: 5, col: 5 },   // 黑5
      { row: 9, col: 9 },   // 白6
    ],
  },

  // ---------- 雨月（Ugetsu） ----------
  {
    name: '雨月-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 7 },   // 白2 垂直下
      { row: 6, col: 8 },   // 黑3 右上斜（雨月）
      { row: 6, col: 6 },   // 白4 防守
      { row: 8, col: 8 },   // 黑5
      { row: 9, col: 7 },   // 白6
    ],
  },

  // ---------- 明星（Myōjō） ----------
  {
    name: '明星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 水平右
      { row: 7, col: 6 },   // 黑3 水平左（明星）
      { row: 6, col: 7 },   // 白4 垂直挡
      { row: 8, col: 8 },   // 黑5
      { row: 6, col: 6 },   // 白6
    ],
  },

  // ---------- 彗星（Suisei） ----------
  {
    name: '彗星-正变',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },   // 白2 右上斜
      { row: 6, col: 6 },   // 黑3 左上斜（彗星）
      { row: 8, col: 8 },   // 白4 防守
      { row: 5, col: 7 },   // 黑5
      { row: 8, col: 6 },   // 白6
    ],
  },

  // ============================================================
  // 白棋主动变招开局线（白棋强防变化）
  // ============================================================

  // ---------- 花月-白棋强防 ----------
  {
    name: '花月-白4变J7强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 7, col: 9 },   // 白4 右侧跳挡（强防）
      { row: 6, col: 7 },   // 黑5 垂直二
      { row: 9, col: 9 },   // 白6 斜挡
    ],
  },
  {
    name: '花月-白6变H5',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 9, col: 9 },
      { row: 7, col: 5 },   // 白6 左侧反攻
    ],
  },
  {
    name: '花月-白4变H5斜防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 5 },   // 白4 斜向延伸防守
      { row: 6, col: 8 },   // 黑5 另一侧斜二
      { row: 9, col: 7 },   // 白6 挡下侧
    ],
  },

  // ---------- 浦月-白棋强防 ----------
  {
    name: '浦月-白4变H8竖挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 7, col: 8 },   // 白4 右侧挡
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 6, col: 6 },   // 白6 斜防
    ],
  },
  {
    name: '浦月-白6变I5反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 9, col: 5 },
      { row: 8, col: 4 },   // 白6 继续延伸压迫
    ],
  },

  // ---------- 峡月-白棋强防 ----------
  {
    name: '峡月-白4变G5斜防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 5, col: 5 },   // 白4 斜延伸防守
      { row: 6, col: 8 },   // 黑5 另一侧
      { row: 9, col: 7 },   // 白6 挡
    ],
  },
  {
    name: '峡月-白4变I9右下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 9, col: 9 },   // 白4 右下斜挡
      { row: 5, col: 5 },   // 黑5 延伸
      { row: 6, col: 8 },   // 白6 斜二防守
    ],
  },

  // ---------- 溪月-白棋强防 ----------
  {
    name: '溪月-白4变H6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 7, col: 6 },   // 白4 垂直左挡
      { row: 8, col: 8 },   // 黑5 斜二
      { row: 10, col: 7 },  // 白6 继续延伸
    ],
  },
  {
    name: '溪月-白6变J7反击',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 9, col: 9 },   // 白6 斜挡兼反攻
    ],
  },

  // ---------- 寒星-白棋强防 ----------
  {
    name: '寒星-白4变F6斜防',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 5 },   // 白4 左下斜挡
      { row: 8, col: 8 },   // 黑5 斜二
      { row: 6, col: 8 },   // 白6 右上斜挡
    ],
  },
  {
    name: '寒星-白2变I7上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 右侧挡（变化）
      { row: 7, col: 5 },   // 黑3 寒星变
      { row: 6, col: 6 },   // 白4 斜防
      { row: 8, col: 8 },   // 黑5
      { row: 8, col: 6 },   // 白6
    ],
  },

  // ---------- 疏星-白棋强防 ----------
  {
    name: '疏星-白4变H8斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 7, col: 8 },   // 白4 水平右挡（变招）
      { row: 8, col: 6 },   // 黑5 斜二
      { row: 6, col: 6 },   // 白6 左上斜
    ],
  },
  {
    name: '疏星-白6变G5反击',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 6, col: 5 },   // 白6 延伸进攻
    ],
  },

  // ---------- 瑞星-白棋强防 ----------
  {
    name: '瑞星-白4变I7右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 7, col: 8 },   // 白4 右侧水平挡（强防）
      { row: 6, col: 6 },   // 黑5 斜二
      { row: 8, col: 6 },   // 白6 左下斜挡
    ],
  },
  {
    name: '瑞星-白6变J6斜攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 9, col: 5 },   // 白6 左下斜延伸
    ],
  },

  // ---------- 金星-白棋强防 ----------
  {
    name: '金星-白4变H8右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },
      { row: 7, col: 8 },   // 白4 右侧水平挡
      { row: 8, col: 6 },   // 黑5 斜二
      { row: 5, col: 8 },   // 白6 右上斜
    ],
  },

  // ---------- 松月-白棋强防 ----------
  {
    name: '松月-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },   // 白4 左下斜挡（强防变招）
      { row: 5, col: 7 },   // 黑5 延伸
      { row: 5, col: 6 },   // 白6 挡
    ],
  },
  {
    name: '松月-白6变H9斜攻',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },
      { row: 5, col: 9 },   // 白6 右上延伸
    ],
  },

  // ---------- 丘月-白棋强防 ----------
  {
    name: '丘月-白4变I7右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 7, col: 5 },
      { row: 7, col: 8 },   // 白4 右侧水平挡
      { row: 8, col: 6 },   // 黑5 斜二
      { row: 6, col: 6 },   // 白6 斜防
    ],
  },
  {
    name: '丘月-白6变F6反攻',
     moves: [
       { row: 7, col: 7 },
       { row: 6, col: 7 },
       { row: 7, col: 5 },
       { row: 6, col: 6 },
       { row: 8, col: 6 },
       { row: 5, col: 6 },   // 白6 上方反攻
     ],
   },
  // ---------- 冷门开局与变招（神仙级补充） ----------
  {
    name: '花月-黑5变J6强攻',
    moves: [
      { row: 7, col: 7 },   // 黑1 天元
      { row: 6, col: 6 },   // 白2 斜
      { row: 8, col: 8 },   // 黑3 花月
      { row: 6, col: 8 },   // 白4 防守
      { row: 9, col: 6 },   // 黑5 J6 变招强攻
      { row: 6, col: 5 },   // 白6 左侧防守
    ],
  },
  {
    name: '花月-白4变F8左挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 8 },   // 白4 F8 左上方挡
      { row: 9, col: 9 },   // 黑5 延伸
      { row: 6, col: 9 },   // 白6 防守
    ],
  },
  {
    name: '浦月-黑5变H6上攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },   // 黑3 浦月
      { row: 7, col: 6 },   // 白4 直挡
      { row: 5, col: 7 },   // 黑5 H6 上方攻
      { row: 6, col: 6 },   // 白6 斜防
    ],
  },
  {
    name: '浦月-白6变J8右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },
      { row: 7, col: 9 },   // 白4 右挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 9, col: 8 },   // 白6 J8 下方挡
    ],
  },
  {
    name: '寒星-黑5变G6左攻',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 直止 寒星
      { row: 8, col: 7 },   // 黑3 下直二
      { row: 6, col: 6 },   // 白4 斜防
      { row: 8, col: 6 },   // 黑5 G6 左攻
      { row: 6, col: 7 },   // 白6 上挡
    ],
  },
  {
    name: '寒星-白4变H6上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },
      { row: 8, col: 7 },
      { row: 6, col: 7 },   // 白4 上挡
      { row: 7, col: 6 },   // 黑5 左攻
      { row: 7, col: 9 },   // 白6 右挡
    ],
  },
  {
    name: '疏星-黑5变F5斜攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },   // 黑3 疏星
      { row: 7, col: 6 },   // 白4 左挡
      { row: 5, col: 5 },   // 黑5 F5 左上斜攻
      { row: 5, col: 7 },   // 白6 上挡
    ],
  },
  {
    name: '金星-黑5变I9右下',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },
      { row: 6, col: 6 },   // 黑3 金星
      { row: 6, col: 8 },   // 白4 右上挡
      { row: 8, col: 8 },   // 黑5 I9 右下斜
      { row: 5, col: 5 },   // 白6 防守
    ],
  },
  {
    name: '松月-黑5变G9左攻',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },
      { row: 8, col: 9 },   // 黑3 松月
      { row: 8, col: 8 },   // 白4 下挡
      { row: 6, col: 9 },   // 黑5 G9 上攻
      { row: 9, col: 9 },   // 白6 下挡
    ],
  },
  {
    name: '瑞星-黑5变J7右攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },   // 黑3 瑞星
      { row: 6, col: 6 },   // 白4 斜防
      { row: 7, col: 9 },   // 黑5 J7 右攻
      { row: 7, col: 5 },   // 白6 左挡
    ],
  },
  {
    name: '名月-白4变J6右防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 7, col: 5 },   // 黑3 名月
      { row: 9, col: 6 },   // 白4 J6 右下斜防
      { row: 6, col: 5 },   // 黑5 上攻
      { row: 8, col: 5 },   // 白6 下挡
    ],
  },
  {
    name: '斜月-白6变H9下攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 5 },   // 黑3 斜月
      { row: 6, col: 5 },   // 白4 上挡
      { row: 9, col: 4 },   // 黑5 延伸
      { row: 7, col: 9 },   // 白6 H9 右方反击
    ],
  },
  {
    name: '长星-白4变J8右防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 10, col: 7 },  // 黑3 长星
      { row: 9, col: 8 },   // 白4 J8 右斜防
      { row: 7, col: 9 },   // 黑5 右攻
      { row: 7, col: 5 },   // 白6 左挡
    ],
  },
  {
    name: '游星-白4变H8右防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 10, col: 6 },  // 黑3 游星
      { row: 7, col: 9 },   // 白4 H8 右防
      { row: 6, col: 6 },   // 黑5 左上斜
      { row: 8, col: 8 },   // 白6 中防
    ],
  },
  {
    name: '云月-白4变F6左防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },   // 黑3 云月
      { row: 5, col: 5 },   // 白4 F6 左上方防
      { row: 9, col: 7 },   // 黑5 下攻
      { row: 5, col: 7 },   // 白6 上挡
    ],
  },
  {
    name: '雨月-白4变J6右防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 8 },   // 黑3 雨月
      { row: 9, col: 6 },   // 白4 J6 右下防
      { row: 5, col: 9 },   // 黑5 右上延伸
      { row: 7, col: 9 },   // 白6 右挡
    ],
  },
  {
    name: '彗星-白4变I7上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 9 },
      { row: 8, col: 5 },   // 黑3 彗星
      { row: 6, col: 7 },   // 白4 I7 上方挡
      { row: 9, col: 4 },   // 黑5 延伸
      { row: 6, col: 9 },   // 白6 右上斜防
    ],
  },

  // ============================================================
  // 神级补充：白棋应对扩展（第二版新增 12 条白方强防变招）
  // ============================================================

  // ---------- 花月-白棋扩展变招 ----------
  {
    name: '花月-白4变G8上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },   // 黑3 花月
      { row: 6, col: 7 },   // 白4 上方垂直挡（变化）
      { row: 9, col: 9 },   // 黑5 延伸
      { row: 8, col: 6 },   // 白6 左下斜防
    ],
  },
  {
    name: '花月-白6变I5反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 9, col: 9 },
      { row: 8, col: 5 },   // 白6 左下方向延伸反攻
    ],
  },
  {
    name: '花月-白4变I6斜跳防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 8, col: 6 },   // 白4 左下斜跳防
      { row: 6, col: 9 },   // 黑5 右上斜二
      { row: 5, col: 7 },   // 白6 上方挡
    ],
  },

  // ---------- 浦月-白棋扩展变招 ----------
  {
    name: '浦月-白4变I6斜防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },   // 黑3 浦月
      { row: 8, col: 5 },   // 白4 左下斜防
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 7, col: 5 },   // 白6 下方挡
    ],
  },
  {
    name: '浦月-白6变H9右攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 9, col: 5 },
      { row: 7, col: 8 },   // 白6 右侧水平进攻
    ],
  },

  // ---------- 云月-白棋扩展变招 ----------
  {
    name: '云月-白4变H6中挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },   // 黑3 云月
      { row: 7, col: 6 },   // 白4 左侧垂直挡
      { row: 5, col: 5 },   // 黑5 延伸
      { row: 8, col: 6 },   // 白6 左下斜挡
    ],
  },
  {
    name: '云月-白6变I7右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 5, col: 5 },
      { row: 7, col: 8 },   // 白6 右侧水平挡
    ],
  },

  // ---------- 雨月-白棋扩展变招 ----------
  {
    name: '雨月-白4变H6中挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },   // 黑3 雨月
      { row: 7, col: 8 },   // 白4 右侧垂直挡
      { row: 8, col: 8 },   // 黑5 下方延伸
      { row: 5, col: 9 },   // 白6 右上斜防
    ],
  },
  {
    name: '雨月-白6变F5左攻',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 5 },   // 白6 左上斜延伸
    ],
  },

  // ---------- 金星-白棋扩展变招 ----------
  {
    name: '金星-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },   // 黑3 金星
      { row: 6, col: 7 },   // 白4 上方垂直挡
      { row: 8, col: 6 },   // 黑5 左下斜二
      { row: 6, col: 8 },   // 白6 右上斜挡
    ],
  },

  // ---------- 松月-白棋扩展变招 ----------
  {
    name: '松月-白4变H8右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },   // 黑3 松月
      { row: 7, col: 8 },   // 白4 右侧水平挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 6 },   // 白6 左上斜挡
    ],
  },
  {
    name: '松月-白6变I5左下',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },
      { row: 8, col: 5 },   // 白6 左下斜延伸
    ],
  },

  // ============================================================
  // 第三版神白开局库扩充：26种开局全覆盖，180+条白棋防守变化
  // ============================================================

  // ---------- 岚月（Rangetsu）斜指：黑必胜 ----------
  {
    name: '岚月-正变-白2斜-白4直挡',
    moves: [
      { row: 7, col: 7 },   // 黑1 天元
      { row: 6, col: 6 },   // 白2 斜
      { row: 6, col: 8 },   // 黑3 右上斜（岚月）
      { row: 7, col: 8 },   // 白4 右侧直挡
      { row: 5, col: 9 },   // 黑5 延伸
      { row: 8, col: 6 },   // 白6 左下斜防
      { row: 5, col: 7 },   // 黑7 上方攻
      { row: 6, col: 5 },   // 白8 左挡
    ],
  },
  {
    name: '岚月-白4变G8斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 8 },   // 黑3 岚月
      { row: 5, col: 8 },   // 白4 G8 上挡
      { row: 8, col: 8 },   // 黑5 下方斜二
      { row: 7, col: 6 },   // 白6 左挡
      { row: 5, col: 5 },   // 黑7 左上延伸
      { row: 8, col: 9 },   // 白8 右下挡
    ],
  },
  {
    name: '岚月-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },   // 白4 I6 下方斜挡（强防）
      { row: 5, col: 9 },   // 黑5 延伸
      { row: 7, col: 9 },   // 白6 右挡
      { row: 8, col: 6 },   // 黑7 左下攻
      { row: 6, col: 5 },   // 白8 左防
    ],
  },
  {
    name: '岚月-黑5变H6上攻-白6斜防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 8 },
      { row: 7, col: 8 },
      { row: 5, col: 7 },   // 黑5 H6 上方攻
      { row: 5, col: 6 },   // 白6 左上斜挡
      { row: 8, col: 6 },   // 黑7 左下斜二
      { row: 8, col: 9 },   // 白8 右下防守
      { row: 9, col: 5 },   // 黑9
      { row: 4, col: 8 },   // 白10
    ],
  },
  {
    name: '岚月-白2变I7直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 直止（变化）
      { row: 6, col: 6 },   // 黑3 岚月变
      { row: 6, col: 8 },   // 白4 右上挡
      { row: 8, col: 8 },   // 黑5 下方斜二
      { row: 8, col: 6 },   // 白6 左下斜挡
    ],
  },

  // ---------- 银月（Gingetsu）斜指：黑优 ----------
  {
    name: '银月-正变-白2斜-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 8, col: 6 },   // 黑3 左下水平（银月）
      { row: 8, col: 7 },   // 白4 下方直挡
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 6, col: 8 },   // 白6 右上斜防
      { row: 7, col: 5 },   // 黑7 左攻
      { row: 5, col: 7 },   // 白8 上挡
    ],
  },
  {
    name: '银月-白4变G5斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },   // 黑3 银月
      { row: 9, col: 5 },   // 白4 G5 左下斜挡
      { row: 6, col: 8 },   // 黑5 右上斜二
      { row: 7, col: 8 },   // 白6 右挡
      { row: 5, col: 9 },   // 黑7 延伸
      { row: 8, col: 8 },   // 白8 中防
    ],
  },
  {
    name: '银月-白4变I6上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 6, col: 5 },   // 白4 I6 左上斜挡（强防）
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 8, col: 7 },   // 白6 下挡
      { row: 6, col: 8 },   // 黑7 右上攻
      { row: 5, col: 7 },   // 白8 上防
    ],
  },
  {
    name: '银月-黑5变J6右攻-白6斜防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 8, col: 7 },
      { row: 9, col: 7 },   // 黑5 J6 右攻
      { row: 8, col: 8 },   // 白6 右下斜挡
      { row: 6, col: 8 },   // 黑7 右上斜二
      { row: 5, col: 9 },   // 白8 右上防
      { row: 7, col: 9 },   // 黑9
      { row: 6, col: 5 },   // 白10 左反攻
    ],
  },

  // ---------- 新月（Shingetsu）斜指：黑优 ----------
  {
    name: '新月-正变-白2斜-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 7, col: 9 },   // 黑3 右侧水平（新月）
      { row: 6, col: 8 },   // 白4 斜挡
      { row: 8, col: 8 },   // 黑5 斜二
      { row: 7, col: 6 },   // 白6 左挡
      { row: 9, col: 9 },   // 黑7 延伸
      { row: 8, col: 5 },   // 白8 左下反攻
    ],
  },
  {
    name: '新月-白4变G8上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 9 },   // 黑3 新月
      { row: 6, col: 7 },   // 白4 G8 上垂直挡
      { row: 8, col: 8 },   // 黑5 斜二
      { row: 6, col: 9 },   // 白6 右上挡
      { row: 9, col: 7 },   // 黑7 下方攻
      { row: 8, col: 6 },   // 白8 左下防
    ],
  },
  {
    name: '新月-白4变I8下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 9 },
      { row: 8, col: 8 },   // 白4 I8 下方斜挡（强防）
      { row: 6, col: 9 },   // 黑5 右上延伸
      { row: 5, col: 10 },  // 白6 挡
      { row: 8, col: 6 },   // 黑7 左下斜二
      { row: 7, col: 5 },   // 白8 左挡
    ],
  },
  {
    name: '新月-黑5变H6上攻-白6反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 8 },
      { row: 5, col: 7 },   // 黑5 H6 上方攻
      { row: 5, col: 6 },   // 白6 左上斜挡兼反攻
      { row: 8, col: 8 },   // 黑7 下方斜二
      { row: 9, col: 9 },   // 白8 右下延伸
      { row: 8, col: 6 },   // 黑9
      { row: 4, col: 8 },   // 白10 上方防守
    ],
  },

  // ---------- 恒星（Kosei）斜指：黑必胜 ----------
  {
    name: '恒星-正变-白2斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 5, col: 5 },   // 黑3 左上延伸（恒星）
      { row: 8, col: 8 },   // 白4 右下斜挡
      { row: 6, col: 8 },   // 黑5 右上斜二
      { row: 8, col: 6 },   // 白6 左下斜防
      { row: 4, col: 4 },   // 黑7 延伸
      { row: 9, col: 9 },   // 白8 右下挡
    ],
  },
  {
    name: '恒星-白4变G8上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 5 },   // 黑3 恒星
      { row: 6, col: 8 },   // 白4 G8 右上斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 8, col: 6 },   // 白6 左下斜挡
      { row: 4, col: 4 },   // 黑7 延伸
      { row: 7, col: 9 },   // 白8 右挡
    ],
  },
  {
    name: '恒星-白2变I7直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 5, col: 5 },   // 黑3 恒星变
      { row: 6, col: 6 },   // 白4 斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 8 },   // 白6 右上斜防
      { row: 4, col: 4 },   // 黑7 延伸
      { row: 8, col: 6 },   // 白8 左下挡
    ],
  },
  {
    name: '恒星-黑5变J6强攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 5 },
      { row: 8, col: 8 },
      { row: 9, col: 7 },   // 黑5 J6 右强攻
      { row: 8, col: 6 },   // 白6 左下斜挡（强防）
      { row: 6, col: 8 },   // 黑7 右上斜二
      { row: 7, col: 9 },   // 白8 右挡
      { row: 4, col: 4 },   // 黑9
      { row: 9, col: 9 },   // 白10 右下防
    ],
  },

  // ---------- 山月（Sangetsu）斜指：平衡 ----------
  {
    name: '山月-正变-白2斜-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },   // 白2 斜
      { row: 6, col: 7 },   // 黑3 上方水平（山月）
      { row: 7, col: 6 },   // 白4 左侧直挡
      { row: 5, col: 8 },   // 黑5 右上斜二
      { row: 8, col: 6 },   // 白6 左下斜防
      { row: 5, col: 6 },   // 黑7 左上延伸
      { row: 8, col: 8 },   // 白8 右下斜挡
    ],
  },
  {
    name: '山月-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 7 },   // 黑3 山月
      { row: 8, col: 6 },   // 白4 I6 左下斜挡
      { row: 5, col: 7 },   // 黑5 上方延伸
      { row: 5, col: 6 },   // 白6 左上挡
      { row: 8, col: 8 },   // 黑7 右下斜二
      { row: 7, col: 9 },   // 白8 右挡
    ],
  },
  {
    name: '山月-白4变G8斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 7 },
      { row: 5, col: 8 },   // 白4 G8 右上斜挡（强防）
      { row: 5, col: 6 },   // 黑5 左上延伸
      { row: 4, col: 5 },   // 白6 挡
      { row: 8, col: 6 },   // 黑7 左下攻
      { row: 8, col: 8 },   // 白8 右下防
    ],
  },
  {
    name: '山月-黑5变J7右攻-白6反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 6, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },   // 黑5 J7 右攻
      { row: 6, col: 8 },   // 白6 右上斜挡兼反攻
      { row: 8, col: 8 },   // 黑7 下方斜二
      { row: 8, col: 5 },   // 白8 左下反攻
      { row: 5, col: 8 },   // 黑9
      { row: 9, col: 9 },   // 白10 右下延伸
    ],
  },

  // ---------- 慧星（Suisei 直指）直指：黑优 ----------
  {
    name: '慧星(指)-正变-白2直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止
      { row: 6, col: 8 },   // 黑3 右上斜（慧星指）
      { row: 6, col: 7 },   // 白4 上挡
      { row: 8, col: 6 },   // 黑5 左下斜二
      { row: 8, col: 8 },   // 白6 右下斜防
      { row: 5, col: 9 },   // 黑7 延伸
      { row: 6, col: 5 },   // 白8 左挡
    ],
  },
  {
    name: '慧星(指)-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 8 },   // 黑3 慧星指
      { row: 8, col: 8 },   // 白4 I6 下方斜挡
      { row: 5, col: 9 },   // 黑5 延伸
      { row: 6, col: 9 },   // 白6 挡
      { row: 8, col: 6 },   // 黑7 左下斜二
      { row: 7, col: 5 },   // 白8 左挡
    ],
  },
  {
    name: '慧星(指)-白4变G6左斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },   // 白4 G6 左上斜挡
      { row: 5, col: 9 },   // 黑5 延伸
      { row: 6, col: 9 },   // 白6 挡
      { row: 8, col: 8 },   // 黑7 下方斜二
      { row: 8, col: 5 },   // 白8 左下反攻
    ],
  },

  // ---------- 峡月(指) 直指：黑优 ----------
  {
    name: '峡月(指)-正变-白2直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 直指
      { row: 8, col: 6 },   // 黑3 左下斜（峡月指）
      { row: 7, col: 6 },   // 白4 左挡
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 7, col: 8 },   // 白6 右挡
      { row: 6, col: 6 },   // 黑7 左上斜二
      { row: 8, col: 8 },   // 白8 右下斜防
    ],
  },
  {
    name: '峡月(指)-白4变G5斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },   // 黑3 峡月指
      { row: 9, col: 5 },   // 白4 G5 左下斜挡（强防）
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 5, col: 6 },   // 白6 上挡
      { row: 8, col: 8 },   // 黑7 右下斜二
      { row: 7, col: 8 },   // 白8 右挡
    ],
  },
  {
    name: '峡月(指)-白4变I8右挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 7, col: 8 },   // 白4 I8 右侧直挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 5, col: 7 },   // 白6 上挡
      { row: 9, col: 5 },   // 黑7 延伸
      { row: 8, col: 8 },   // 白8 右下防
    ],
  },
  {
    name: '峡月(指)-黑5变J6右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 7, col: 6 },
      { row: 9, col: 7 },   // 黑5 J6 右攻
      { row: 8, col: 8 },   // 白6 右下斜挡（强防）
      { row: 6, col: 6 },   // 黑7 左上斜二
      { row: 5, col: 5 },   // 白8 左上延伸
      { row: 8, col: 5 },   // 黑9
      { row: 7, col: 9 },   // 白10 右挡兼反攻
    ],
  },

  // ---------- 溪月(指) 直指：黑必胜 ----------
  {
    name: '溪月(指)-正变-白2直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 直指
      { row: 6, col: 5 },   // 黑3 左跳（溪月指）
      { row: 6, col: 6 },   // 白4 中挡
      { row: 8, col: 6 },   // 黑5 左下斜二
      { row: 7, col: 8 },   // 白6 右挡
      { row: 5, col: 4 },   // 黑7 延伸
      { row: 8, col: 8 },   // 白8 右下斜防
    ],
  },
  {
    name: '溪月(指)-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 6, col: 5 },   // 黑3 溪月指
      { row: 8, col: 6 },   // 白4 I6 下方斜挡（强防）
      { row: 5, col: 4 },   // 黑5 延伸
      { row: 6, col: 6 },   // 白6 中挡
      { row: 8, col: 8 },   // 黑7 右下斜二
      { row: 7, col: 8 },   // 白8 右挡
    ],
  },
  {
    name: '溪月(指)-白4变G7上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 6, col: 5 },
      { row: 5, col: 6 },   // 白4 G7 左上斜挡
      { row: 8, col: 6 },   // 黑5 左下斜二
      { row: 7, col: 6 },   // 白6 左挡
      { row: 5, col: 4 },   // 黑7 延伸
      { row: 8, col: 8 },   // 白8 右下防
    ],
  },

  // ---------- 瑞星(指) 直指：平衡 ----------
  {
    name: '瑞星(指)-正变-白2直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止
      { row: 7, col: 9 },   // 黑3 右跳（瑞星指）
      { row: 6, col: 8 },   // 白4 右上斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 6 },   // 白6 左上斜防
      { row: 7, col: 5 },   // 黑7 左攻
      { row: 8, col: 9 },   // 白8 右下挡
    ],
  },
  {
    name: '瑞星(指)-白4变G7上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },   // 黑3 瑞星指
      { row: 6, col: 7 },   // 白4 G7 上挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 8 },   // 白6 右上斜挡
      { row: 6, col: 6 },   // 黑7 左上斜二
      { row: 8, col: 6 },   // 白8 左下防
    ],
  },
  {
    name: '瑞星(指)-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 8, col: 8 },   // 白4 I6 下方斜挡（强防）
      { row: 6, col: 8 },   // 黑5 右上斜二
      { row: 5, col: 9 },   // 白6 挡
      { row: 8, col: 6 },   // 黑7 左下攻
      { row: 7, col: 5 },   // 白8 左挡
    ],
  },
  {
    name: '瑞星(指)-黑5变H6上攻-白6反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 8 },
      { row: 5, col: 7 },   // 黑5 H6 上方攻
      { row: 6, col: 6 },   // 白6 左上斜挡兼反攻
      { row: 8, col: 8 },   // 黑7 下方斜二
      { row: 9, col: 9 },   // 白8 右下延伸反攻
      { row: 8, col: 6 },   // 黑9
      { row: 4, col: 8 },   // 白10 上方防守
    ],
  },

  // ============================================================
  // 已知开局深度扩展：8-12 手长定式
  // ============================================================

  // ---------- 花月-长定式扩展 ----------
  {
    name: '花月-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 9, col: 9 },
      { row: 5, col: 9 },
      { row: 7, col: 9 },   // 黑7 右挡
      { row: 8, col: 6 },   // 白8 左下反攻
      { row: 10, col: 10 }, // 黑9 延伸
      { row: 7, col: 5 },   // 白10 左攻
    ],
  },
  {
    name: '花月-白4直挡长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 7, col: 8 },
      { row: 6, col: 9 },
      { row: 8, col: 6 },
      { row: 9, col: 5 },   // 黑7 延伸
      { row: 6, col: 5 },   // 白8 左挡
      { row: 5, col: 10 },  // 黑9 右上延伸
      { row: 7, col: 9 },   // 白10 中挡
    ],
  },
  {
    name: '花月-黑3变I7长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },
      { row: 5, col: 5 },
      { row: 9, col: 5 },   // 黑7 左下延伸
      { row: 7, col: 8 },   // 白8 右挡
      { row: 9, col: 8 },   // 黑9
      { row: 6, col: 9 },   // 白10 右上挡
    ],
  },

  // ---------- 浦月-长定式扩展 ----------
  {
    name: '浦月-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 8, col: 7 },
      { row: 9, col: 5 },
      { row: 6, col: 6 },
      { row: 7, col: 5 },   // 黑7 左攻
      { row: 5, col: 6 },   // 白8 上挡
      { row: 10, col: 4 },  // 黑9 延伸
      { row: 8, col: 8 },   // 白10 右下斜防
    ],
  },
  {
    name: '浦月-白4变G7长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 9, col: 5 },
      { row: 7, col: 5 },
      { row: 5, col: 6 },   // 黑7 上攻
      { row: 8, col: 8 },   // 白8 右下斜防
      { row: 10, col: 4 },  // 黑9 延伸
      { row: 7, col: 8 },   // 白10 右挡
    ],
  },

  // ---------- 寒星-长定式扩展 ----------
  {
    name: '寒星-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },
      { row: 6, col: 9 },   // 黑7 右上延伸
      { row: 8, col: 6 },   // 白8 左下斜挡
      { row: 5, col: 8 },   // 黑9 上攻
      { row: 8, col: 9 },   // 白10 右下挡
    ],
  },
  {
    name: '寒星-白4变F6斜防长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 5 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 9, col: 7 },   // 黑7 下方攻
      { row: 5, col: 6 },   // 白8 左上斜挡
      { row: 6, col: 9 },   // 黑9 右上延伸
      { row: 8, col: 5 },   // 白10 左下反攻
      { row: 5, col: 10 },  // 黑11
      { row: 7, col: 5 },   // 白12 左挡
    ],
  },

  // ---------- 疏星-长定式扩展 ----------
  {
    name: '疏星-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 7 },   // 黑7 上方延伸
      { row: 10, col: 7 },  // 白8 下方延伸
      { row: 6, col: 5 },   // 黑9 左上攻
      { row: 9, col: 9 },   // 白10 右下斜防
    ],
  },
  {
    name: '疏星-白4变I6长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },
      { row: 8, col: 6 },
      { row: 5, col: 8 },   // 黑7 右上延伸
      { row: 10, col: 6 },  // 白8 左下延伸
      { row: 6, col: 9 },   // 黑9
      { row: 7, col: 5 },   // 白10 左挡
    ],
  },

  // ---------- 瑞星-长定式扩展 ----------
  {
    name: '瑞星-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 5, col: 5 },   // 黑7 左上延伸
      { row: 9, col: 9 },   // 白8 右下延伸
      { row: 7, col: 5 },   // 黑9 左攻
      { row: 7, col: 9 },   // 白10 右挡
    ],
  },
  {
    name: '瑞星-白4变斜长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 5 },   // 黑7 左上延伸
      { row: 9, col: 9 },   // 白8 右下延伸
      { row: 7, col: 9 },   // 黑9 右攻
      { row: 7, col: 5 },   // 白10 左挡
    ],
  },

  // ---------- 金星-长定式扩展 ----------
  {
    name: '金星-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 6 },
      { row: 8, col: 8 },
      { row: 4, col: 7 },   // 黑7 上方延伸
      { row: 9, col: 9 },   // 白8 右下延伸
      { row: 7, col: 5 },   // 黑9 左攻
      { row: 6, col: 9 },   // 白10 右上挡
    ],
  },
  {
    name: '金星-白4变F7长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },
      { row: 5, col: 6 },
      { row: 8, col: 6 },
      { row: 6, col: 8 },
      { row: 4, col: 8 },   // 黑7 右上延伸
      { row: 8, col: 8 },   // 白8 右下斜挡
      { row: 4, col: 6 },   // 黑9
      { row: 9, col: 5 },   // 白10 左下反攻
    ],
  },

  // ---------- 松月-长定式扩展 ----------
  {
    name: '松月-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 8, col: 6 },
      { row: 5, col: 8 },   // 黑7 右上延伸
      { row: 9, col: 5 },   // 白8 左下延伸
      { row: 5, col: 6 },   // 黑9 左上攻
      { row: 9, col: 9 },   // 白10 右下斜防
    ],
  },
  {
    name: '松月-白4变G8长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },
      { row: 8, col: 6 },
      { row: 5, col: 9 },   // 黑7 右上延伸
      { row: 9, col: 5 },   // 白8 左下延伸
      { row: 5, col: 7 },   // 黑9 上攻
      { row: 7, col: 9 },   // 白10 右挡
    ],
  },

  // ---------- 斜月-长定式扩展 ----------
  {
    name: '斜月-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },
      { row: 9, col: 6 },
      { row: 7, col: 6 },
      { row: 8, col: 5 },   // 黑7 左下延伸
      { row: 7, col: 9 },   // 白8 右挡
      { row: 10, col: 5 },  // 黑9 延伸
      { row: 5, col: 9 },   // 白10 右上斜防
    ],
  },
  {
    name: '斜月-白4变I6长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 7 },
      { row: 5, col: 5 },
      { row: 9, col: 6 },   // 黑7 下方延伸
      { row: 7, col: 8 },   // 白8 右挡
      { row: 10, col: 5 },  // 黑9
      { row: 5, col: 8 },   // 白10 右上斜防
    ],
  },

  // ---------- 名月-长定式扩展 ----------
  {
    name: '名月-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 5 },
      { row: 6, col: 8 },
      { row: 8, col: 8 },
      { row: 8, col: 6 },
      { row: 7, col: 4 },   // 黑7 左延伸
      { row: 5, col: 9 },   // 白8 右上斜挡
      { row: 6, col: 4 },   // 黑9
      { row: 9, col: 9 },   // 白10 右下斜防
    ],
  },
  {
    name: '名月-白4变H6长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 7, col: 4 },   // 黑7 左延伸
      { row: 8, col: 6 },   // 白8 左下斜挡
      { row: 6, col: 4 },   // 黑9
      { row: 9, col: 9 },   // 白10 右下斜防
    ],
  },

  // ---------- 峡月-长定式扩展 ----------
  {
    name: '峡月-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 6, col: 8 },
      { row: 9, col: 5 },
      { row: 8, col: 8 },
      { row: 5, col: 5 },   // 黑7 左上延伸
      { row: 7, col: 9 },   // 白8 右挡
      { row: 5, col: 9 },   // 黑9 右上攻
      { row: 10, col: 4 },  // 白10 左下延伸
    ],
  },
  {
    name: '峡月-白4变H6长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 7, col: 6 },
      { row: 5, col: 5 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },   // 黑7 右上斜二
      { row: 9, col: 7 },   // 白8 下方挡
      { row: 4, col: 4 },   // 黑9 延伸
      { row: 7, col: 9 },   // 白10 右挡
    ],
  },

  // ---------- 溪月-长定式扩展 ----------
  {
    name: '溪月-正变长定式-10手',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 9, col: 6 },
      { row: 10, col: 8 },  // 黑7 右下延伸
      { row: 5, col: 5 },   // 白8 左上延伸
      { row: 10, col: 6 },  // 黑9
      { row: 7, col: 9 },   // 白10 右挡
    ],
  },
  {
    name: '溪月-白4变I8长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },
      { row: 10, col: 6 },  // 黑7 左下延伸
      { row: 5, col: 9 },   // 白8 右上延伸
      { row: 10, col: 8 },  // 黑9
      { row: 7, col: 5 },   // 白10 左挡
    ],
  },

  // ---------- 云月-长定式扩展 ----------
  {
    name: '云月-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 5, col: 5 },
      { row: 9, col: 9 },
      { row: 9, col: 7 },   // 黑7 下方攻
      { row: 5, col: 7 },   // 白8 上方挡
      { row: 4, col: 4 },   // 黑9 延伸
      { row: 7, col: 5 },   // 白10 左挡
    ],
  },

  // ---------- 雨月-长定式扩展 ----------
  {
    name: '雨月-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 9, col: 7 },
      { row: 5, col: 9 },   // 黑7 右上延伸
      { row: 7, col: 5 },   // 白8 左挡
      { row: 5, col: 7 },   // 黑9 上攻
      { row: 10, col: 7 },  // 白10 下挡
    ],
  },

  // ---------- 明星-长定式扩展 ----------
  {
    name: '明星-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },
      { row: 7, col: 5 },   // 黑7 左延伸
      { row: 8, col: 6 },   // 白8 左下斜挡
      { row: 6, col: 9 },   // 黑9 右上延伸
      { row: 5, col: 7 },   // 白10 上挡
    ],
  },
  {
    name: '明星-白4变I6下挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },
      { row: 7, col: 6 },
      { row: 8, col: 7 },   // 白4 下挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 6, col: 8 },   // 白6 右上斜挡
      { row: 8, col: 5 },   // 黑7 左下延伸
      { row: 8, col: 8 },   // 白8 右下斜防
    ],
  },

  // ---------- 彗星-长定式扩展 ----------
  {
    name: '彗星-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 7 },
      { row: 8, col: 6 },
      { row: 5, col: 5 },   // 黑7 左上延伸
      { row: 9, col: 9 },   // 白8 右下延伸
      { row: 4, col: 6 },   // 黑9
      { row: 7, col: 9 },   // 白10 右挡
    ],
  },

  // ---------- 长星-长定式扩展 ----------
  {
    name: '长星-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 5 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 9, col: 9 },
      { row: 4, col: 4 },   // 黑7 延伸
      { row: 7, col: 9 },   // 白8 右挡
      { row: 8, col: 6 },   // 黑9 左下斜二
      { row: 6, col: 7 },   // 白10 上挡
    ],
  },
  {
    name: '长星-白4变J8右防长定式',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 10, col: 7 },
      { row: 9, col: 8 },
      { row: 7, col: 9 },
      { row: 7, col: 5 },
      { row: 6, col: 8 },   // 黑7 右上斜二
      { row: 8, col: 6 },   // 白8 左下斜挡
      { row: 11, col: 7 },  // 黑9 延伸
      { row: 5, col: 9 },   // 白10 右上斜防
    ],
  },

  // ---------- 游星-长定式扩展 ----------
  {
    name: '游星-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 9, col: 5 },
      { row: 8, col: 8 },
      { row: 5, col: 9 },   // 黑7 右上延伸
      { row: 9, col: 7 },   // 白8 下方挡
      { row: 10, col: 4 },  // 黑9 延伸
      { row: 7, col: 9 },   // 白10 右挡
    ],
  },

  // ---------- 丘月-长定式扩展 ----------
  {
    name: '丘月-正变长定式-8手',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 7, col: 5 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 8, col: 8 },
      { row: 7, col: 4 },   // 黑7 左延伸
      { row: 6, col: 8 },   // 白8 右上斜挡
      { row: 6, col: 4 },   // 黑9
      { row: 9, col: 9 },   // 白10 右下斜防
    ],
  },

  // ============================================================
  // 补充开局变化：增加更多黑3变招与白4应对（目标180+）
  // ============================================================

  // ---------- 花月-更多变招 ----------
  {
    name: '花月-白2变I7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 8, col: 8 },   // 黑3 右下斜（花月变）
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 9, col: 9 },   // 黑5 延伸
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '花月-黑3变J7直-白4上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 7 },   // 黑3 下直二（变化）
      { row: 6, col: 7 },   // 白4 上直挡
      { row: 9, col: 8 },   // 黑5 右下斜二
      { row: 5, col: 6 },   // 白6 左上斜防
    ],
  },
  {
    name: '花月-白6变J10右上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 6, col: 8 },
      { row: 9, col: 9 },
      { row: 4, col: 10 },  // 白6 右上方远挡
      { row: 8, col: 6 },   // 黑7 左下攻
      { row: 7, col: 5 },   // 白8 左挡
    ],
  },

  // ---------- 浦月-更多变招 ----------
  {
    name: '浦月-白2变G7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 直止右（变化）
      { row: 6, col: 6 },   // 黑3 左上斜（浦月变）
      { row: 8, col: 8 },   // 白4 右下斜挡
      { row: 5, col: 5 },   // 黑5 延伸
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '浦月-黑3变I6斜-白4上挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 8 },   // 黑3 右下斜（变化）
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 9, col: 9 },   // 黑5 延伸
      { row: 8, col: 6 },   // 白6 左下斜防
    ],
  },

  // ---------- 寒星-更多变招 ----------
  {
    name: '寒星-白2变F7直-黑3直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 右直
      { row: 7, col: 5 },   // 黑3 左跳（寒星变）
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '寒星-黑5变F5左攻-白6斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 7 },
      { row: 6, col: 5 },   // 黑5 F5 左攻
      { row: 8, col: 5 },   // 白6 左下斜挡
      { row: 8, col: 8 },   // 黑7 右下斜二
      { row: 5, col: 6 },   // 白8 左上斜防
    ],
  },
  {
    name: '寒星-白6变J8右挡-长',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 7, col: 9 },
      { row: 6, col: 7 },
      { row: 8, col: 8 },
      { row: 8, col: 9 },   // 白6 右下直挡
      { row: 6, col: 6 },   // 黑7 左上斜二
      { row: 5, col: 8 },   // 白8 右上斜防
      { row: 6, col: 9 },   // 黑9
      { row: 8, col: 6 },   // 白10 左下反攻
    ],
  },

  // ---------- 疏星-更多变招 ----------
  {
    name: '疏星-白2变I7直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 9, col: 7 },   // 黑3 疏星
      { row: 8, col: 6 },   // 白4 左下斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '疏星-黑5变J8右攻-白6反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },   // 黑5 右下斜二（变化）
      { row: 8, col: 6 },   // 白6 左下斜挡
      { row: 10, col: 8 },  // 黑7 延伸
      { row: 5, col: 6 },   // 白8 左上延伸反攻
    ],
  },
  {
    name: '疏星-白8变J9右下延伸',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 7 },
      { row: 10, col: 9 },  // 白8 右下斜延伸（反攻）
      { row: 10, col: 7 },  // 黑9
      { row: 4, col: 5 },   // 白10 左上斜防
    ],
  },

  // ---------- 瑞星-更多变招 ----------
  {
    name: '瑞星-白2变F7直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 右直（变化）
      { row: 8, col: 7 },   // 黑3 下直（瑞星变）
      { row: 6, col: 8 },   // 白4 右上斜挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 8, col: 6 },   // 白6 左下斜防
    ],
  },
  {
    name: '瑞星-黑5变F5上攻-白6斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 8, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 5 },   // 黑5 F5 左上攻
      { row: 8, col: 8 },   // 白6 右下斜挡
      { row: 4, col: 4 },   // 黑7 延伸
      { row: 9, col: 9 },   // 白8 右下延伸防
    ],
  },

  // ---------- 金星-更多变招 ----------
  {
    name: '金星-白2变I7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 5, col: 7 },   // 黑3 金星
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 8, col: 6 },   // 黑5 左下斜二
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '金星-黑5变J6右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 5 },   // 黑5 J6 左攻（变化）
      { row: 4, col: 6 },   // 白6 左上斜挡（强防）
      { row: 8, col: 6 },   // 黑7 左下斜二
      { row: 8, col: 8 },   // 白8 右下斜防
      { row: 4, col: 8 },   // 黑9
      { row: 7, col: 5 },   // 白10 左挡
    ],
  },

  // ---------- 松月-更多变招 ----------
  {
    name: '松月-白2变I8斜-黑3斜-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },   // 白2 右上斜（变化）
      { row: 6, col: 7 },   // 黑3 上直（松月变）
      { row: 8, col: 7 },   // 白4 下直挡
      { row: 5, col: 6 },   // 黑5 左上斜二
      { row: 8, col: 8 },   // 白6 右下斜防
    ],
  },
  {
    name: '松月-黑5变J8右攻-白6反攻',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 8 },   // 黑5 J8 右上攻
      { row: 8, col: 8 },   // 白6 右下斜挡兼反攻
      { row: 4, col: 9 },   // 黑7 延伸
      { row: 9, col: 9 },   // 白8 右下延伸
    ],
  },

  // ---------- 斜月-更多变招 ----------
  {
    name: '斜月-白2变G7直-黑3直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },   // 白2 直指（变化）
      { row: 8, col: 7 },   // 黑3 下直（斜月变）
      { row: 7, col: 6 },   // 白4 左直挡
      { row: 9, col: 6 },   // 黑5 左下斜二
      { row: 7, col: 8 },   // 白6 右挡
    ],
  },
  {
    name: '斜月-黑5变F5左攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },
      { row: 9, col: 8 },   // 黑5 右下攻（变化）
      { row: 5, col: 9 },   // 白6 右上斜挡（强防）
      { row: 9, col: 6 },   // 黑7 左下斜二
      { row: 7, col: 6 },   // 白8 左挡
    ],
  },

  // ---------- 名月-更多变招 ----------
  {
    name: '名月-白2变I6斜-黑3直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },   // 白2 右下斜（变化）
      { row: 7, col: 5 },   // 黑3 名月
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '名月-黑5变F6上攻-白6斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 7, col: 5 },
      { row: 6, col: 8 },
      { row: 5, col: 7 },   // 黑5 H6 上攻（变化）
      { row: 5, col: 6 },   // 白6 左上斜挡
      { row: 8, col: 8 },   // 黑7 右下斜二
      { row: 9, col: 9 },   // 白8 右下延伸
    ],
  },

  // ---------- 峡月-更多变招 ----------
  {
    name: '峡月-白2变G8斜-黑3斜-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },   // 白2 右上斜（变化）
      { row: 6, col: 6 },   // 黑3 左上斜（峡月变）
      { row: 6, col: 7 },   // 白4 上直挡
      { row: 5, col: 5 },   // 黑5 延伸
      { row: 8, col: 8 },   // 白6 右下斜防
    ],
  },
  {
    name: '峡月-黑5变J7右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 6, col: 8 },
      { row: 7, col: 9 },   // 黑5 J7 右攻（变化）
      { row: 5, col: 9 },   // 白6 右上斜挡（强防）
      { row: 9, col: 5 },   // 黑7 左下延伸
      { row: 8, col: 8 },   // 白8 中防
    ],
  },

  // ---------- 溪月-更多变招 ----------
  {
    name: '溪月-白2变G8斜-黑3直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },   // 白2 右上斜（变化）
      { row: 9, col: 7 },   // 黑3 溪月
      { row: 8, col: 8 },   // 白4 右下斜挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 8, col: 6 },   // 白6 左下斜防
    ],
  },
  {
    name: '溪月-黑5变F5上攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 10, col: 6 },  // 黑5 左下延伸（变化）
      { row: 8, col: 8 },   // 白6 右下斜挡（强防）
      { row: 8, col: 5 },   // 黑7 左下斜二
      { row: 5, col: 5 },   // 白8 左上斜防
    ],
  },
  {
    name: '溪月-白6变H5左挡-长',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },
      { row: 9, col: 7 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 7, col: 5 },   // 白6 左挡
      { row: 10, col: 8 },  // 黑7 右下延伸
      { row: 6, col: 5 },   // 白8 左上挡
      { row: 10, col: 6 },  // 黑9
      { row: 5, col: 7 },   // 白10 上挡
    ],
  },

  // ---------- 云月-更多变招 ----------
  {
    name: '云月-白2变I6斜-黑3斜-白4直挡',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 6 },   // 白2 左下斜（变化）
      { row: 6, col: 6 },   // 黑3 左上斜（云月变）
      { row: 7, col: 6 },   // 白4 左直挡
      { row: 5, col: 5 },   // 黑5 延伸
      { row: 8, col: 8 },   // 白6 右下斜防
    ],
  },
  {
    name: '云月-黑5变J7右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 6 },
      { row: 7, col: 5 },   // 黑5 J7 左攻（变化）
      { row: 9, col: 9 },   // 白6 右下斜挡（强防）
      { row: 5, col: 5 },   // 黑7 延伸
      { row: 7, col: 9 },   // 白8 右挡
    ],
  },

  // ---------- 雨月-更多变招 ----------
  {
    name: '雨月-白2变G7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 6, col: 8 },   // 黑3 雨月
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 8, col: 6 },   // 白6 左下斜防
    ],
  },
  {
    name: '雨月-黑5变F5左攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 8, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },
      { row: 5, col: 9 },   // 黑5 F5 右上延伸（变化）
      { row: 9, col: 7 },   // 白6 下挡（强防）
      { row: 4, col: 10 },  // 黑7 延伸
      { row: 8, col: 8 },   // 白8 中防
    ],
  },

  // ---------- 明星-更多变招 ----------
  {
    name: '明星-白2变F7直-黑3直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 左直（变化）
      { row: 7, col: 9 },   // 黑3 右跳（明星变）
      { row: 6, col: 8 },   // 白4 右上斜挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 8, col: 8 },   // 白6 右下斜防
    ],
  },
  {
    name: '明星-黑5变J6下攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },
      { row: 7, col: 6 },
      { row: 6, col: 7 },
      { row: 8, col: 6 },   // 黑5 J6 左下攻（变化）
      { row: 6, col: 6 },   // 白6 左上斜挡（强防）
      { row: 8, col: 8 },   // 黑7 右下斜二
      { row: 5, col: 8 },   // 白8 右上斜防
    ],
  },

  // ---------- 彗星-更多变招 ----------
  {
    name: '彗星-白2变I7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 直止（变化）
      { row: 8, col: 6 },   // 黑3 左下斜（彗星变）
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '彗星-黑5变J7右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 6, col: 6 },
      { row: 8, col: 8 },
      { row: 5, col: 7 },   // 黑5 H6 上攻（变化）
      { row: 8, col: 6 },   // 白6 左下斜挡（强防）
      { row: 4, col: 6 },   // 黑7 延伸
      { row: 7, col: 9 },   // 白8 右挡
    ],
  },

  // ---------- 长星-更多变招 ----------
  {
    name: '长星-白2变F7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 5, col: 5 },   // 黑3 长星
      { row: 6, col: 6 },   // 白4 斜挡
      { row: 8, col: 8 },   // 黑5 右下斜二
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '长星-黑5变J6右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 6 },
      { row: 5, col: 5 },
      { row: 8, col: 8 },
      { row: 9, col: 7 },   // 黑5 J6 右攻（变化）
      { row: 6, col: 8 },   // 白6 右上斜挡（强防）
      { row: 4, col: 4 },   // 黑7 延伸
      { row: 9, col: 9 },   // 白8 右下延伸防
    ],
  },

  // ---------- 游星-更多变招 ----------
  {
    name: '游星-白2变G7直-黑3斜-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 6 },   // 白2 直止（变化）
      { row: 8, col: 6 },   // 黑3 左下斜（游星变）
      { row: 6, col: 6 },   // 白4 左上斜挡
      { row: 9, col: 5 },   // 黑5 延伸
      { row: 6, col: 8 },   // 白6 右上斜防
    ],
  },
  {
    name: '游星-黑5变F6上攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 8 },
      { row: 8, col: 6 },
      { row: 6, col: 6 },
      { row: 5, col: 7 },   // 黑5 H6 上攻（变化）
      { row: 8, col: 8 },   // 白6 右下斜挡（强防）
      { row: 9, col: 5 },   // 黑7 延伸
      { row: 7, col: 9 },   // 白8 右挡
    ],
  },

  // ---------- 丘月-更多变招 ----------
  {
    name: '丘月-白2变F7直-黑3直-白4斜挡',
    moves: [
      { row: 7, col: 7 },
      { row: 7, col: 8 },   // 白2 右直（变化）
      { row: 7, col: 5 },   // 黑3 丘月
      { row: 6, col: 8 },   // 白4 右上斜挡
      { row: 6, col: 6 },   // 黑5 左上斜二
      { row: 8, col: 6 },   // 白6 左下斜防
    ],
  },
  {
    name: '丘月-黑5变J7右攻-白6强防',
    moves: [
      { row: 7, col: 7 },
      { row: 6, col: 7 },
      { row: 7, col: 5 },
      { row: 6, col: 6 },
      { row: 7, col: 9 },   // 黑5 J7 右攻（变化）
      { row: 8, col: 8 },   // 白6 右下斜挡（强防）
      { row: 6, col: 4 },   // 黑7 左延伸
      { row: 6, col: 8 },   // 白8 右上斜防
    ],
  },
];

// ============================================================
// 核心函数
// ============================================================

/**
 * 生成局面的开局库 key（前 moveCount 步）。
 * 格式: "b7,7;w6,6;b8,8"  （b=黑, w=白，按落子顺序）
 */
function buildOpeningKey(moveHistory: MoveWithPlayer[], moveCount: number): string {
  const len = Math.min(moveCount, moveHistory.length);
  const parts: string[] = [];
  for (let i = 0; i < len; i += 1) {
    const m: MoveWithPlayer = moveHistory[i];
    const prefix = m.player === 'black' ? 'b' : 'w';
    parts.push(`${prefix}${m.row},${m.col}`);
  }
  return parts.join(';');
}

/**
 * 将开局线转换为 key 前缀（前 matchLen 步）。
 * 颜色交替：偶数索引=黑，奇数索引=白
 */
function buildLineKeyPrefix(line: OpeningLine, matchLen: number): string {
  const parts: string[] = [];
  for (let i = 0; i < matchLen && i < line.moves.length; i += 1) {
    const m: Move = line.moves[i];
    const prefix = i % 2 === 0 ? 'b' : 'w';
    parts.push(`${prefix}${m.row},${m.col}`);
  }
  return parts.join(';');
}

/**
 * 验证开局线的所有走法是否都在棋盘内。
 */
function validateLine(line: OpeningLine): boolean {
  return line.moves.every((m: Move) => isInside(m.row, m.col));
}

/**
 * 根据开局线名称推断白棋防守优先级。
 * 正变/强防/主流走法优先级高，变招/弱防优先级低。
 * 匹配时优先选优先级高的，同级选更长的。
 */
function getLinePriority(name: string): number {
  // 正变/主变 = 最高优先级（白棋最优防守）
  if (name.includes('正变')) return 10;
  // 强防 = 很高优先级
  if (name.includes('强防')) return 9;
  // 直挡/斜挡 = 主流防守
  if (name.includes('直挡') || name.includes('斜挡')) return 8;
  // 白4变 + 反攻/反击 = 积极防守
  if (name.includes('反攻') || name.includes('反击')) return 7;
  // 白2变/白4变/白6变的普通变招
  if (name.includes('白2变') || name.includes('白4变') || name.includes('白6变')) return 5;
  // 黑3变/黑5变/黑7变 = 对方变招后的应对
  if (name.includes('黑3变') || name.includes('黑5变') || name.includes('黑7变')) return 6;
  // 长定式/扩展 = 基于正变的延伸
  if (name.includes('长定式') || name.includes('扩展')) return 7;
  // 默认中等优先级
  return 5;
}

/**
 * 查询开局库，返回推荐走法（下一步）。
 *
 * 查询逻辑：
 * 1. 如果 moveHistory 长度 >= 12（即6回合后），返回 null（开局结束）
 * 2. 遍历所有 OPENING_LINES，找到所有前 len 步与历史完全匹配的开局线
 * 3. 从匹配的线中取下一步走法
 * 4. 如果有多条匹配，优先选优先级高的（正变>强防>变招），同级选更长的
 * 5. 如果没有匹配，返回 null
 */
export function queryOpening(moveHistory: MoveWithPlayer[]): Move | null {
  if (moveHistory.length >= OPENING_MAX_MOVES) return null;
  if (moveHistory.length === 0) return null;

  const currentKey: string = buildOpeningKey(moveHistory, moveHistory.length);
  const matchLen: number = moveHistory.length;

  let bestLine: OpeningLine | null = null;
  let bestPriority: number = -1;
  let bestLength: number = -1;

  for (const line of OPENING_LINES) {
    if (line.moves.length <= matchLen) continue;
    if (!validateLine(line)) continue;

    const linePrefix: string = buildLineKeyPrefix(line, matchLen);
    if (linePrefix === currentKey) {
      const priority = getLinePriority(line.name);
      // 优先级高的优先；同级则更长的优先
      if (priority > bestPriority ||
          (priority === bestPriority && line.moves.length > bestLength)) {
        bestPriority = priority;
        bestLength = line.moves.length;
        bestLine = line;
      }
    }
  }

  if (bestLine === null) return null;

  const nextMove: Move = bestLine.moves[matchLen];
  if (!isInside(nextMove.row, nextMove.col)) return null;
  return nextMove;
}

/**
 * 获取开局库总数（对外暴露便于测试/调试）。
 */
export function getOpeningLineCount(): number {
  return OPENING_LINES.length;
}

/**
 * 根据历史记录返回匹配的开局名称列表（调试用）。
 */
export function getMatchingOpeningNames(moveHistory: MoveWithPlayer[]): string[] {
  if (moveHistory.length === 0) return [];
  const matchLen: number = moveHistory.length;
  const currentKey: string = buildOpeningKey(moveHistory, matchLen);

  const names: string[] = [];
  for (const line of OPENING_LINES) {
    if (line.moves.length < matchLen) continue;
    const linePrefix: string = buildLineKeyPrefix(line, matchLen);
    if (linePrefix === currentKey) {
      names.push(line.name);
    }
  }
  return names;
}

// 导出常量，供外部引用
export const OPENING_MAX_MOVES = 12;
export const OPENING_BOARD_SIZE = BOARD_SIZE;
