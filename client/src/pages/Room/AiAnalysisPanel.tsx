import {
  Brain,
  Target,
  Lightbulb,
  ListTodo,
  Users,
  Globe,
  Compass,
  AlertTriangle,
  Shield,
  Swords,
  Scale,
  Zap,
  XCircle,
} from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import type { AiHintAnalysis } from '@shared/api.interface';

interface AiAnalysisPanelProps {
  analysis: AiHintAnalysis | null;
  loading?: boolean;
  variant?: 'default' | 'opponent';
  title?: string;
  hintMove?: { row: number; col: number } | null;
  onCoordinateClick?: (row: number, col: number) => void;
}

const intentionConfig = {
  attack: {
    label: '进攻',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    Icon: Swords,
  },
  defense: {
    label: '防守',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    Icon: Shield,
  },
  balanced: {
    label: '攻守兼备',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    Icon: Scale,
  },
} as const;

function posLabel(row: number, col: number): string {
  const cols = 'ABCDEFGHIJKLMNO';
  return `${cols[col]}${15 - row}`;
}

function parseCoord(move: string): { row: number; col: number } | null {
  const m = move.trim().toUpperCase();
  const match = m.match(/^([A-O])(\d{1,2})$/);
  if (!match) return null;
  const col = match[1].charCodeAt(0) - 65;
  const row = 15 - parseInt(match[2], 10);
  if (row < 0 || row > 14 || col < 0 || col > 14) return null;
  return { row, col };
}

export function AiAnalysisPanel({
  analysis,
  loading,
  variant = 'default',
  title,
  hintMove,
  onCoordinateClick,
}: AiAnalysisPanelProps) {
  const isOpponent = variant === 'opponent';
  const panelTitle = title || (isOpponent ? '对方思路' : 'AI 分析');

  const handleCoordClick = (row: number, col: number) => {
    if (onCoordinateClick) onCoordinateClick(row, col);
  };

  const handleMoveClick = (move: string) => {
    const pos = parseCoord(move);
    if (pos && onCoordinateClick) onCoordinateClick(pos.row, pos.col);
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 space-y-4 border bg-card border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-base text-foreground">{panelTitle}</h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 rounded animate-pulse bg-muted" />
          <div className="h-4 rounded w-4/5 animate-pulse bg-muted" />
          <div className="h-4 rounded w-3/4 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl p-5 text-center border bg-card border-border">
        <p className="text-sm text-muted-foreground/70">
          {isOpponent ? '暂无对方思路分析' : '点击「AI提示」查看详细分析'}
        </p>
      </div>
    );
  }

  const intent = intentionConfig[analysis.intention];
  const IntentIcon = intent.Icon;

  const isDeepMode = Boolean(analysis.coreIntent) || Boolean(analysis.patternDetail) || Boolean(analysis.followUpPlan);

  const coreText = analysis.coreIntent || analysis.intentionText;
  const whyText = analysis.whyThisPoint || analysis.reasoning;
  const nextTextList = analysis.followUpPlan || (analysis.nextSteps ? [analysis.nextSteps] : []);
  const patternText = analysis.pattern;

  const panelBg = isOpponent ? 'bg-purple-500/5 border-purple-500/20' : 'bg-card border-border';
  const titleColor = isOpponent ? 'text-purple-700 dark:text-purple-300' : 'text-foreground';
  const iconColor = isOpponent ? 'text-purple-600 dark:text-purple-400' : 'text-primary';

  return (
    <div className={`rounded-2xl p-5 space-y-4 border ${panelBg}`}>
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Brain className={`w-5 h-5 ${iconColor}`} />
        <h3 className={`font-semibold text-base ${titleColor}`}>{panelTitle}</h3>
        {hintMove && (
          <button
            type="button"
            onClick={() => handleCoordClick(hintMove.row, hintMove.col)}
            className="ml-auto text-xs px-2.5 py-1 rounded-lg border transition-colors border-border bg-secondary text-muted-foreground hover:text-foreground"
          >
            📍 {posLabel(hintMove.row, hintMove.col)}
          </button>
        )}
      </div>

      {isDeepMode ? (
        <>
          {/* 1. Core intent */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Brain className={`w-4 h-4 ${iconColor}`} />
              <span className="text-sm font-medium text-foreground">核心意图</span>
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${intent.color} ${intent.bg} ${intent.border} gap-1`}>
                  <IntentIcon className="w-3 h-3" />
                  {intent.label}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-foreground">{coreText}</p>
            </div>
          </div>

          {/* 2. Pattern detail (or fallback pattern) */}
          {(analysis.patternDetail || patternText) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[color:hsl(var(--color-gold))]" />
                <span className="text-sm font-medium text-foreground">棋型详解</span>
              </div>
              <div className="pl-6 space-y-2">
                {analysis.patternDetail ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">棋型：</span>
                      <span className="text-foreground font-medium">{analysis.patternDetail.type}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">威胁：</span>
                      <span className="text-foreground">{analysis.patternDetail.threat}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">发展：</span>
                      <span className="text-foreground">{analysis.patternDetail.development}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">方向：</span>
                      <span className="text-foreground">{analysis.patternDetail.directionCount} 个发展方向</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">{patternText}</p>
                )}
              </div>
            </div>
          )}

          {/* 3. Why this point */}
          {whyText && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-foreground">为什么选这里</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{whyText}</p>
            </div>
          )}

          {/* 4. Follow-up plan */}
          {nextTextList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ListTodo className={`w-4 h-4 ${iconColor}`} />
                <span className="text-sm font-medium text-foreground">后续发展路线</span>
              </div>
              <ul className="pl-6 space-y-1.5">
                {nextTextList.map((item: string, idx: number) => (
                  <li key={idx} className="text-sm leading-relaxed text-muted-foreground flex gap-2">
                    <span className="text-primary shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 5. Opponent responses */}
          {analysis.opponentResponses && analysis.opponentResponses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-foreground">对方可能应对</span>
              </div>
              <div className="pl-6 space-y-2">
                {analysis.opponentResponses.map((resp, idx: number) => {
                  const pos = parseCoord(resp.move);
                  return (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => handleMoveClick(resp.move)}
                        className="text-xs h-5 px-2 shrink-0 rounded-lg transition-colors border border-border bg-secondary text-muted-foreground hover:text-foreground"
                        disabled={!pos}
                      >
                        {resp.move}
                      </button>
                      <span className="leading-relaxed text-muted-foreground">{resp.counter}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Global situation */}
          {analysis.globalSituation && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-foreground">全局形势</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{analysis.globalSituation}</p>
            </div>
          )}

          {/* 7. Alternatives */}
          {analysis.alternatives && analysis.alternatives.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium text-foreground">备选方案</span>
              </div>
              <div className="pl-6 space-y-2">
                {analysis.alternatives.map((alt, idx: number) => (
                  <div key={`${alt.row}-${alt.col}-${idx}`} className="flex items-start gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => handleCoordClick(alt.row, alt.col)}
                      className="text-xs h-5 px-2 shrink-0 rounded-lg transition-colors border border-border bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      {posLabel(alt.row, alt.col)}
                    </button>
                    <span className="leading-relaxed text-muted-foreground">{alt.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. If not played */}
          {analysis.ifNotPlayed && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-foreground">如果不下这里</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{analysis.ifNotPlayed}</p>
            </div>
          )}

          {/* 9. Mid-long term */}
          {analysis.midLongTerm && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium text-foreground">中长期布局</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{analysis.midLongTerm}</p>
            </div>
          )}

          {/* 10. Risks */}
          {analysis.risks && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-foreground">风险与注意</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{analysis.risks}</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Basic mode — old fields */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">核心意图：</span>
            <Badge variant="outline" className={`${intent.color} ${intent.bg} ${intent.border} gap-1`}>
              <IntentIcon className="w-3 h-3" />
              {intent.label}
            </Badge>
            <span className="text-sm text-foreground">{analysis.intentionText}</span>
          </div>

          {patternText && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">棋型分析</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{patternText}</p>
            </div>
          )}

          {analysis.reasoning && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-[color:hsl(var(--color-gold))]" />
                <span className="text-sm font-medium text-foreground">选择理由</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{analysis.reasoning}</p>
            </div>
          )}

          {analysis.nextSteps && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">后续建议</span>
              </div>
              <p className="text-sm leading-relaxed pl-6 text-muted-foreground">{analysis.nextSteps}</p>
            </div>
          )}

          {analysis.alternatives && analysis.alternatives.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">备选方案</span>
              </div>
              <div className="pl-6 space-y-2">
                {analysis.alternatives.map((alt, idx: number) => (
                  <div key={`${alt.row}-${alt.col}-${idx}`} className="flex items-start gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => handleCoordClick(alt.row, alt.col)}
                      className="text-xs h-5 px-2 shrink-0 rounded-lg transition-colors border border-border bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      {posLabel(alt.row, alt.col)}
                    </button>
                    <span className="leading-relaxed text-muted-foreground">{alt.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AiAnalysisPanel;
