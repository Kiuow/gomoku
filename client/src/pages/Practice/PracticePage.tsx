import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  ArrowLeft,
  RotateCcw,
  Undo2,
  Users,
  LayoutGrid,
  Save,
  Lightbulb,
  TrendingUp,
  CircleDot,
  Circle,
  Info,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Switch } from '@client/src/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import GomokuBoard from '@client/src/components/GomokuBoard';
import GameEndDialog from '@client/src/pages/Room/GameEndDialog';
import { ThemeToggle } from '@client/src/components/ui/theme-toggle';
import {
  saveKifu,
  generateDefaultName,
  isKifuFull,
  type KifuMove,
  type GameResult,
} from '@client/src/utils/kifu';
import type { Move, PlayerColor, AiHintResponse } from '@shared/api.interface';
import { gomoku } from '@client/src/api';

type PracticeMode = 'dual' | 'free';

function createEmptyBoard(): string[][] {
  return Array.from({ length: 15 }, () => Array(15).fill(''));
}

function checkWin(
  board: string[][],
  row: number,
  col: number,
  player: string,
): Move[] | null {
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
    if (line.length >= 5) return line;
  }
  return null;
}

const PracticePage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<PracticeMode>('dual');
  const [board, setBoard] = useState<string[][]>(createEmptyBoard());
  const [currentPlayer, setCurrentPlayer] = useState<PlayerColor>('black');
  const [freeColor, setFreeColor] = useState<PlayerColor>('black');
  const [moves, setMoves] = useState<KifuMove[]>([]);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [winningLine, setWinningLine] = useState<Move[] | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [kifuName, setKifuName] = useState('');
  const [showCoords, setShowCoords] = useState(true);
  const [showHint, setShowHint] = useState<Move | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (winner) return;

      if (mode === 'dual') {
        if (board[row][col]) return;
        const newBoard = board.map((r: string[]) => [...r]);
        newBoard[row][col] = currentPlayer;
        const winLine = checkWin(newBoard, row, col, currentPlayer);
        setBoard(newBoard);
        setMoves((prev) => [...prev, { row, col, player: currentPlayer }]);
        if (winLine) {
          setWinner(currentPlayer);
          setWinningLine(winLine);
          setShowEndDialog(true);
        } else {
          setCurrentPlayer(currentPlayer === 'black' ? 'white' : 'black');
        }
        setShowHint(null);
      } else {
        const newBoard = board.map((r: string[]) => [...r]);
        if (newBoard[row][col]) {
          newBoard[row][col] = '';
          setMoves((prev) => prev.filter((m) => !(m.row === row && m.col === col)));
        } else {
          newBoard[row][col] = freeColor;
          setMoves((prev) => [...prev, { row, col, player: freeColor }]);
        }
        setBoard(newBoard);
        setWinner(null);
        setWinningLine(null);
        setShowHint(null);
      }
    },
    [board, currentPlayer, freeColor, mode, winner],
  );

  const handleUndo = () => {
    if (moves.length === 0) return;
    const newMoves = moves.slice(0, -1);
    const newBoard = createEmptyBoard();
    for (const m of newMoves) {
      newBoard[m.row][m.col] = m.player;
    }
    setBoard(newBoard);
    setMoves(newMoves);
    setWinner(null);
    setWinningLine(null);
    setShowHint(null);
    if (mode === 'dual') {
      setCurrentPlayer(moves[moves.length - 1].player);
    }
  };

  const handleReset = () => {
    setBoard(createEmptyBoard());
    setMoves([]);
    setCurrentPlayer('black');
    setWinner(null);
    setWinningLine(null);
    setShowHint(null);
    setShowEndDialog(false);
  };

  const handleModeChange = (newMode: PracticeMode) => {
    if (newMode === mode) return;
    if (moves.length > 0) {
      setBoard(createEmptyBoard());
      setMoves([]);
      setWinner(null);
      setWinningLine(null);
      setShowHint(null);
    }
    setCurrentPlayer('black');
    setMode(newMode);
    setShowEndDialog(false);
  };

  const handleHint = async () => {
    setHintLoading(true);
    setShowHint(null);
    try {
      const boardStr = JSON.stringify(board);
      const res: AiHintResponse = await gomoku.gomokuApi.analyzeBoard({
        board: boardStr,
        currentPlayer,
      });
      if (res.valid && res.hint) {
        setShowHint(res.hint);
      } else {
        toast.error('无法获取AI建议');
      }
    } catch (error: unknown) {
      logger.error('获取AI建议失败', error);
      toast.error('获取AI建议失败');
    } finally {
      setHintLoading(false);
    }
  };

  const handleSave = () => {
    if (isKifuFull()) {
      toast.error('棋谱已达上限，请先清理旧棋谱');
      return;
    }
    const result: GameResult = winner ? winner : moves.length === 225 ? 'draw' : 'unknown';
    setKifuName(
      generateDefaultName(mode === 'dual' ? 'practice' : 'free', result),
    );
    setShowSaveDialog(true);
  };

  const confirmSave = () => {
    if (!kifuName.trim()) {
      toast.error('请输入棋谱名称');
      return;
    }
    const result: GameResult = winner ? winner : moves.length === 225 ? 'draw' : 'unknown';
    const record = saveKifu({
      name: kifuName.trim(),
      mode: mode === 'dual' ? 'practice' : 'free',
      result,
      moves,
      moveCount: moves.length,
      blackPlayer: mode === 'dual' ? '玩家1' : '摆棋',
      whitePlayer: mode === 'dual' ? '玩家2' : '摆棋',
    });
    setShowSaveDialog(false);
    toast.success('棋谱已保存');
    navigate(`/kifu/${record.id}`);
  };

  const lastMove: Move | null =
    moves.length > 0 ? { row: moves[moves.length - 1].row, col: moves[moves.length - 1].col } : null;

  return (
    <div className="min-h-screen w-full p-4 sm:p-6 pb-10 bg-background text-foreground">
      <motion.div
        className="w-full max-w-xl mx-auto space-y-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold tracking-tight">练习模式</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-1">
          <button
            type="button"
            onClick={() => handleModeChange('dual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mode === 'dual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            双人练习
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('free')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mode === 'free'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            自由摆盘
          </button>
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            {mode === 'dual' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">当前：</span>
                <div
                  className="w-5 h-5 rounded-full"
                  style={{
                    background:
                      currentPlayer === 'black'
                        ? 'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)'
                        : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
                <span className="text-sm font-medium text-foreground">
                  {currentPlayer === 'black' ? '黑方' : '白方'}落子
                </span>
                {winner && (
                  <Badge
                    variant="default"
                    className="ml-2 bg-[hsl(var(--color-gold))] text-white"
                  >
                    {winner === 'black' ? '黑胜' : '白胜'}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">摆盘颜色：</span>
                <div className="flex items-center gap-1.5 bg-secondary/50 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setFreeColor('black')}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      freeColor === 'black'
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : ''
                    }`}
                    title="摆黑棋"
                  >
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)',
                      }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreeColor('white')}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      freeColor === 'white'
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : ''
                    }`}
                    title="摆白棋"
                  >
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                    />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">坐标</span>
              <Switch checked={showCoords} onCheckedChange={setShowCoords} />
            </div>
          </div>

          <div className="flex justify-center px-3 sm:px-6">
            <GomokuBoard
              board={board}
              lastMove={lastMove}
              winningLine={winningLine}
              onCellClick={handleCellClick}
              disabled={false}
              currentPlayer={mode === 'dual' ? currentPlayer : freeColor}
              hintMove={showHint}
              showCoordinates={showCoords}
              allowOccupiedClick={mode === 'free'}
            />
          </div>

          <div className={`flex items-center justify-center gap-2 text-xs text-muted-foreground ${showCoords ? 'mt-9' : 'mt-3'}`}>
            <Info className="w-3.5 h-3.5" />
            <span>
              {mode === 'dual'
                ? '双人轮流落子，黑先白后'
                : '点击空位摆子，点击已有棋子可移除'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="secondary"
            onClick={handleUndo}
            disabled={moves.length === 0}
            className="h-11 rounded-xl border-border"
          >
            <Undo2 className="w-4 h-4" />
            <span className="sm:inline hidden">悔棋</span>
          </Button>
          <Button
            variant="secondary"
            onClick={handleHint}
            disabled={hintLoading || winner !== null}
            className="h-11 rounded-xl border-border"
          >
            <Lightbulb className="w-4 h-4" />
            <span className="sm:inline hidden">AI提示</span>
          </Button>
          <Button
            variant="secondary"
            onClick={handleReset}
            className="h-11 rounded-xl border-border"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="sm:inline hidden">重开</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={moves.length === 0}
            className="h-11 rounded-xl bg-primary text-primary-foreground"
          >
            <Save className="w-4 h-4" />
            <span className="sm:inline hidden">保存</span>
          </Button>
        </div>

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>已下 {moves.length} 手</span>
          <span>点击首页查看棋谱</span>
        </div>
      </motion.div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm rounded-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">保存棋谱</DialogTitle>
            <DialogDescription className="text-sm">
              输入棋谱名称，保存后可在棋谱列表中查看
            </DialogDescription>
          </DialogHeader>
          <Input
            value={kifuName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setKifuName(e.target.value)
            }
            placeholder="棋谱名称"
            maxLength={50}
            className="h-11 rounded-xl bg-input border-input"
          />
          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => setShowSaveDialog(false)}
              className="flex-1 rounded-xl border-border"
            >
              取消
            </Button>
            <Button
              onClick={confirmSave}
              disabled={!kifuName.trim()}
              className="flex-1 rounded-xl bg-primary text-primary-foreground"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GameEndDialog
        open={showEndDialog}
        winner={winner}
        myColor={null}
        onRestart={handleReset}
        onLeave={() => navigate('/')}
        onClose={() => setShowEndDialog(false)}
      />
    </div>
  );
};

export default PracticePage;
