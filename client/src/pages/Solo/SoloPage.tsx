import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { RotateCcw, ArrowLeft, Undo2, Sparkles, Lightbulb, Bot, Brain, TrendingUp, Grid3X3, Eye } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Switch } from '@client/src/components/ui/switch';
import GomokuBoard from '@client/src/components/GomokuBoard';
import GameEndDialog from '@client/src/pages/Room/GameEndDialog';
import AiAnalysisPanel from '@client/src/pages/Room/AiAnalysisPanel';
import WinRateBar from '@client/src/components/ui/WinRateBar';
import { gomoku } from '@client/src/api';
 import type {
    GomokuRoom,
    PlayerColor,
    Move,
    MoveWithPlayer,
    AiHintAnalysis,
    AiDifficulty,
    WinRateInfo,
  } from '@shared/api.interface';
import { saveKifu, generateDefaultName, isKifuFull } from '@client/src/utils/kifu';
import type { GameResult } from '@client/src/utils/kifu';

const PLAYER_ID_KEY = 'gomoku_player_id';
const SOLO_AUTO_KEY = 'gomoku_solo_auto';
const CONTINUOUS_HINT_KEY = 'gomoku_solo_continuous_hint';
const SHOW_COORDINATES_KEY = 'gomoku_show_coordinates';
const SHOW_OPPONENT_KEY = 'gomoku_show_opponent';
const SHOW_WINRATE_KEY = 'gomoku_solo_show_winrate';
const difficultyColor: Record<AiDifficulty, string> = {
  easy: 'var(--difficulty-easy)',
  normal: 'var(--difficulty-normal)',
  hard: 'var(--difficulty-hard)',
  hell: 'var(--difficulty-hell)',
  godlike: 'var(--difficulty-hell)',
};

function getPlayerId(): string {
  try {
    const id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      const newId = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(PLAYER_ID_KEY, newId);
      return newId;
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }
}

function loadAutoPlay(): boolean {
  try {
    return localStorage.getItem(SOLO_AUTO_KEY) === 'true';
  } catch (error: unknown) {
    logger.error('读取单人模式设置失败', error);
    return false;
  }
}

function saveAutoPlay(enabled: boolean): void {
  try {
    localStorage.setItem(SOLO_AUTO_KEY, String(enabled));
  } catch (error: unknown) {
    logger.error('保存单人模式设置失败', error);
  }
}

function loadContinuousHint(): boolean {
  try {
    return localStorage.getItem(CONTINUOUS_HINT_KEY) === 'true';
  } catch (error: unknown) {
    logger.error('读取持续提示设置失败', error);
    return false;
  }
}

function saveContinuousHint(enabled: boolean): void {
  try {
    localStorage.setItem(CONTINUOUS_HINT_KEY, String(enabled));
  } catch (error: unknown) {
    logger.error('保存持续提示设置失败', error);
  }
}

function loadShowCoordinates(): boolean {
  try {
    return localStorage.getItem(SHOW_COORDINATES_KEY) !== 'false';
  } catch (error: unknown) {
    logger.error('读取坐标显示设置失败', error);
    return true;
  }
}

function saveShowCoordinates(enabled: boolean): void {
  try {
    localStorage.setItem(SHOW_COORDINATES_KEY, String(enabled));
  } catch (error: unknown) {
    logger.error('保存坐标显示设置失败', error);
  }
}

function loadShowOpponent(): boolean {
  try {
    return localStorage.getItem(SHOW_OPPONENT_KEY) !== 'false';
  } catch (error: unknown) {
    logger.error('读取对方思路设置失败', error);
    return true;
  }
}

function saveShowOpponent(enabled: boolean): void {
   try {
     localStorage.setItem(SHOW_OPPONENT_KEY, String(enabled));
   } catch (error: unknown) {
     logger.error('保存对方思路设置失败', error);
   }
 }

function loadShowWinRate(): boolean {
  try {
    return localStorage.getItem(SHOW_WINRATE_KEY) !== 'false';
  } catch (error: unknown) {
    logger.error('读取胜率显示设置失败', error);
    return true;
  }
}

function saveShowWinRate(enabled: boolean): void {
  try {
    localStorage.setItem(SHOW_WINRATE_KEY, String(enabled));
  } catch (error: unknown) {
    logger.error('保存胜率显示设置失败', error);
  }
}

const pieceStyle = (color: 'black' | 'white'): React.CSSProperties => ({
  background:
    color === 'black'
      ? 'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)'
      : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset -1px -1px 3px rgba(0,0,0,0.15)',
});

const SoloPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerIdRef = useRef<string>(getPlayerId());
  const [room, setRoom] = useState<GomokuRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintAnalysis, setHintAnalysis] = useState<AiHintAnalysis | null>(null);
  const [hintWinRate, setHintWinRate] = useState<WinRateInfo | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState<boolean>(loadAutoPlay);
  const [continuousHintEnabled, setContinuousHintEnabled] = useState<boolean>(loadContinuousHint);
  const [showCoordinates, setShowCoordinates] = useState<boolean>(loadShowCoordinates);
  const [showOpponentThought, setShowOpponentThought] = useState<boolean>(loadShowOpponent);
  const [opponentAnalysis, setOpponentAnalysis] = useState<AiHintAnalysis | null>(null);
  const [highlightCell, setHighlightCell] = useState<Move | null>(null);
   const [showEndDialog, setShowEndDialog] = useState(false);
   const [undoing, setUndoing] = useState(false);
   const [switchingDifficulty, setSwitchingDifficulty] = useState(false);

   // Win rate
   const [showWinRate, setShowWinRate] = useState<boolean>(loadShowWinRate);
   const [winRate, setWinRate] = useState<WinRateInfo | null>(null);
   const [winRateLoading, setWinRateLoading] = useState(false);
   const winRateTimerRef = useRef<number | null>(null);

  const autoTimerRef = useRef<number | null>(null);
  const opponentTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const continuousHintRef = useRef<number | null>(null);
  const aiPollTimerRef = useRef<number | null>(null);
  const analyzedMoveCountRef = useRef<number>(-1);
  const prevRoomRef = useRef<GomokuRoom | null>(null);
  const mountedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const moveSubmittingRef = useRef(false);

  const playerId = playerIdRef.current;

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await gomoku.gomokuApi.getSoloRoom(roomCode);
      if (mountedRef.current) {
        setRoom(res.room);
        const aiColor = res.room.currentPlayer;
        setAiThinking(res.room.status === 'playing' && (aiColor === 'black' ? res.room.blackPlayer : res.room.whitePlayer) === `ai_${aiColor}`);
      }
    } catch (error: unknown) {
      logger.error('获取单人房间状态失败', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    let mounted = true;
    mountedRef.current = true;
    const load = async () => {
      await fetchRoom();
      if (mounted && mountedRef.current) setLoading(false);
    };
    load();
    return () => {
      mounted = false;
      mountedRef.current = false;
    };
  }, [roomCode, fetchRoom]);

  const myColor: PlayerColor | null = room
    ? room.blackPlayer === playerId
      ? 'black'
      : room.whitePlayer === playerId
        ? 'white'
        : null
    : null;

  const isMyTurn =
    room && myColor && room.status === 'playing' && room.currentPlayer === myColor;

  // Game end dialog
  useEffect(() => {
    if (!room) return;
    const prev = prevRoomRef.current;
    if (room.status === 'ended' && prev?.status !== 'ended') {
      setShowEndDialog(true);
    }
    prevRoomRef.current = room;
  }, [room]);

  // Clear hint after move (preserve analysis during opponent turn if continuous hint is on)
  useEffect(() => {
    if (room?.moveCount !== undefined) {
      setHintMove(null);
      setHintWinRate(null);
      if (!isMyTurn) {
        setHintAnalysis(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.moveCount, room?.currentPlayer]);

  // Continuous hint: trigger analysis once per new player turn
  useEffect(() => {
    if (!continuousHintEnabled) return;
    if (!room || room.status !== 'playing') return;
    if (!isMyTurn) return;
    if (aiThinking) return;
    if (hintLoading) return;

    const currentMoveCount = room.moveCount;
    if (analyzedMoveCountRef.current === currentMoveCount) return;

    if (continuousHintRef.current !== null) {
      clearTimeout(continuousHintRef.current);
    }

    continuousHintRef.current = window.setTimeout(() => {
      continuousHintRef.current = null;
      if (analyzedMoveCountRef.current === currentMoveCount) return;
      analyzedMoveCountRef.current = currentMoveCount;
      handleHint();
    }, 400);

    return () => {
      if (continuousHintRef.current !== null) {
        clearTimeout(continuousHintRef.current);
        continuousHintRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousHintEnabled, isMyTurn, room?.status, room?.moveCount, aiThinking, hintLoading]);

  // Auto-play: schedule AI move when it's player's turn and auto-play is on
  useEffect(() => {
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }

    if (!autoPlayEnabled) return;
    if (!room || room.status !== 'playing') return;
    if (!isMyTurn) return;
    if (aiThinking) return;
    if (hintLoading) return;

    const delay = 1000 + Math.random() * 1000;
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null;
      handleAiMove();
    }, delay);

    return () => {
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, room?.status, room?.moveCount, autoPlayEnabled, aiThinking, hintLoading]);

  // AI move polling: check for AI move completion when aiThinking is true
  useEffect(() => {
    if (!aiThinking) {
      if (aiPollTimerRef.current !== null) {
        clearInterval(aiPollTimerRef.current);
        aiPollTimerRef.current = null;
      }
      return;
    }

    if (!roomCode || !myColor) return;

    aiPollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await gomoku.gomokuApi.getSoloRoom(roomCode);
        if (!mountedRef.current) return;
        const polledRoom = res.room;
        // AI has moved when currentPlayer switches back to player's color
        // or when the game ends (AI won or draw)
        if (polledRoom.currentPlayer === myColor || polledRoom.status === 'ended') {
          setRoom(polledRoom);
          setAiThinking(false);
          if (aiPollTimerRef.current !== null) {
            clearInterval(aiPollTimerRef.current);
            aiPollTimerRef.current = null;
          }
        }
      } catch (error: unknown) {
        logger.error('轮询AI落子状态失败', error);
      }
    }, 500);

    return () => {
      if (aiPollTimerRef.current !== null) {
        clearInterval(aiPollTimerRef.current);
        aiPollTimerRef.current = null;
      }
    };
  }, [aiThinking, roomCode, myColor]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      if (opponentTimerRef.current !== null) {
        clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
       if (continuousHintRef.current !== null) {
         clearTimeout(continuousHintRef.current);
         continuousHintRef.current = null;
       }
       if (aiPollTimerRef.current !== null) {
         clearInterval(aiPollTimerRef.current);
         aiPollTimerRef.current = null;
       }
       if (winRateTimerRef.current !== null) {
         clearTimeout(winRateTimerRef.current);
         winRateTimerRef.current = null;
       }
     };
   }, []);

  const handleAutoPlayToggle = (enabled: boolean) => {
    setAutoPlayEnabled(enabled);
    saveAutoPlay(enabled);
    if (!enabled && autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };

  const handleContinuousHintToggle = (enabled: boolean) => {
    setContinuousHintEnabled(enabled);
    saveContinuousHint(enabled);
    if (!enabled) {
      if (continuousHintRef.current !== null) {
        clearTimeout(continuousHintRef.current);
        continuousHintRef.current = null;
      }
      analyzedMoveCountRef.current = -1;
    }
  };

  const handleShowCoordinatesToggle = (enabled: boolean) => {
    setShowCoordinates(enabled);
    saveShowCoordinates(enabled);
  };

   const handleShowOpponentToggle = (enabled: boolean) => {
     setShowOpponentThought(enabled);
     saveShowOpponent(enabled);
     if (!enabled) {
       setOpponentAnalysis(null);
     }
   };

   const handleShowWinRateToggle = (enabled: boolean) => {
     setShowWinRate(enabled);
     saveShowWinRate(enabled);
     if (!enabled) {
       setWinRate(null);
       if (winRateTimerRef.current !== null) {
         clearTimeout(winRateTimerRef.current);
         winRateTimerRef.current = null;
       }
     }
   };

   const fetchWinRate = useCallback(async () => {
     if (!roomCode || !showWinRate) return;
     setWinRateLoading(true);
     try {
       const res = await gomoku.gomokuApi.getSoloWinRate(roomCode);
       if (res.valid) {
         setWinRate(res.winRate);
       }
     } catch (error: unknown) {
       logger.error('获取胜率失败', error);
     } finally {
       setWinRateLoading(false);
     }
   }, [roomCode, showWinRate]);

   // Trigger win rate update when move count changes (debounced)
   useEffect(() => {
     if (!showWinRate) return;
     if (!room || room.moveCount === 0) return;
     if (winRateTimerRef.current !== null) {
       clearTimeout(winRateTimerRef.current);
     }

     winRateTimerRef.current = window.setTimeout(() => {
       winRateTimerRef.current = null;
       fetchWinRate();
     }, 300);

     return () => {
       if (winRateTimerRef.current !== null) {
         clearTimeout(winRateTimerRef.current);
         winRateTimerRef.current = null;
       }
     };
   }, [room?.moveCount, showWinRate, fetchWinRate]);

  const handleCoordinateClick = (row: number, col: number) => {
    setHighlightCell({ row, col });
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightCell(null);
      highlightTimerRef.current = null;
    }, 2000);
  };

  const handleCellClick = async (row: number, col: number) => {
    if (!room || !roomCode || !isMyTurn || !myColor) return;
    if (room.board[row][col]) return;
    if (aiThinking || hintLoading || undoing || moveSubmittingRef.current) return;
    moveSubmittingRef.current = true;

    // Cancel pending auto-play — manual move takes priority
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }

    // Save previous state for potential rollback
    const prevRoom = room;

    // Optimistic update: immediately show player's stone
    const newBoard = room.board.map((r: string[]) => [...r]);
    newBoard[row][col] = myColor;
    const newLastMove = { row, col };
    const newMoveCount = room.moveCount + 1;
    const nextPlayer: PlayerColor = myColor === 'black' ? 'white' : 'black';
    const newMoveHistory = [...room.moveHistory, { row, col, player: myColor }];

    setRoom({
      ...room,
      board: newBoard,
      lastMove: newLastMove,
      moveCount: newMoveCount,
      currentPlayer: nextPlayer,
      moveHistory: newMoveHistory,
    });
    setAiThinking(true);
    setOpponentAnalysis(null);

    try {
      const res = await gomoku.gomokuApi.soloMove({
        roomCode,
        playerId,
        row,
        col,
      });
      if (res.valid) {
        if (res.aiThinking) {
          // AI is thinking in background — keep optimistic state, polling will update
          // Sync with server state in case there are any differences
          setRoom(res.room);
        } else {
          // Game ended (win/draw) — use server state directly
          setRoom(res.room);
          setAiThinking(false);
        }
        // Handle opponent analysis with delay
        if (res.opponentAnalysis && showOpponentThought) {
          if (opponentTimerRef.current !== null) {
            clearTimeout(opponentTimerRef.current);
          }
          setOpponentAnalysis(null);
          opponentTimerRef.current = window.setTimeout(() => {
            setOpponentAnalysis(res.opponentAnalysis!);
            opponentTimerRef.current = null;
          }, 600);
        }
      } else {
        // Invalid move — rollback optimistic update
        setRoom(res.room || prevRoom);
        setAiThinking(false);
        toast.error(res.message || '落子无效');
      }
    } catch (error: unknown) {
      logger.error('落子失败', error);
      try {
        const latest = (await gomoku.gomokuApi.getSoloRoom(roomCode)).room;
        setRoom(latest);
        const aiColor = latest.currentPlayer;
        setAiThinking(latest.status === 'playing' && (aiColor === 'black' ? latest.blackPlayer : latest.whitePlayer) === `ai_${aiColor}`);
        const saved = latest.moveHistory[prevRoom.moveCount];
        if (saved?.row === row && saved?.col === col && saved?.player === myColor) toast.success('落子已同步');
        else toast.error('落子未成功，请重试');
      } catch {
        setRoom(prevRoom);
        setAiThinking(false);
        toast.error('连接中断，请稍后重试');
      }
    } finally {
      moveSubmittingRef.current = false;
    }
  };

  const handleUndo = async () => {
    if (!roomCode || !room) return;
    if (room.status !== 'playing' && room.status !== 'ended') return;
    if (room.moveCount === 0) return;
    if (undoing || aiThinking || hintLoading) return;

    // Clear auto-play timer
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    // Clear opponent analysis timer
    if (opponentTimerRef.current !== null) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    // Clear continuous hint timer
    if (continuousHintRef.current !== null) {
      clearTimeout(continuousHintRef.current);
      continuousHintRef.current = null;
    }
    // Clear AI polling timer
    if (aiPollTimerRef.current !== null) {
      clearInterval(aiPollTimerRef.current);
      aiPollTimerRef.current = null;
    }
    setAiThinking(false);

    setUndoing(true);
    setOpponentAnalysis(null);
    setHighlightCell(null);
    setHintMove(null);
    setHintAnalysis(null);
    setHintWinRate(null);
    try {
      const res = await gomoku.gomokuApi.soloUndo({ roomCode, playerId });
      if (res.success) {
        setRoom(res.room);
        toast.success('已悔棋');
      } else {
        toast.error(res.message || '悔棋失败');
      }
    } catch (error: unknown) {
      logger.error('悔棋失败', error);
      toast.error('悔棋失败，请重试');
    } finally {
      setUndoing(false);
    }
  };

  const handleHint = async () => {
    if (!roomCode || !isMyTurn || !room || room.status !== 'playing') return;
    if (aiThinking || hintLoading) return;

    analyzedMoveCountRef.current = room.moveCount;
    setHintLoading(true);
    try {
      const res = await gomoku.gomokuApi.soloAiHint({ roomCode, playerId, difficulty: room.aiDifficulty ?? undefined });
      if (res.valid && res.hint) {
        setHintMove(res.hint);
        setHintAnalysis(res.analysis || null);
        setHintWinRate(res.winRate || null);
      } else {
        toast.error(res.message || '获取提示失败');
      }
    } catch (error: unknown) {
      logger.error('获取AI提示失败', error);
      toast.error('获取AI提示失败，请重试');
    } finally {
      setHintLoading(false);
    }
  };

  const handleAiMove = async () => {
    if (!roomCode || !isMyTurn || !room || room.status !== 'playing') return;
    if (aiThinking) return;

    setAiThinking(true);
    try {
      const res = await gomoku.gomokuApi.soloAiMove({ roomCode, playerId, difficulty: room.aiDifficulty ?? undefined });
      if (res.valid) {
        setRoom(res.room);
        // Handle opponent analysis with delay
        if (res.opponentAnalysis && showOpponentThought) {
          if (opponentTimerRef.current !== null) {
            clearTimeout(opponentTimerRef.current);
          }
          opponentTimerRef.current = window.setTimeout(() => {
            setOpponentAnalysis(res.opponentAnalysis!);
            opponentTimerRef.current = null;
          }, 600);
        } else {
          setOpponentAnalysis(null);
        }
      } else {
        toast.error(res.message || 'AI 落子失败');
      }
    } catch (error: unknown) {
      logger.error('AI 落子失败', error);
      toast.error('AI 落子失败，请重试');
    } finally {
      setAiThinking(false);
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    }
  };

  const handleRestart = async () => {
    if (!roomCode) return;
    // Clear all timers
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (opponentTimerRef.current !== null) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (continuousHintRef.current !== null) {
      clearTimeout(continuousHintRef.current);
      continuousHintRef.current = null;
    }
    if (aiPollTimerRef.current !== null) {
      clearInterval(aiPollTimerRef.current);
      aiPollTimerRef.current = null;
    }
     setAiThinking(false);
     analyzedMoveCountRef.current = -1;
     setHintMove(null);
     setHintAnalysis(null);
     setHintWinRate(null);
     setOpponentAnalysis(null);
     setHighlightCell(null);
     setShowEndDialog(false);
     setWinRate(null);
     setWinRateLoading(false);
     if (winRateTimerRef.current !== null) {
       clearTimeout(winRateTimerRef.current);
       winRateTimerRef.current = null;
     }
     try {
       const res = await gomoku.gomokuApi.soloRestart({ roomCode, playerId });
       setRoom(res.room);
       toast.success('已重新开始');
     } catch (error: unknown) {
       logger.error('重新开始失败', error);
       toast.error('重新开始失败');
     }
   };

  const handleCloseEndDialog = () => {
    setShowEndDialog(false);
  };

  const handleDifficultyChange = async (newDiff: AiDifficulty) => {
    if (!room || !myColor) return;
    if (room.aiDifficulty === newDiff) return;
    setSwitchingDifficulty(true);
    try {
      const res = await gomoku.gomokuApi.changeSoloDifficulty({ roomCode, playerId, difficulty: newDiff });
      setRoom(res.room);
      toast.success('难度已切换，当前棋局继续');
    } catch (error: unknown) {
      logger.error('切换难度失败', error);
      toast.error('切换难度失败，请重试');
    } finally {
      setSwitchingDifficulty(false);
    }
  };

  const handleLeave = () => {
    setShowEndDialog(false);
    navigate('/');
  };

  const handleSaveKifu = () => {
    if (!room) return;
    if (isKifuFull()) {
      toast.error('棋谱已达上限，请先清理旧棋谱');
      return;
    }
    const result: GameResult = room.winner || (room.moveCount >= 225 ? 'draw' : 'unknown');
    const diffStr = room.aiDifficulty || 'hard';
    const record = saveKifu({
      name: generateDefaultName('solo', result),
      mode: 'solo',
      result,
      moves: room.moveHistory.map((m: MoveWithPlayer) => ({
        row: m.row,
        col: m.col,
        player: m.player,
      })),
      moveCount: room.moveCount,
      blackPlayer: room.blackPlayer === playerId ? '我（黑）' : 'AI',
      whitePlayer: room.whitePlayer === playerId ? '我（白）' : 'AI',
      difficulty: diffStr,
    });
    setShowEndDialog(false);
    toast.success('棋谱已保存');
    navigate(`/kifu/${record.id}`);
  };

  const canUndo =
    room &&
    (room.status === 'playing' || room.status === 'ended') &&
    myColor &&
    room.moveCount > 0;

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'hsl(var(--background))' }}
      >
        <div className="text-lg text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: 'hsl(var(--background))' }}
      >
        <div className="text-center space-y-4">
          <p className="text-lg text-foreground">游戏不存在</p>
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            className="rounded-xl h-11 border-border"
          >
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const aiColor: PlayerColor | null = myColor === 'black' ? 'white' : myColor === 'white' ? 'black' : null;
  const isBlackTurn = room.currentPlayer === 'black';
  const turnLabel = room.status === 'playing'
    ? (isBlackTurn ? '黑方回合' : '白方回合')
    : room.winner
      ? (room.winner === 'black' ? '黑方胜' : '白方胜')
      : '平局';

  const getAiDifficultyLabel = (diff: AiDifficulty | null | undefined): string => {
    if (!diff) return '';
    const map: Record<AiDifficulty, string> = {
      easy: '简单',
      normal: '普通',
      hard: '困难',
      hell: '地狱',
      godlike: '神仙',
    };
    return map[diff] || '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen w-full bg-background"
    >
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5">
        {/* Top HUD Bar */}
        <div
          className="sticky top-0 z-20 py-3 bg-card/70 backdrop-blur-md border-b border-border"
        >
          <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
            {/* Left: back + my info */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLeave}
                aria-label="返回"
                className="h-9 w-9 rounded-lg text-muted-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 border"
                  style={{
                    borderColor: myColor === 'black' ? '#1a1a1a' : '#d9ccb8',
                    ...pieceStyle(myColor || 'black'),
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">
                    你
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {myColor === 'black' ? '执黑' : '执白'}
                  </p>
                </div>
              </div>
            </div>

            {/* Center: turn indicator */}
            <div className="flex flex-col items-center">
              <motion.div
                key={room.currentPlayer + room.status}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="flex items-center gap-1.5"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background:
                      isBlackTurn
                        ? 'radial-gradient(circle at 30% 30%, #4a4a4a, #1a1a1a 70%)'
                        : 'radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0 70%)',
                  }}
                />
                <span
                  className="text-xs font-medium text-foreground"
                >
                  {turnLabel}
                </span>
              </motion.div>
              {room.status === 'playing' && (
                <p className="text-xs mt-1" style={{ color: isMyTurn ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                  {isMyTurn ? '轮到你落子' : 'AI 思考中...'}
                </p>
              )}
            </div>

            {/* Right: opponent info */}
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 border"
                  style={{
                    borderColor: aiColor === 'black' ? '#1a1a1a' : '#d9ccb8',
                    ...pieceStyle(aiColor || 'white'),
                  }}
                />
                <div className="min-w-0 text-right">
                  <p className="text-sm font-medium truncate text-foreground">
                    AI 对手
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {aiColor === 'black' ? '执黑' : '执白'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Title row */}
          <div className="max-w-xl mx-auto flex items-center justify-center gap-2 mt-2">
            <Badge
              variant="outline"
              className="text-[10px] h-5 gap-1 bg-card border-border text-muted-foreground"
            >
              <Bot className="w-3 h-3" />
              {getAiDifficultyLabel(room.aiDifficulty)}难度
            </Badge>
             <span className="text-xs text-muted-foreground/70">
              单人模式
            </span>
          </div>
        </div>

        {showWinRate && room.moveCount > 0 && (
          <div className="rounded-2xl p-4 border bg-card border-border">
            <WinRateBar winRate={winRate} loading={winRateLoading} />
          </div>
        )}

        <div className={`flex justify-center relative py-2 ${showCoordinates ? 'px-4 pb-8 sm:px-6' : ''}`}>
          <GomokuBoard
            board={room.board}
            lastMove={room.lastMove}
            winningLine={room.winningLine}
            onCellClick={handleCellClick}
            disabled={!isMyTurn || aiThinking || hintLoading || undoing}
            currentPlayer={myColor || 'black'}
            hintMove={hintMove}
            showCoordinates={showCoordinates}
            highlightCell={highlightCell}
          />
        </div>

        {/* AI controls card */}
         <div
           className="rounded-2xl p-5 space-y-5 border bg-card border-border"
         >
           {/* Title */}
           <div className="flex items-center gap-2">
             <Brain className="w-5 h-5 text-primary" />
             <h3 className="font-semibold text-base text-foreground">
               AI 助手
             </h3>
           </div>

           {/* Action buttons row */}
           <div className="flex items-center flex-wrap gap-2">
             <Button
               variant="outline"
               onClick={handleHint}
               disabled={!isMyTurn || room.status !== 'playing' || hintLoading || aiThinking}
               className="gap-2 min-h-10 text-sm px-4 rounded-xl border-border bg-background text-foreground"
             >
               <Lightbulb className="w-4 h-4" />
               {hintLoading ? '提示中...' : 'AI提示'}
             </Button>
             <Button
               variant="outline"
               onClick={handleAiMove}
               disabled={!isMyTurn || room.status !== 'playing' || aiThinking}
               className="gap-2 min-h-10 text-sm px-4 rounded-xl border-border bg-background text-foreground"
             >
               <Sparkles className="w-4 h-4" />
               {aiThinking ? 'AI 思考中...' : 'AI落子'}
             </Button>
           </div>

           {/* Switches grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="flex items-center justify-between gap-3">
               <div className="flex items-center gap-2">
                 <Lightbulb className="w-4 h-4 shrink-0 text-primary" />
                 <div>
                 <p className="text-sm font-medium text-foreground">
                   持续提示
                 </p>
                 <p className="text-xs text-muted-foreground/70">
                   每步自动分析最佳落子
                 </p>
                 </div>
               </div>
               <Switch
                 checked={continuousHintEnabled}
                 onCheckedChange={handleContinuousHintToggle}
               />
             </div>
             <div className="flex items-center justify-between gap-3">
               <div className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 shrink-0 text-primary" />
                 <div>
                 <p className="text-sm font-medium text-foreground">
                   全自动 AI
                 </p>
                 <p className="text-xs text-muted-foreground/70">
                   轮到你时AI自动落子
                 </p>
                 </div>
               </div>
               <Switch
                 checked={autoPlayEnabled}
                 onCheckedChange={handleAutoPlayToggle}
               />
             </div>
             <div className="flex items-center justify-between gap-3">
               <div className="flex items-center gap-2">
                 <Grid3X3 className="w-4 h-4 shrink-0 text-primary" />
                 <div>
                 <p className="text-sm font-medium text-foreground">
                   显示坐标
                 </p>
                 <p className="text-xs text-muted-foreground/70">
                   棋盘边缘显示行列坐标
                 </p>
                 </div>
               </div>
               <Switch
                 checked={showCoordinates}
                 onCheckedChange={handleShowCoordinatesToggle}
               />
             </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 shrink-0 text-primary" />
                  <div>
                  <p className="text-sm font-medium text-foreground">
                    对方思路
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    显示AI对手落子分析
                  </p>
                  </div>
                </div>
                <Switch
                  checked={showOpponentThought}
                  onCheckedChange={handleShowOpponentToggle}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
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
                  onCheckedChange={handleShowWinRateToggle}
                />
              </div>
             <div className="col-span-1 sm:col-span-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
               <div>
                 <p className="text-sm font-medium text-foreground">
                   AI 难度
                 </p>
                 <p className="text-xs text-muted-foreground/70">
                   切换后从下一手起生效，保留当前棋局
                 </p>
               </div>
               <div className="grid w-full grid-cols-4 gap-2 sm:w-auto">
                 {(['easy', 'normal', 'hard', 'hell'] as AiDifficulty[]).map((diff: AiDifficulty) => (
                   <Button
                     key={diff}
                     type="button"
                     variant="outline"
                     size="sm"
                     onClick={() => handleDifficultyChange(diff)}
                     disabled={switchingDifficulty}
                     className="h-11 min-w-0 rounded-lg px-1 text-sm font-semibold sm:h-9 sm:px-2.5 sm:text-xs"
                     style={{
                       color: difficultyColor[diff],
                       borderColor: room.aiDifficulty === diff ? difficultyColor[diff] : 'var(--border)',
                       backgroundColor: room.aiDifficulty === diff
                         ? `color-mix(in srgb, ${difficultyColor[diff]} 14%, var(--card))`
                         : 'var(--background)',
                     }}
                   >
                     {diff === 'easy' ? '简单' : diff === 'normal' ? '普通' : diff === 'hard' ? '困难' : '地狱'}
                   </Button>
                 ))}
               </div>
             </div>
            </div>
         </div>

        {/* AI hint win rate (compact) */}
        {hintWinRate && (
          <div className="rounded-2xl p-4 border bg-card border-border">
            <WinRateBar winRate={hintWinRate} compact />
          </div>
        )}

        {/* AI analysis panel */}
        <AiAnalysisPanel
          analysis={hintAnalysis}
          loading={hintLoading}
          hintMove={hintMove}
          onCoordinateClick={handleCoordinateClick}
        />

        {/* Opponent thought panel */}
        <AnimatePresence>
          {showOpponentThought && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <AiAnalysisPanel
                analysis={opponentAnalysis}
                variant="opponent"
                hintMove={room?.lastMove && opponentAnalysis ? room.lastMove : null}
                onCoordinateClick={handleCoordinateClick}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom action buttons */}
        <div
          className="flex items-center justify-center gap-3 pt-2 flex-wrap"
        >
          <Button
            variant="outline"
            onClick={handleUndo}
            disabled={!canUndo || undoing || aiThinking}
            className="gap-2 min-h-11 text-base px-4 rounded-xl border-border bg-card text-foreground"
          >
            <Undo2 className="w-4 h-4" />
            {undoing ? '悔棋中...' : '悔棋'}
          </Button>
          <Button
            variant="outline"
            onClick={handleRestart}
            disabled={aiThinking || hintLoading}
            className="gap-2 min-h-11 text-base px-4 rounded-xl border-border bg-card text-foreground"
          >
            <RotateCcw className="w-4 h-4" />
            重新开始
          </Button>
          <Button
            variant="outline"
            onClick={handleLeave}
            className="gap-2 min-h-11 text-base px-4 rounded-xl border-border bg-card text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Button>
        </div>

        <GameEndDialog
          open={showEndDialog}
          winner={room?.winner ?? null}
          myColor={myColor}
          onRestart={handleRestart}
          onLeave={handleLeave}
          onClose={handleCloseEndDialog}
          onSaveKifu={handleSaveKifu}
        />
      </div>
    </motion.div>
  );
};

export default SoloPage;
