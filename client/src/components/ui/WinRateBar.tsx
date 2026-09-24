import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type { WinRateInfo } from '@shared/api.interface';

interface WinRateBarProps {
  winRate: WinRateInfo | null;
  loading?: boolean;
  compact?: boolean;
}

function levelBadgeClass(level: WinRateInfo['level'], advantage: WinRateInfo['advantage']): string {
  if (advantage === 'balanced') {
    return 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30';
  }
  const strong = level === 'winning' || level === 'losing';
  const big = level === 'big_advantage' || level === 'big_disadvantage';
  if (advantage === 'black') {
    if (strong) return 'bg-gray-900/20 text-gray-900 dark:text-gray-100 border-gray-900/40';
    if (big) return 'bg-gray-700/15 text-gray-800 dark:text-gray-200 border-gray-700/30';
    return 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/25';
  }
  // white advantage
  if (strong) return 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40';
  if (big) return 'bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30';
  return 'bg-amber-300/10 text-amber-600 dark:text-amber-400 border-amber-300/25';
}

export function WinRateBar({ winRate, loading, compact = false }: WinRateBarProps) {
  if (loading) {
    return (
      <div className={`space-y-${compact ? '2' : '3'}`}>
        <div className="flex items-center gap-2">
          <TrendingUp className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-muted-foreground`} />
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>胜率预测</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted animate-pulse" />
        {!compact && (
          <div className="flex justify-between text-xs text-muted-foreground/70">
            <span>黑方</span>
            <span>白方</span>
          </div>
        )}
      </div>
    );
  }

  if (!winRate) {
    return (
      <div className={`space-y-${compact ? '2' : '3'}`}>
        <div className="flex items-center gap-2">
          <TrendingUp className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-muted-foreground`} />
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>胜率预测</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted" />
        {!compact && (
          <div className="flex justify-between text-xs text-muted-foreground/70">
            <span>黑方</span>
            <span>白方</span>
          </div>
        )}
      </div>
    );
  }

  const blackPct = Math.max(0, Math.min(100, winRate.black));
  const drawPct = Math.max(0, Math.min(100, winRate.draw));
  const whitePct = Math.max(0, Math.min(100, winRate.white));

  const total = blackPct + drawPct + whitePct;
  if (total <= 0) {
    logger.warn('WinRateBar: total win rate is zero, skipping render');
    return null;
  }

  const blackWidth = (blackPct / total) * 100;
  const drawWidth = (drawPct / total) * 100;
  const whiteWidth = (whitePct / total) * 100;

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>胜率预测</span>
        </div>
        {winRate.description && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${levelBadgeClass(
              winRate.level,
              winRate.advantage,
            )}`}
          >
            {winRate.description}
          </span>
        )}
      </div>

      <div className="relative h-2.5 rounded-full overflow-hidden bg-muted">
        <div className="absolute inset-0 flex">
          <motion.div
            key={`black-${blackPct}`}
            initial={{ width: 0 }}
            animate={{ width: `${blackWidth}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-l-full"
            style={{ background: 'linear-gradient(90deg, #1a1a1a, #3a3a3a)' }}
          />
          <motion.div
            key={`draw-${drawPct}`}
            initial={{ width: 0 }}
            animate={{ width: `${drawWidth}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
            className="h-full"
            style={{ background: 'linear-gradient(90deg, #d4b878, #c9a227)' }}
          />
          <motion.div
            key={`white-${whitePct}`}
            initial={{ width: 0 }}
            animate={{ width: `${whiteWidth}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
            className="h-full rounded-r-full"
            style={{ background: 'linear-gradient(90deg, #e8e0d0, #faf6f0)' }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ background: 'radial-gradient(circle at 30% 30%, #4a4a4a, #1a1a1a 70%)' }}
          />
          黑方 {blackPct.toFixed(1)}%
        </span>
        {!compact && <span className="text-[10px]">{drawPct.toFixed(1)}% 平</span>}
        <span className="flex items-center gap-1.5">
          白方 {whitePct.toFixed(1)}%
          <span
            className="w-2.5 h-2.5 rounded-full inline-block border border-border"
            style={{ background: 'radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0 70%)' }}
          />
        </span>
      </div>
    </div>
  );
}

export default WinRateBar;
