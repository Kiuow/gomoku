import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { RotateCcw, ArrowLeft, Trophy, Frown, Handshake, Save } from 'lucide-react';
import type { PlayerColor } from '@shared/api.interface';

interface GameEndDialogProps {
  open: boolean;
  winner: PlayerColor | null;
  myColor: PlayerColor | null;
  onRestart: () => void;
  onLeave: () => void;
  onClose: () => void;
  onSaveKifu?: () => void;
}

export function GameEndDialog({
  open,
  winner,
  myColor,
  onRestart,
  onLeave,
  onClose,
  onSaveKifu,
}: GameEndDialogProps) {
  const isDraw = !winner;
  const isWin = winner && winner === myColor;
  const isLose = winner && winner !== myColor;

  const resultText = isDraw
    ? '平局'
    : winner === 'black'
      ? '黑方获胜'
      : '白方获胜';

  const subText = isDraw
    ? '势均力敌，难分高下'
    : isWin
      ? '恭喜你赢得了本局！'
      : '再接再厉，下局加油！';

  const Icon = isDraw ? Handshake : isWin ? Trophy : Frown;

  const iconContainerStyle = isWin
    ? {
        background:
          'linear-gradient(135deg, #e8c44a 0%, #c9a227 50%, #a8831f 100%)',
        boxShadow: '0 8px 24px rgba(201, 162, 39, 0.35)',
      }
    : isDraw
      ? {
          backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, transparent)',
          boxShadow: '0 4px 12px hsla(46, 68%, 47%, 0.15)',
        }
      : {
          backgroundColor: 'var(--muted)',
          boxShadow: '0 4px 12px hsla(220, 8%, 10%, 0.1)',
        };

  const iconColor = isWin
    ? '#ffffff'
    : isDraw
    ? 'var(--color-gold)'
    : 'var(--muted-foreground)';

  const resultColor = isWin
    ? 'var(--color-gold)'
    : isDraw
      ? 'var(--muted-foreground)'
      : 'var(--muted-foreground)';

  return (
    <Dialog open={open} onOpenChange={(openVal: boolean) => {
      if (!openVal) onClose();
    }}>
      <DialogContent
        className="w-[min(92vw,28rem)] border-border p-0 overflow-hidden rounded-2xl bg-background"
        showCloseButton={false}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="p-6 sm:p-8"
        >
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={iconContainerStyle}
              >
                <Icon
                  className="w-10 h-10"
                  style={{ color: iconColor }}
                />
              </div>
            </div>
            <DialogTitle
              className="text-center text-xl font-semibold text-foreground"
            >
              游戏结束
            </DialogTitle>
            <div className="text-center pt-3 space-y-2">
              <p
                className="text-2xl font-bold tracking-tight"
                style={{ color: resultColor, textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              >
                {resultText}
              </p>
              <p className="text-sm text-muted-foreground">
                {subText}
              </p>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-6">
            {onSaveKifu && (
              <Button
                variant="outline"
                onClick={onSaveKifu}
                className="col-span-2 w-full min-h-11 rounded-xl border-border"
              >
                <Save className="w-4 h-4" />
                保存棋谱
              </Button>
            )}
              <Button
                variant="secondary"
                onClick={onLeave}
                className="w-full min-w-0 min-h-11 rounded-xl border-border"
              >
                <ArrowLeft className="w-4 h-4" />
                返回大厅
              </Button>
              <Button
                onClick={onRestart}
                className="w-full min-w-0 min-h-11 rounded-xl bg-primary text-primary-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                再来一局
              </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default GameEndDialog;
