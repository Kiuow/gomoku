import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Move } from '@shared/api.interface';
import { cn } from '@/lib/utils';

interface GomokuBoardProps {
  board: string[][];
  lastMove: Move | null;
  winningLine: Move[] | null;
  onCellClick: (row: number, col: number) => void;
  disabled?: boolean;
  currentPlayer?: 'black' | 'white';
  hintMove?: Move | null;
  showCoordinates?: boolean;
  allowOccupiedClick?: boolean;
  highlightCell?: Move | null;
}

const BOARD_SIZE = 15;
const STAR_POINTS: Move[] = [
  { row: 3, col: 3 },
  { row: 3, col: 11 },
  { row: 7, col: 7 },
  { row: 11, col: 3 },
  { row: 11, col: 11 },
];

export function GomokuBoard({
  board,
  lastMove,
  winningLine,
  onCellClick,
  disabled,
  currentPlayer = 'black',
  hintMove = null,
  showCoordinates = false,
  allowOccupiedClick = false,
  highlightCell = null,
}: GomokuBoardProps) {
  const [hoverPos, setHoverPos] = useState<Move | null>(null);

  const isWinning = useCallback(
    (row: number, col: number) => {
      if (!winningLine) return false;
      return winningLine.some((m: Move) => m.row === row && m.col === col);
    },
    [winningLine],
  );

  const isStar = useCallback((row: number, col: number) => {
    return STAR_POINTS.some((p: Move) => p.row === row && p.col === col);
  }, []);

  const isLastMove = useCallback(
    (row: number, col: number) => {
      if (!lastMove) return false;
      return lastMove.row === row && lastMove.col === col;
    },
    [lastMove],
  );

  const handleClick = (row: number, col: number) => {
    if (disabled) return;
    if (!allowOccupiedClick && board[row][col]) return;
    onCellClick(row, col);
  };

  return (
    <div
      className={cn(
        'relative w-full mx-auto rounded-2xl shadow-xl',
        'aspect-square max-w-[560px] sm:max-w-[520px]',
      )}
      style={{
         background: 'var(--board-bg)',
         backgroundBlendMode: 'overlay',
         boxShadow: 'var(--board-shadow)',
       }}
    >
      {/* Row numbers (left side) */}
      {showCoordinates && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: '-24px',
            top: '3.33%',
            bottom: '3.33%',
            width: '20px',
          }}
        >
          {Array.from({ length: BOARD_SIZE }).map((_, i: number) => (
            <span
              key={`row-${i}`}
              className="absolute left-0 w-full text-center text-xs font-medium leading-none"
              style={{
                top: `${(i / (BOARD_SIZE - 1)) * 100}%`,
                transform: 'translateY(-50%)',
                color: 'var(--board-coord)',
              }}
             >
               {BOARD_SIZE - i}
            </span>
          ))}
        </div>
      )}

      {/* Column letters (bottom) */}
      {showCoordinates && (
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: '-22px',
            left: '3.33%',
            right: '3.33%',
            height: '18px',
          }}
        >
          {Array.from({ length: BOARD_SIZE }).map((_, i: number) => (
            <span
              key={`col-${i}`}
              className="absolute top-0 text-center text-xs font-medium leading-none"
              style={{
                left: `${(i / (BOARD_SIZE - 1)) * 100}%`,
                transform: 'translateX(-50%)',
                color: 'var(--board-coord)',
              }}
             >
               {String.fromCharCode(65 + i)}
            </span>
          ))}
        </div>
      )}
      {/* Grid lines */}
      <div
        className="absolute inset-0"
        style={{
          padding: '3.33%',
        }}
      >
        <div className="relative w-full h-full">
          {/* Horizontal lines */}
          {Array.from({ length: BOARD_SIZE }).map((_, i: number) => (
            <div
              key={`h-${i}`}
              className="absolute w-full"
              style={{
                top: `${(i / (BOARD_SIZE - 1)) * 100}%`,
                 height: '1px',
                 backgroundColor: 'var(--board-line)',
                 transform: 'translateY(-50%)',
              }}
            />
          ))}
          {/* Vertical lines */}
          {Array.from({ length: BOARD_SIZE }).map((_, i: number) => (
            <div
              key={`v-${i}`}
              className="absolute h-full"
              style={{
                left: `${(i / (BOARD_SIZE - 1)) * 100}%`,
                   width: '1px',
                   backgroundColor: 'var(--board-line)',
                   transform: 'translateX(-50%)',
              }}
            />
          ))}

          {/* Star points */}
          {STAR_POINTS.map((p: Move, idx: number) => (
            <div
              key={`star-${idx}`}
              className="absolute rounded-full"
              style={{
                left: `${(p.col / (BOARD_SIZE - 1)) * 100}%`,
                top: `${(p.row / (BOARD_SIZE - 1)) * 100}%`,
                width: '3%',
                height: '3%',
                 backgroundColor: 'var(--board-star)',
                 transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* Click grid + pieces overlay */}
          <div
            className="absolute grid"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
              gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
              left: '-3.5714285714%',
              top: '-3.5714285714%',
              width: '107.1428571429%',
              height: '107.1428571429%',
            }}
          >
            {board.map((row: string[], r: number) =>
              row.map((cell: string, c: number) => {
                const isWin = isWinning(r, c);
                const isLast = isLastMove(r, c);
                 const isHovered =
                   hoverPos?.row === r && hoverPos?.col === c && !cell && !disabled;
                 const isHint =
                    hintMove && hintMove.row === r && hintMove.col === c && !cell;
                  const isHl =
                    highlightCell && highlightCell.row === r && highlightCell.col === c;
                  const piece = cell || (isHovered ? currentPlayer : null);

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className={cn(
                      'relative flex items-center justify-center',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                      !disabled && !cell ? 'cursor-pointer' : 'cursor-default',
                    )}
                    onClick={() => handleClick(r, c)}
                    onMouseEnter={() => !disabled && setHoverPos({ row: r, col: c })}
                    onMouseLeave={() => setHoverPos(null)}
                    aria-label={`行${r + 1}列${c + 1}`}
                  >
                     {piece && (
                        <motion.div
                          className={cn(
                            'rounded-full absolute',
                          )}
                          initial={cell ? { scale: 0 } : false}
                          animate={{ scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 18,
                          }}
                          style={{
                            width: '85%',
                            height: '85%',
                            background:
                              piece === 'black'
                                ? 'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)'
                                : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
                            boxShadow:
                              '0 3px 8px rgba(0,0,0,0.3), inset -1px -2px 4px rgba(0,0,0,0.2)',
                            opacity: isHovered && !cell ? 0.4 : 1,
                             outline: isWin
                               ? '2px solid hsl(46, 68%, 47%)'
                               : 'none',
                             outlineColor: 'var(--color-gold)',
                             outlineOffset: isWin ? '2px' : '0',
                          }}
                        >
                          {isLast && (
                            <div
                              className="absolute top-1/2 left-1/2 rounded-full"
                              style={{
                               width: '28%',
                               height: '28%',
                               border: '2px solid var(--last-move-color)',
                               backgroundColor: 'transparent',
                                transform: 'translate(-50%, -50%)',
                              }}
                            />
                          )}
                          {isWin && (
                            <div
                              className="absolute inset-0 rounded-full animate-pulse"
                               style={{
                                 background:
                                   'radial-gradient(circle, var(--win-glow) 0%, transparent 70%)',
                               }}
                            />
                          )}
                        </motion.div>
                      )}
                      {isHint && !piece && (
                        <div
                          className="absolute rounded-full animate-pulse"
                          style={{
                            width: '60%',
                            height: '60%',
                             backgroundColor: 'var(--hint-color)',
                            opacity: 0.65,
                            boxShadow: '0 0 12px rgba(34,197,94,0.6)',
                          }}
                        />
                      )}
                      {isHl && (
                        <div
                          className="absolute rounded-full animate-ping"
                          style={{
                            width: '80%',
                            height: '80%',
                             border: '2px solid var(--win-line-color)',
                            opacity: 0.8,
                          }}
                        />
                      )}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GomokuBoard;
