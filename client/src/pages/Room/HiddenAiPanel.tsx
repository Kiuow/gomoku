import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Switch } from '@client/src/components/ui/switch';
import { Input } from '@client/src/components/ui/input';
import { Lightbulb, Sparkles, TrendingUp, Lock } from 'lucide-react';
import type { AiThinkingStrength } from '@shared/api.interface';

interface HiddenAiPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: 'pro' | 'godlike';
  settings: { hintEnabled: boolean; autoPlayEnabled: boolean; showWinRate: boolean };
  thinkingStrength: AiThinkingStrength;
  onThinkingStrengthChange: (strength: AiThinkingStrength) => void;
  onHintChange: (enabled: boolean) => void;
  onAutoPlayChange: (enabled: boolean) => void;
  onWinRateChange: (enabled: boolean) => void;
  disabled?: boolean;
  onUpgradeToGodlike?: () => void;
  onDowngradeToPro?: () => void;
}

const PASSWORD = '7355608';
const TITLE_CLICK_TARGET = 10;
const TITLE_CLICK_WINDOW = 3000;
const DOWNGRADE_CLICK_TARGET = 5;
const DOWNGRADE_CLICK_WINDOW = 2000;

export function HiddenAiPanel({
  open,
  onOpenChange,
  tier,
  settings,
  thinkingStrength,
  onThinkingStrengthChange,
  onHintChange,
  onAutoPlayChange,
  onWinRateChange,
  disabled = false,
  onUpgradeToGodlike,
  onDowngradeToPro,
}: HiddenAiPanelProps) {
  const isGodlike = tier === 'godlike';
  const { hintEnabled, showWinRate } = settings;

  // Hidden title-click trigger (pro only)
  const titleClickTimesRef = useRef<number[]>([]);
  // Hidden title-click downgrade trigger (godlike only)
  const downgradeClickTimesRef = useRef<number[]>([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handleTitleClick = () => {
    const now = Date.now();

    if (isGodlike) {
      downgradeClickTimesRef.current.push(now);
      downgradeClickTimesRef.current = downgradeClickTimesRef.current.filter(
        (t: number) => now - t <= DOWNGRADE_CLICK_WINDOW,
      );
      if (downgradeClickTimesRef.current.length >= DOWNGRADE_CLICK_TARGET) {
        downgradeClickTimesRef.current = [];
        // Close all godlike switches
        onHintChange(false);
        onAutoPlayChange(false);
        onWinRateChange(false);
        onOpenChange(false);
        onDowngradeToPro?.();
      }
      return;
    }

    titleClickTimesRef.current.push(now);
    titleClickTimesRef.current = titleClickTimesRef.current.filter(
      (t: number) => now - t <= TITLE_CLICK_WINDOW,
    );
    if (titleClickTimesRef.current.length >= TITLE_CLICK_TARGET) {
      titleClickTimesRef.current = [];
      setPasswordValue('');
      setPasswordError(false);
      setPasswordOpen(true);
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordValue === PASSWORD) {
      setPasswordOpen(false);
      setPasswordValue('');
      setPasswordError(false);
      onUpgradeToGodlike?.();
    } else {
      setPasswordError(true);
      setPasswordValue('');
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePasswordSubmit();
    }
  };

  const titleText = isGodlike ? '终极 AI' : 'AI 助手';
  const descText = isGodlike
    ? '深度思考，算无遗策'
    : '职业级 AI 辅助，精准稳健';

  const cardBorderClass = 'border-border';

  const titleClass = isGodlike
    ? 'text-[color:var(--ai-godlike-accent)]'
    : 'text-foreground';

  const descClass = 'text-muted-foreground text-center sm:text-center';

  const iconBgClass = isGodlike
    ? 'bg-gradient-to-br from-[#4a3a7c] to-[#c9a227]'
    : 'bg-secondary';

  const hintIconColorClass = isGodlike
    ? 'text-[color:var(--ai-godlike-accent)]'
    : 'text-[color:var(--color-gold)]';


  const winRateIconColorClass = isGodlike
    ? 'text-[color:var(--ai-godlike-accent)]'
    : 'text-primary';

  const closeButtonClass = isGodlike
    ? 'h-11 rounded-xl text-[#3d2e1f]'
    : 'h-11 rounded-xl bg-primary text-primary-foreground';

  const closeButtonStyle = isGodlike
    ? {
        background: 'linear-gradient(135deg, #c9a227 0%, #b8860b 100%)',
        color: '#3d2e1f',
      }
    : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`sm:max-w-md p-0 max-h-[90dvh] overflow-y-auto rounded-2xl bg-background ${cardBorderClass}`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="p-6"
          >
            {/* Top icon area */}
            <div className="flex justify-center mb-4">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconBgClass}`}
                style={
                  isGodlike
                    ? { boxShadow: '0 4px 16px rgba(201, 162, 39, 0.25)' }
                    : undefined
                }
              >
                {isGodlike ? (
                  <Sparkles className="w-7 h-7 text-[#f5e6b3]" />
                ) : (
                  <Lightbulb className="w-7 h-7 text-[#2d5a4a]" />
                )}
              </div>
            </div>

            <DialogHeader className="text-center sm:text-center">
              <DialogTitle
                className={`text-xl ${titleClass} flex items-center justify-center gap-2 select-none`}
                onClick={handleTitleClick}
                style={{ cursor: 'default' }}
              >
                {titleText}
              </DialogTitle>
              <DialogDescription className={descClass}>
                {descText}
              </DialogDescription>
            </DialogHeader>

            {disabled && (
              <div className="mt-4 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#c9a227]/10 border border-[#c9a227]/30">
                <Lock className="w-4 h-4 text-[#c9a227]" />
                <p className="text-xs font-medium text-[#8b6914]">
                  终极AI已启用，职业级已锁定
                </p>
              </div>
            )}

            <div className="space-y-5 py-3">
              {/* Hint switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isGodlike ? 'bg-[color:var(--ai-godlike-surface)]' : 'bg-secondary'
                    } ${hintIconColorClass}`}
                  >
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      AI 提示
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      显示AI提示按钮和分析面板
                    </p>
                  </div>
                </div>
                <Switch
                  checked={hintEnabled}
                  onCheckedChange={onHintChange}
                  disabled={disabled}
                  style={isGodlike && hintEnabled ? { backgroundColor: 'var(--ai-godlike-accent)' } : undefined}
                />
              </div>

              {/* Win rate switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isGodlike ? 'bg-[color:var(--ai-godlike-surface)]' : 'bg-secondary'
                    } ${winRateIconColorClass}`}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      显示胜率
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      实时预测双方胜率
                    </p>
                  </div>
                </div>
                <Switch
                  checked={showWinRate}
                  onCheckedChange={onWinRateChange}
                  disabled={disabled}
                  style={isGodlike && showWinRate ? { backgroundColor: 'var(--ai-godlike-accent)' } : undefined}
                />
              </div>

              {isGodlike && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">思考强度</p>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="思考强度">
                    {(['low', 'medium', 'high'] as const).map((strength) => (
                      <button
                        key={strength}
                        type="button"
                        aria-pressed={thinkingStrength === strength}
                        onClick={() => onThinkingStrengthChange(strength)}
                        className="min-h-11 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ai-godlike-accent)]"
                        style={thinkingStrength === strength
                          ? { borderColor: 'var(--ai-godlike-accent)', backgroundColor: 'var(--ai-godlike-surface)', color: 'var(--ai-godlike-accent)' }
                          : { borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      >
                        {{ low: '低', medium: '中', high: '高' }[strength]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">影响 AI 提示、AI 落子及全自动 AI 的思考时间</p>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                onClick={() => onOpenChange(false)}
                className={closeButtonClass}
                style={closeButtonStyle}
              >
                关闭
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden rounded-2xl bg-background border-border">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="p-5"
          >
            <DialogHeader>
              <DialogTitle className="text-sm font-medium text-muted-foreground">
                验证
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="password"
                value={passwordValue}
                onChange={(e) => {
                  setPasswordValue(e.target.value);
                  if (passwordError) setPasswordError(false);
                }}
                onKeyDown={handlePasswordKeyDown}
                placeholder="请输入密码"
                className="h-11 rounded-xl"
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-destructive mt-2">
                  密码错误
                </p>
              )}
            </div>
            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPasswordOpen(false)}
                className="rounded-xl border-border bg-card text-foreground"
              >
                取消
              </Button>
              <Button
                onClick={handlePasswordSubmit}
                className="rounded-xl bg-primary text-primary-foreground"
              >
                确认
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default HiddenAiPanel;
