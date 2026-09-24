import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@client/src/components/ui/button';
import { gomoku } from '@client/src/api';
import type { PlayerColor, AiDifficulty } from '@shared/api.interface';

const PLAYER_ID_KEY = 'gomoku_player_id';

function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

const DIFFICULTIES: Array<{ value: AiDifficulty; title: string; desc: string }> = [
  { value: 'easy', title: '简单', desc: '轻松入门' },
  { value: 'normal', title: '普通', desc: '步步为营' },
  { value: 'hard', title: '困难', desc: '运筹帷幄' },
  { value: 'hell', title: '地狱', desc: '算无遗策' },
];

const difficultyColor: Record<AiDifficulty, string> = {
  easy: 'var(--difficulty-easy)',
  normal: 'var(--difficulty-normal)',
  hard: 'var(--difficulty-hard)',
  hell: 'var(--difficulty-hell)',
  godlike: 'var(--difficulty-hell)',
};

const SoloSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [playerColor, setPlayerColor] = useState<PlayerColor>('black');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('hard');
  const [creating, setCreating] = useState(false);

  const handleStart = async () => {
    setCreating(true);
    try {
      const playerId = getPlayerId();
      const res = await gomoku.gomokuApi.createSoloGame({
        playerId,
        playerColor,
        difficulty,
      });
      toast.success('单人模式已开始');
      navigate(`/solo/${res.room.roomCode}`);
    } catch (error: unknown) {
      logger.error('创建单人游戏失败', error);
      toast.error('创建单人游戏失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const pieces: Array<{ color: PlayerColor; label: string; sub: string }> = [
    { color: 'black', label: '黑棋', sub: '先手' },
    { color: 'white', label: '白棋', sub: '后手' },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-background">
      <motion.div
        className="w-full max-w-xl space-y-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl"
            onClick={() => navigate('/')}
            aria-label="返回首页"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">单人对弈</h1>
            <p className="text-sm text-muted-foreground">选择棋子与难度</p>
          </div>
        </div>

        {/* Settings card */}
        <motion.div
          className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-6 shadow-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        >
          {/* Color selection */}
          <div className="space-y-5 mb-6">
            <p className="text-xs text-muted-foreground/70 font-medium text-center">选择执子颜色</p>
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {pieces.map((p, idx) => {
                const isActive = playerColor === p.color;
                return (
                  <div key={p.color} className="flex items-center gap-6 sm:gap-10">
                    {idx === 1 && (
                       <div className="text-lg font-bold text-muted-foreground select-none">
                        VS
                      </div>
                    )}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPlayerColor(p.color)}
                      className="flex flex-col items-center gap-3 group"
                    >
                      <div
                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-300 ${
                           isActive
                            ? 'ring-[3px] ring-[color:hsl(var(--color-gold))] ring-offset-2 ring-offset-background scale-105'
                            : 'opacity-70 group-hover:opacity-100 group-hover:scale-105'
                        }`}
                        style={{
                          background:
                            p.color === 'black'
                              ? 'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)'
                              : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
                          boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
                        }}
                      />
                      <div className="text-center space-y-0.5">
                        <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {p.label}
                        </p>
                        <p className="text-xs text-muted-foreground/70">{p.sub}</p>
                      </div>
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
           <div className="h-px bg-border/50 mx-2 mb-6" />

          {/* Difficulty selection */}
          <div className="space-y-4 mb-6">
              <p className="text-xs text-muted-foreground/70 font-medium text-center">AI 难度</p>
            <div className="grid grid-cols-2 gap-3">
              {DIFFICULTIES.map((diff) => {
                const isActive = difficulty === diff.value;
                return (
                  <motion.button
                    key={diff.value}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setDifficulty(diff.value)}
                    className="relative p-4 rounded-xl border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                    style={{
                      borderColor: isActive ? difficultyColor[diff.value] : 'var(--border)',
                      backgroundColor: isActive
                        ? `color-mix(in srgb, ${difficultyColor[diff.value]} 12%, var(--card))`
                        : 'var(--background)',
                    }}
                  >
                      <p className="text-base font-semibold" style={{ color: difficultyColor[diff.value] }}>
                        {diff.title}
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        {diff.desc}
                      </p>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Start button */}
          <motion.div whileTap={{ scale: 0.98 }} transition={{ duration: 0.1 }}>
            <Button
                className="w-full text-base font-medium h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-md shadow-primary/20"
              size="lg"
              onClick={handleStart}
              disabled={creating}
            >
              {creating ? '开始中...' : '开始对弈'}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default SoloSetupPage;
