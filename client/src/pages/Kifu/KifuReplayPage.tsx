import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  ArrowLeft,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  Clock,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Slider } from '@client/src/components/ui/slider';
import { Switch } from '@client/src/components/ui/switch';
import GomokuBoard from '@client/src/components/GomokuBoard';
import { ThemeToggle } from '@client/src/components/ui/theme-toggle';
import {
  getKifuById,
  buildBoardFromMoves,
  checkWinFromMoves,
  movesToSgf,
  type KifuRecord,
  type KifuMove,
} from '@client/src/utils/kifu';
import type { Move, PlayerColor } from '@shared/api.interface';

type PlaySpeed = 'slow' | 'normal' | 'fast';

const SPEED_MAP: Record<PlaySpeed, number> = {
  slow: 1500,
  normal: 800,
  fast: 300,
};

const speedLabels: Record<PlaySpeed, string> = {
  slow: '慢',
  normal: '中',
  fast: '快',
};

function coordLabel(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${15 - row}`;
}

const KifuReplayPage: React.FC = () => {
  const { kifuId } = useParams<{ kifuId: string }>();
  const navigate = useNavigate();
  const [kifu, setKifu] = useState<KifuRecord | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>('normal');
  const [showCoords, setShowCoords] = useState(true);
  const playTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!kifuId) {
      navigate('/kifu');
      return;
    }
    const record = getKifuById(kifuId);
    if (!record) {
      toast.error('棋谱不存在');
      navigate('/kifu');
      return;
    }
    setKifu(record);
    setCurrentStep(record.moveCount);
  }, [kifuId, navigate]);

  useEffect(() => {
    if (isPlaying && kifu && currentStep < kifu.moveCount) {
      playTimerRef.current = window.setTimeout(() => {
        setCurrentStep((prev) => {
          if (prev + 1 >= (kifu?.moveCount || 0)) {
            setIsPlaying(false);
            return prev + 1;
          }
          return prev + 1;
        });
      }, SPEED_MAP[speed]);
    }
    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, currentStep, speed, kifu]);

  const handleStep = useCallback(
    (delta: number) => {
      if (!kifu) return;
      setCurrentStep((prev) => {
        const next = Math.max(0, Math.min(kifu.moveCount, prev + delta));
        return next;
      });
    },
    [kifu],
  );

  const handleSliderChange = (value: number[]) => {
    if (!kifu) return;
    setCurrentStep(value[0]);
  };

  const handlePlayToggle = () => {
    if (!kifu) return;
    if (currentStep >= kifu.moveCount) {
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handleExport = () => {
    if (!kifu) return;
    const sgf = movesToSgf(kifu);
    navigator.clipboard.writeText(sgf).then(() => {
      toast.success('棋谱已复制到剪贴板');
    }).catch(() => {
      const blob = new Blob([sgf], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kifu.name}.sgf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('棋谱已下载');
    });
  };

  if (!kifu) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const board = buildBoardFromMoves(kifu.moves, currentStep);
  const currentMove: KifuMove | null =
    currentStep > 0 && currentStep <= kifu.moves.length
      ? kifu.moves[currentStep - 1]
      : null;
  const lastMove: Move | null = currentMove
    ? { row: currentMove.row, col: currentMove.col }
    : null;

  const winInfo = currentStep > 0
    ? checkWinFromMoves(kifu.moves, currentStep - 1)
    : null;
  const winningLine: Move[] | null = winInfo ? winInfo.line : null;

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
              onClick={() => navigate('/kifu')}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-[300px]">
                {kifu.name}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  共 {kifu.moveCount} 手
                </span>
                <span className="text-xs text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">
                  {kifu.result === 'black'
                    ? '黑胜'
                    : kifu.result === 'white'
                      ? '白胜'
                      : kifu.result === 'draw'
                        ? '平局'
                        : '未结束'}
                </span>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex justify-center px-6 sm:px-10">
          <GomokuBoard
            board={board}
            lastMove={lastMove}
            winningLine={winningLine}
            onCellClick={() => {}}
            disabled
            showCoordinates={showCoords}
          />
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {currentStep === 0 ? '开局' : `第 ${currentStep} 手`}
              </p>
              {currentMove && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {currentMove.player === 'black' ? '黑方' : '白方'} ·{' '}
                  {coordLabel(currentMove.row, currentMove.col)}
                </p>
              )}
              {currentStep === 0 && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  点击播放查看对局
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">坐标</span>
              <Switch
                checked={showCoords}
                onCheckedChange={setShowCoords}
              />
            </div>
          </div>

          <div className="px-2">
            <Slider
              value={[currentStep]}
              min={0}
              max={kifu.moveCount}
              step={1}
              onValueChange={handleSliderChange}
              className="cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={handleReset}
              className="rounded-xl border-border"
              title="回到开局"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => handleStep(-1)}
              disabled={currentStep <= 0}
              className="rounded-xl border-border"
              title="上一步"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              onClick={handlePlayToggle}
              size="icon"
              className="w-12 h-12 rounded-xl bg-primary text-primary-foreground"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => handleStep(1)}
              disabled={currentStep >= kifu.moveCount}
              className="rounded-xl border-border"
              title="下一步"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <div className="flex items-center bg-secondary/50 rounded-xl p-0.5">
              {(['slow', 'normal', 'fast'] as PlaySpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    speed === s
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {speedLabels[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="flex-1 h-10 rounded-xl border-border"
              onClick={handleExport}
            >
              <Download className="w-4 h-4" />
              导出 SGF
            </Button>
            <Button
              variant="secondary"
              className="flex-1 h-10 rounded-xl border-border"
              onClick={() => {
                toast.info('分享功能即将上线');
              }}
            >
              <Share2 className="w-4 h-4" />
              分享
            </Button>
          </div>
        </div>

        <div className="bg-card/50 border border-border/40 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            对局信息
          </h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">模式</span>
            <span className="text-foreground text-right">
              {kifu.mode === 'solo'
                ? '单人模式'
                : kifu.mode === 'online'
                  ? '联机对战'
                  : kifu.mode === 'practice'
                    ? '双人练习'
                    : '自由摆盘'}
            </span>
            <span className="text-muted-foreground">黑方</span>
            <span className="text-foreground text-right">
              {kifu.blackPlayer || '黑方'}
            </span>
            <span className="text-muted-foreground">白方</span>
            <span className="text-foreground text-right">
              {kifu.whitePlayer || '白方'}
            </span>
            <span className="text-muted-foreground">总手数</span>
            <span className="text-foreground text-right">{kifu.moveCount} 手</span>
            <span className="text-muted-foreground">保存时间</span>
            <span className="text-foreground text-right">
              {new Date(kifu.createdAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default KifuReplayPage;
