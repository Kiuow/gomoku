import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@client/src/hooks/useTheme';
import { cn } from '@client/src/lib/utils';

type ThemeMode = 'light' | 'dark' | 'system';

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();

  const options: Array<{ value: ThemeMode; icon: typeof Sun; label: string }> = [
    { value: 'light', icon: Sun, label: '浅色' },
    { value: 'dark', icon: Moon, label: '深色' },
    { value: 'system', icon: Monitor, label: '跟随系统' },
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-muted/50',
        className,
      )}
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          aria-label={label}
          title={label}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
            mode === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
