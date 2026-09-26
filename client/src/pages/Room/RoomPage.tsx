import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Copy, RotateCcw, ArrowLeft, Undo2, Sparkles, Lightbulb, Bot, Eye, Brain, MessageCircle, Send, Loader2 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import GomokuBoard from '@client/src/components/GomokuBoard';
import GameEndDialog from './GameEndDialog';
import HiddenAiPanel from './HiddenAiPanel';
import AiAnalysisPanel from './AiAnalysisPanel';
import WinRateBar from '@client/src/components/ui/WinRateBar';
import { Switch } from '@client/src/components/ui/switch';
import { Input } from '@client/src/components/ui/input';
import { gomoku } from '@client/src/api';
import type {
    GomokuRoom,
    PlayerColor,
    Move,
    MoveWithPlayer,
    AiHintAnalysis,
    AiDifficulty,
    AiThinkingStrength,
    WatchAnalysisResponse,
    ChatMessage,
    WinRateInfo,
  } from '@shared/api.interface';
import { saveKifu, generateDefaultName, isKifuFull } from '@client/src/utils/kifu';
import type { GameResult } from '@client/src/utils/kifu';

const PLAYER_ID_KEY = 'gomoku_player_id';
const AI_SETTINGS_KEY = 'gomoku_ai_settings';
const SHOW_WINRATE_KEY = 'gomoku_show_winrate';
const POLL_INTERVAL = 2000;
const CHAT_POLL_INTERVAL = 2000;
const SECRET_CLICK_WINDOW = 2000;
const SECRET_CLICK_TARGET = 5;
const OPPONENT_TIMEOUT_MS = 30000;
const AI_PLAYER_PREFIX = 'ai_';

interface AiTierSettings {
  hintEnabled: boolean;
  autoPlayEnabled: boolean;
  showWinRate: boolean;
  thinkingStrength?: AiThinkingStrength;
}

interface AiSettings {
  pro: AiTierSettings;
  godlike: AiTierSettings;
  activeTier: 'pro' | 'godlike';
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  pro: { hintEnabled: false, autoPlayEnabled: false, showWinRate: true },
  godlike: { hintEnabled: false, autoPlayEnabled: false, showWinRate: false, thinkingStrength: 'medium' },
  activeTier: 'pro',
};

function isOldFormat(data: Record<string, unknown>): boolean {
  return 'hintEnabled' in data || 'autoPlayEnabled' in data || 'showWinRate' in data || 'tier' in data;
}

function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Migrate old flat format to new two-tier structure
    if (isOldFormat(parsed)) {
      const oldHint = Boolean(parsed.hintEnabled);
      const oldAuto = Boolean(parsed.autoPlayEnabled);
      const oldWinRate = parsed.showWinRate !== false;
      const oldTier = parsed.tier === 'godlike' ? 'godlike' : 'pro';
      const migrated: AiSettings = {
        pro: { hintEnabled: oldHint, autoPlayEnabled: oldHint && oldAuto, showWinRate: oldWinRate },
        godlike: { hintEnabled: false, autoPlayEnabled: false, showWinRate: false, thinkingStrength: 'medium' },
        activeTier: oldTier,
      };
      saveAiSettings(migrated);
      return migrated;
    }

    return {
      pro: {
        hintEnabled: Boolean((parsed.pro as Record<string, unknown> | undefined)?.hintEnabled),
        autoPlayEnabled: Boolean((parsed.pro as Record<string, unknown> | undefined)?.hintEnabled)
          && Boolean((parsed.pro as Record<string, unknown> | undefined)?.autoPlayEnabled),
        showWinRate: (parsed.pro as Record<string, unknown> | undefined)?.showWinRate !== false,
      },
      godlike: {
        hintEnabled: Boolean((parsed.godlike as Record<string, unknown> | undefined)?.hintEnabled),
        autoPlayEnabled: Boolean((parsed.godlike as Record<string, unknown> | undefined)?.hintEnabled)
          && Boolean((parsed.godlike as Record<string, unknown> | undefined)?.autoPlayEnabled),
        showWinRate: Boolean((parsed.godlike as Record<string, unknown> | undefined)?.showWinRate),
        thinkingStrength: ['low', 'medium', 'high'].includes(String((parsed.godlike as Record<string, unknown> | undefined)?.thinkingStrength))
          ? (parsed.godlike as { thinkingStrength: AiThinkingStrength }).thinkingStrength
          : 'medium',
      },
      activeTier: parsed.activeTier === 'godlike' ? 'godlike' : 'pro',
    };
  } catch (error: unknown) {
    logger.error('读取AI设置失败', error);
    return DEFAULT_AI_SETTINGS;
  }
}

function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error: unknown) {
    logger.error('保存AI设置失败', error);
  }
}

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

const pieceStyle = (color: 'black' | 'white'): React.CSSProperties => ({
  background:
    color === 'black'
      ? 'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)'
      : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset -1px -1px 3px rgba(0,0,0,0.15)',
});

const RoomPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const playerIdRef = useRef<string>(getPlayerId());
  const [room, setRoom] = useState<GomokuRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimisticBoard, setOptimisticBoard] = useState<string[][] | null>(null);
  const [optimisticLastMove, setOptimisticLastMove] = useState<Move | null>(null);
  const [undoRequesting, setUndoRequesting] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [undoResponding, setUndoResponding] = useState(false);
  const [restartRequesting, setRestartRequesting] = useState(false);
  const [restartResponding, setRestartResponding] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endWinner, setEndWinner] = useState<PlayerColor | null>(null);
   const [hintAnalysis, setHintAnalysis] = useState<AiHintAnalysis | null>(null);
   const [hintWinRate, setHintWinRate] = useState<WinRateInfo | null>(null);

  // Watch mode
  const [searchParams] = useSearchParams();
  const explicitWatchMode = searchParams.get('mode') === 'watch';
  const isWatchMode = explicitWatchMode || !!(room && room.blackPlayer !== playerIdRef.current && room.whitePlayer !== playerIdRef.current);

   // Watch analysis
   const [watchAnalysisData, setWatchAnalysisData] = useState<WatchAnalysisResponse | null>(null);
   const [watchAnalyzing, setWatchAnalyzing] = useState(false);

   // Win rate
   const [winRate, setWinRate] = useState<WinRateInfo | null>(null);
   const [winRateLoading, setWinRateLoading] = useState(false);
  const winRateTimerRef = useRef<number | null>(null);
  const lastWinRateMoveRef = useRef<number>(-1);
  const optimisticMoveCountRef = useRef<number>(-1);
  const isFetchingRoomRef = useRef(false);
  const moveSubmittingRef = useRef(false);
  const roomRevisionRef = useRef(0);
  const isFetchingChatRef = useRef(false);

   // Chat
   const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
   const [chatOpen, setChatOpen] = useState(false);
   const [chatInput, setChatInput] = useState('');
   const [chatUnread, setChatUnread] = useState(0);
   const [chatSending, setChatSending] = useState(false);
   const chatPollRef = useRef<number | null>(null);
    const lastChatTimeRef = useRef<string>('');
   const chatListRef = useRef<HTMLDivElement>(null);

  // Disconnect detection
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const lastMoveChangeRef = useRef<number>(Date.now());
  const lastLastMoveRef = useRef<string>('');

  // AI substitute
  const [aiSubLoading, setAiSubLoading] = useState(false);

  // AI hint cache for move reuse (keyed by moveCount)
  const aiHintCacheRef = useRef<{
    moveCount: number;
    bestMove: Move;
    analysis: AiHintAnalysis;
  } | null>(null);

  // Hidden AI settings
  const [aiSettings, setAiSettings] = useState<AiSettings>(loadAiSettings);
  const [showSecretPanel, setShowSecretPanel] = useState(false);
  const secretClicksRef = useRef<number[]>([]);
  const autoTimerRef = useRef<number | null>(null);

  const godlikeActive =
    aiSettings.godlike.hintEnabled ||
    aiSettings.godlike.autoPlayEnabled ||
    aiSettings.godlike.showWinRate;

  const effectiveAiSettings: AiTierSettings = godlikeActive
    ? aiSettings.godlike
    : aiSettings.pro;

  const notifiedUndoStatusRef = useRef<string | null>(null);
  const notifiedRestartStatusRef = useRef<string | null>(null);
  const prevRoomRef = useRef<GomokuRoom | null>(null);
  const pollingRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const playerId = playerIdRef.current;

   const fetchRoom = useCallback(async (autoJoin = false) => {
     if (!roomCode) return;
     if (isFetchingRoomRef.current || moveSubmittingRef.current) return;
     isFetchingRoomRef.current = true;
     const revision = roomRevisionRef.current;
     try {
       const res = await gomoku.gomokuApi.getRoom(roomCode);
       let nextRoom = res.room;
       if (autoJoin && !explicitWatchMode && !nextRoom.aiDifficulty
         && nextRoom.status === 'waiting'
         && nextRoom.blackPlayer !== playerId && nextRoom.whitePlayer !== playerId
         && (!nextRoom.blackPlayer || !nextRoom.whitePlayer)) {
         try {
           nextRoom = (await gomoku.gomokuApi.joinRoom({ roomCode, playerId })).room;
         } catch (error: unknown) {
           logger.error('自动加入房间失败', error);
           nextRoom = (await gomoku.gomokuApi.getRoom(roomCode)).room;
         }
       }
       if (!mountedRef.current || moveSubmittingRef.current || revision !== roomRevisionRef.current) return;
       setRoom(nextRoom);
       if (optimisticMoveCountRef.current >= 0 && nextRoom.moveCount >= optimisticMoveCountRef.current) {
         setOptimisticBoard(null);
         setOptimisticLastMove(null);
         optimisticMoveCountRef.current = -1;
       } else if (optimisticMoveCountRef.current === -1) {
         setOptimisticBoard(null);
         setOptimisticLastMove(null);
       }
     } catch (error: unknown) {
       if (!mountedRef.current) return;
       logger.error('获取房间状态失败', error);
     } finally {
       isFetchingRoomRef.current = false;
     }
   }, [roomCode, explicitWatchMode, playerId]);

   const fetchWinRate = useCallback(async () => {
     if (!roomCode || !effectiveAiSettings.showWinRate) return;
     setWinRateLoading(true);
     try {
       const res = await gomoku.gomokuApi.getWinRate(roomCode);
       if (!mountedRef.current) return;
       if (res.valid) {
         setWinRate(res.winRate);
       }
     } catch (error: unknown) {
       if (!mountedRef.current) return;
       logger.error('获取胜率失败', error);
     } finally {
       if (mountedRef.current) {
         setWinRateLoading(false);
       }
     }
   }, [roomCode, effectiveAiSettings.showWinRate]);

  useEffect(() => {
     if (!roomCode) return;

     let mounted = true;
     mountedRef.current = true;
     const load = async () => {
       await fetchRoom(true);
       if (mounted && mountedRef.current) setLoading(false);
     };
     load();

     pollingRef.current = window.setInterval(() => {
       fetchRoom();
     }, POLL_INTERVAL);

     return () => {
       mounted = false;
       mountedRef.current = false;
       if (pollingRef.current) {
         clearInterval(pollingRef.current);
         pollingRef.current = null;
       }
     };
   }, [roomCode, fetchRoom]);

   const myColor: PlayerColor | null = isWatchMode
     ? null
     : room
       ? room.blackPlayer === playerId
         ? 'black'
         : room.whitePlayer === playerId
           ? 'white'
           : null
       : null;

  const isMyTurn =
    room && myColor && room.status === 'playing' && room.currentPlayer === myColor;

   const opponentColor: PlayerColor | null = myColor === 'black' ? 'white' : myColor === 'white' ? 'black' : null;

   const fetchChat = useCallback(async () => {
     if (!roomCode) return;
     if (!isWatchMode && !myColor) return;
     if (isFetchingChatRef.current) return;
     isFetchingChatRef.current = true;
     try {
       const res = await gomoku.gomokuApi.getChat(roomCode, lastChatTimeRef.current || undefined);
       if (!mountedRef.current) return;
       if (res.valid && res.messages.length > 0) {
         const newMsgs = res.messages;
         setChatMessages((prev: ChatMessage[]) => {
           const existingIds = new Set(prev.map((m: ChatMessage) => m.id));
           const unique = newMsgs.filter((m: ChatMessage) => !existingIds.has(m.id));
           if (unique.length === 0) return prev;
           const merged = [...prev, ...unique];
           merged.sort((a: ChatMessage, b: ChatMessage) =>
             new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
           );
           return merged;
         });
         const lastMsg = newMsgs[newMsgs.length - 1];
         if (lastMsg) lastChatTimeRef.current = lastMsg.createdAt;
         if (!chatOpen) {
           const newPlayerMsgs = newMsgs.filter(
             (m: ChatMessage) => m.msgType === 'player' && m.senderId !== playerId,
           ).length;
           if (newPlayerMsgs > 0) {
             setChatUnread((prev: number) => prev + newPlayerMsgs);
           }
         }
       }
     } catch (error: unknown) {
       if (!mountedRef.current) return;
       logger.error('获取聊天消息失败', error);
     } finally {
       isFetchingChatRef.current = false;
     }
   }, [roomCode, isWatchMode, myColor, chatOpen, playerId]);

    const isRoomOwner = room?.blackPlayer === playerId && !isWatchMode;

   const isAiPlayer = (playerIdVal: string | null): boolean => {
     return !!playerIdVal && playerIdVal.startsWith(AI_PLAYER_PREFIX);
   };

   const getAiDifficultyLabel = (difficulty?: AiDifficulty | string | null): string => {
     if (!difficulty) return 'AI';
     const map: Record<string, string> = {
       easy: '简单',
       normal: '普通',
       hard: '困难',
       hell: '地狱',
     };
     return map[difficulty] || 'AI';
   };

   const aiOpponentColor: PlayerColor | null = (() => {
     if (!room) return null;
     if (isAiPlayer(room.blackPlayer)) return 'black';
     if (isAiPlayer(room.whitePlayer)) return 'white';
     return null;
   })();

   const hasAiOpponent = !!aiOpponentColor;

  const isUndoRequester = room?.undoRequestBy === myColor;
  const isUndoResponder = room?.undoRequestBy === opponentColor && room?.undoRequestStatus === 'pending';
  const isRestartRequester = room?.restartRequestBy === myColor;
  const isRestartResponder = room?.restartRequestBy === opponentColor && room?.restartRequestStatus === 'pending';

  useEffect(() => {
    if (!room) return;
    const status = room.undoRequestStatus;
    if (!status) {
      notifiedUndoStatusRef.current = null;
      return;
    }
    if (notifiedUndoStatusRef.current === status) return;
    notifiedUndoStatusRef.current = status;

    if (status === 'accepted' && isUndoRequester && !hasAiOpponent) {
      toast.success('对方同意了悔棋');
    } else if (status === 'rejected' && isUndoRequester) {
      toast.error('对方拒绝了悔棋请求');
    }
  }, [room, isUndoRequester, hasAiOpponent]);

   useEffect(() => {
     if (isUndoResponder) {
       setShowUndoDialog(true);
     } else {
       setShowUndoDialog(false);
     }
   }, [isUndoResponder]);

  useEffect(() => {
    if (isRestartResponder) {
      setShowEndDialog(false);
      setShowRestartDialog(true);
    }
    else setShowRestartDialog(false);
  }, [isRestartResponder]);

  useEffect(() => {
    const status = room?.restartRequestStatus;
    if (!status || status === 'pending') {
      notifiedRestartStatusRef.current = null;
      return;
    }
    if (notifiedRestartStatusRef.current === status) return;
    notifiedRestartStatusRef.current = status;
    if (status === 'accepted') {
      setOptimisticBoard(null);
      setOptimisticLastMove(null);
      optimisticMoveCountRef.current = -1;
      setHintMove(null);
      setHintAnalysis(null);
      setHintWinRate(null);
      setWinRate(null);
      lastWinRateMoveRef.current = -1;
      aiHintCacheRef.current = null;
      setShowEndDialog(false);
      setEndWinner(null);
      if (autoTimerRef.current !== null) clearTimeout(autoTimerRef.current);
      if (winRateTimerRef.current !== null) clearTimeout(winRateTimerRef.current);
      if (isRestartRequester && !hasAiOpponent) toast.success('对方同意了重新开始');
    } else if (isRestartRequester) toast.error('对方拒绝或未响应重新开始请求');
  }, [room?.restartRequestStatus, isRestartRequester, hasAiOpponent]);

   // Game end dialog: show when status becomes 'ended'
   useEffect(() => {
     if (!room) return;
     const prev = prevRoomRef.current;
     if (room.status === 'ended' && prev?.status !== 'ended') {
       setEndWinner(room.winner);
       setShowEndDialog(true);
     }
     prevRoomRef.current = room;
   }, [room]);

   // Opponent left detection: playing -> waiting with player count drop
   useEffect(() => {
     if (!room) return;
     const prev = prevRoomRef.current;
     if (!prev) return;
     const hadTwoPlayers = prev.blackPlayer && prev.whitePlayer;
     const hasOnePlayer = !room.blackPlayer || !room.whitePlayer;
     if (prev.status === 'playing' && room.status === 'waiting' && hadTwoPlayers && hasOnePlayer) {
       toast.info('对方已离开房间');
     }
   }, [room]);

    // Clear hint / analysis after move / turn change
    useEffect(() => {
      if (room?.moveCount !== undefined) {
        setHintMove(null);
        setHintAnalysis(null);
      }
    }, [room?.moveCount, room?.currentPlayer]);

  // Win rate: update when move count changes (debounced)
  useEffect(() => {
    if (!effectiveAiSettings.showWinRate) return;
    if (!room || room.moveCount === 0) return;
    if (room.moveCount === lastWinRateMoveRef.current) return;
    lastWinRateMoveRef.current = room.moveCount;

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
  }, [room?.moveCount, effectiveAiSettings.showWinRate, isWatchMode, fetchWinRate, room]);

  // Chat polling
  useEffect(() => {
    if (!roomCode) return;
    if (!isWatchMode && !myColor) return;

    fetchChat();

    chatPollRef.current = window.setInterval(() => {
      fetchChat();
    }, CHAT_POLL_INTERVAL);

    return () => {
      if (chatPollRef.current !== null) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    };
  }, [roomCode, isWatchMode, myColor, fetchChat]);

  // Auto scroll chat to bottom when new messages arrive and panel is open
  useEffect(() => {
    if (chatOpen && chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages, chatOpen]);

  const handleChatToggle = () => {
    setChatOpen((prev: boolean) => {
      const next = !prev;
      if (next) {
        setChatUnread(0);
      }
      return next;
    });
  };

  const handleSendChat = useCallback(async () => {
    if (!roomCode || !myColor) return;
    const content = chatInput.trim();
    if (!content) return;
    if (content.length > 200) {
      toast.error('消息过长，最多 200 字');
      return;
    }

    setChatSending(true);
    try {
      const res = await gomoku.gomokuApi.sendChat({ roomCode, playerId, content });
      if (res.valid && res.chatMessage) {
        setChatInput('');
        setChatMessages((prev: ChatMessage[]) => {
          if (prev.some((m: ChatMessage) => m.id === res.chatMessage?.id)) return prev;
          return [...prev, res.chatMessage as ChatMessage];
        });
        setTimeout(() => fetchChat(), 300);
      } else {
        toast.error(res.message || '发送失败');
      }
    } catch (error: unknown) {
      logger.error('发送聊天消息失败', error);
      toast.error('发送失败，请重试');
    } finally {
      setChatSending(false);
    }
   }, [roomCode, myColor, chatInput, playerId, fetchChat]);

  const handleQuickPhrase = useCallback((phrase: string) => {
    if (!roomCode || !myColor || isWatchMode) return;
    setChatSending(true);
    gomoku.gomokuApi.sendChat({ roomCode, playerId, content: phrase })
      .then((res) => {
        if (res.valid && res.chatMessage) {
          setChatMessages((prev: ChatMessage[]) => {
            if (prev.some((m: ChatMessage) => m.id === res.chatMessage?.id)) return prev;
            return [...prev, res.chatMessage as ChatMessage];
          });
          setTimeout(() => fetchChat(), 300);
        } else {
          toast.error(res.message || '发送失败');
        }
      })
      .catch((error: unknown) => {
        logger.error('快捷短语发送失败', error);
        toast.error('发送失败');
      })
      .finally(() => {
        setChatSending(false);
      });
  }, [roomCode, myColor, playerId, isWatchMode, fetchChat]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const formatChatTime = (createdAt: string): string => {
    try {
      const d = new Date(createdAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return '';
    }
  };

  const isMyMessage = (msg: ChatMessage): boolean => {
    return msg.senderId === playerId;
  };

  const QUICK_PHRASES = ['你好', '加油', '下得不错', '悔棋吗？', '再来一局'];

   // Disconnect detection: track lastMove changes
    useEffect(() => {
      if (!room) return;
      const lastMoveKey = room.lastMove
        ? `${room.lastMove.row}-${room.lastMove.col}-${room.moveCount}`
        : 'none';
      if (lastMoveKey !== lastLastMoveRef.current) {
        lastLastMoveRef.current = lastMoveKey;
        lastMoveChangeRef.current = Date.now();
        setOpponentDisconnected(false);
      }
    }, [room?.lastMove, room?.moveCount, room]);

   // Check if opponent is disconnected (only for playing games with human opponent)
   useEffect(() => {
     if (!room || room.status !== 'playing') return;
     if (isWatchMode) return;
     if (!myColor || !opponentColor) return;
     if (room.currentPlayer !== opponentColor) return;

     const opponentId = opponentColor === 'black' ? room.blackPlayer : room.whitePlayer;
     if (isAiPlayer(opponentId)) return; // AI doesn't disconnect
     if (!opponentId) return;

      const check = () => {
        const elapsed = Date.now() - lastMoveChangeRef.current;
        if (elapsed > OPPONENT_TIMEOUT_MS) {
          setOpponentDisconnected(true);
        }
      };

     const timer = window.setInterval(check, 5000);
     check();

     return () => clearInterval(timer);
   }, [room, myColor, opponentColor, isWatchMode]);

   const currentTier = aiSettings.activeTier;

   useEffect(() => {
     // Clear any pending timer first
     if (autoTimerRef.current !== null) {
       clearTimeout(autoTimerRef.current);
       autoTimerRef.current = null;
     }

     if (!effectiveAiSettings.hintEnabled || !effectiveAiSettings.autoPlayEnabled) return;
    if (!room || room.status !== 'playing') return;
    if (!isMyTurn) return;
    if (optimisticBoard) return;
    if (aiThinking) return;

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
   }, [
     isMyTurn,
     room?.status,
     room?.moveCount,
     effectiveAiSettings.autoPlayEnabled,
     effectiveAiSettings.hintEnabled,
     optimisticBoard,
     aiThinking,
   ]);

  const handleSecretClick = useCallback(() => {
    const now = Date.now();
    const recent = secretClicksRef.current.filter(
      (t: number) => now - t <= SECRET_CLICK_WINDOW,
    );
    recent.push(now);
    secretClicksRef.current = recent;
    if (recent.length >= SECRET_CLICK_TARGET) {
      secretClicksRef.current = [];
      setShowSecretPanel(true);
    }
  }, []);
  const handleHintToggle = (enabled: boolean) => {
    const tier = currentTier;
    const tierSettings = aiSettings[tier];
    const newTierSettings: AiTierSettings = { ...tierSettings, hintEnabled: enabled, autoPlayEnabled: enabled && tierSettings.autoPlayEnabled };
    let newSettings: AiSettings = { ...aiSettings, [tier]: newTierSettings };

    // When turning on a godlike switch, auto-disable all pro switches
    if (tier === 'godlike' && enabled) {
      newSettings = {
        ...newSettings,
        pro: { hintEnabled: false, autoPlayEnabled: false, showWinRate: false },
      };
      setHintMove(null);
      setHintAnalysis(null);
    }

    setAiSettings(newSettings);
    saveAiSettings(newSettings);

    if (!enabled && tier === 'pro') {
      setHintMove(null);
      setHintAnalysis(null);
    }
  };

   const handleAutoPlayToggle = (enabled: boolean) => {
     const tier = currentTier;
     const tierSettings = aiSettings[tier];
     const newTierSettings: AiTierSettings = { ...tierSettings, autoPlayEnabled: enabled };
     let newSettings: AiSettings = { ...aiSettings, [tier]: newTierSettings };

     if (tier === 'godlike' && enabled) {
       newSettings = {
         ...newSettings,
         pro: { hintEnabled: false, autoPlayEnabled: false, showWinRate: false },
       };
       setHintMove(null);
       setHintAnalysis(null);
     }

     setAiSettings(newSettings);
     saveAiSettings(newSettings);

     if (!enabled && autoTimerRef.current !== null) {
       clearTimeout(autoTimerRef.current);
       autoTimerRef.current = null;
     }
   };

   const handleShowWinRateToggle = (enabled: boolean) => {
     const tier = currentTier;
     const tierSettings = aiSettings[tier];
     const newTierSettings: AiTierSettings = { ...tierSettings, showWinRate: enabled };
     let newSettings: AiSettings = { ...aiSettings, [tier]: newTierSettings };

     if (tier === 'godlike' && enabled) {
       newSettings = {
         ...newSettings,
         pro: { hintEnabled: false, autoPlayEnabled: false, showWinRate: false },
       };
     }

     setAiSettings(newSettings);
     saveAiSettings(newSettings);

     if (!enabled) {
       setWinRate(null);
       if (winRateTimerRef.current !== null) {
         clearTimeout(winRateTimerRef.current);
         winRateTimerRef.current = null;
       }
     }
   };

   const handleThinkingStrengthChange = (thinkingStrength: AiThinkingStrength) => {
     const newSettings: AiSettings = {
       ...aiSettings,
       godlike: { ...aiSettings.godlike, thinkingStrength },
     };
     setAiSettings(newSettings);
     saveAiSettings(newSettings);
     aiHintCacheRef.current = null;
     setHintMove(null);
     setHintAnalysis(null);
     setHintWinRate(null);
   };

   const handleUpgradeToGodlike = () => {
     const newSettings: AiSettings = {
       ...aiSettings,
       pro: { hintEnabled: false, autoPlayEnabled: false, showWinRate: false },
       activeTier: 'godlike',
     };
     setAiSettings(newSettings);
     saveAiSettings(newSettings);
     setHintMove(null);
     setHintAnalysis(null);
   };

   const handleDowngradeToPro = () => {
     const newSettings: AiSettings = {
       ...aiSettings,
       godlike: { ...aiSettings.godlike, hintEnabled: false, autoPlayEnabled: false, showWinRate: false },
       activeTier: 'pro',
     };
     setAiSettings(newSettings);
     saveAiSettings(newSettings);
     setHintMove(null);
     setHintAnalysis(null);
     if (autoTimerRef.current !== null) {
       clearTimeout(autoTimerRef.current);
       autoTimerRef.current = null;
     }
     if (winRateTimerRef.current !== null) {
       clearTimeout(winRateTimerRef.current);
       winRateTimerRef.current = null;
     }
     setWinRate(null);
   };

  const displayBoard = optimisticBoard || room?.board || [];
  const displayLastMove = optimisticLastMove || room?.lastMove || null;

   const handleCellClick = async (row: number, col: number) => {
      if (!room || !roomCode || !isMyTurn) return;
      if (room.board[row][col]) return;
      if (optimisticBoard || moveSubmittingRef.current) return;
      moveSubmittingRef.current = true;
      roomRevisionRef.current++;

     // Cancel pending auto-play — manual move takes priority
     if (autoTimerRef.current !== null) {
       clearTimeout(autoTimerRef.current);
       autoTimerRef.current = null;
     }

      const newBoard = room.board.map((r: string[]) => [...r]);
      newBoard[row][col] = myColor as string;
      optimisticMoveCountRef.current = room.moveCount + 1;
      setOptimisticBoard(newBoard);
      setOptimisticLastMove({ row, col });

     try {
       const res = await gomoku.gomokuApi.makeMove({
         roomCode,
         playerId,
         row,
         col,
       });
        if (!res.valid) {
          toast.error(res.message || '落子无效');
          if (res.room) setRoom(res.room);
          optimisticMoveCountRef.current = -1;
          setOptimisticBoard(null);
          setOptimisticLastMove(null);
        } else if (res.room) {
          roomRevisionRef.current++;
          setRoom(res.room);
          optimisticMoveCountRef.current = -1;
          setOptimisticBoard(null);
          setOptimisticLastMove(null);
          aiHintCacheRef.current = null;
        }
     } catch (error: unknown) {
       logger.error('落子失败', error);
       try {
         const latest = (await gomoku.gomokuApi.getRoom(roomCode)).room;
         roomRevisionRef.current++;
         setRoom(latest);
         const saved = latest.moveHistory[room.moveCount];
         toast[saved?.row === row && saved?.col === col && saved?.player === myColor ? 'success' : 'error'](
           saved?.row === row && saved?.col === col && saved?.player === myColor ? '落子已同步' : '落子未成功，请重试',
         );
       } catch {
         toast.error('连接中断，正在同步棋局');
       }
       optimisticMoveCountRef.current = -1;
       setOptimisticBoard(null);
       setOptimisticLastMove(null);
     } finally {
       moveSubmittingRef.current = false;
     }
   };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      toast.success('房间号已复制');
    } catch (error: unknown) {
      logger.error('复制失败', error);
      toast.error('复制失败');
    }
  };

  const handleRequestUndo = async () => {
    if (!roomCode || !room || (room.status !== 'playing' && room.status !== 'ended')) return;
    setUndoRequesting(true);
    try {
      const res = await gomoku.gomokuApi.undoRequest({ roomCode, playerId });
      if (res.success) {
        setRoom(res.room);
        toast.success(res.room.undoRequestStatus === 'accepted' ? '已悔棋' : '悔棋请求已发送，等待对方同意');
      } else {
        toast.error(res.message || '发送悔棋请求失败');
      }
    } catch (error: unknown) {
      logger.error('发送悔棋请求失败', error);
      toast.error('发送悔棋请求失败，请重试');
    } finally {
      setUndoRequesting(false);
    }
  };

  const handleRespondUndo = async (accept: boolean) => {
    if (!roomCode) return;
    setUndoResponding(true);
    try {
      const res = await gomoku.gomokuApi.undoRespond({ roomCode, playerId, accept });
      if (res.success) {
        setRoom(res.room);
        setOptimisticBoard(null);
        setOptimisticLastMove(null);
        if (accept) {
          toast.success('已同意悔棋');
        } else {
          toast.success('已拒绝悔棋请求');
        }
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (error: unknown) {
      logger.error('悔棋响应失败', error);
      toast.error('操作失败，请重试');
    } finally {
      setUndoResponding(false);
    }
  };

   const handleRequestHint = async () => {
     if (!roomCode || !isMyTurn || !room || room.status !== 'playing') return;
     const difficulty: AiDifficulty = godlikeActive ? 'godlike' : 'hell';
     setHintLoading(true);
     try {
       const res = await gomoku.gomokuApi.aiHint({ roomCode, playerId, difficulty, thinkingStrength: aiSettings.godlike.thinkingStrength });
        if (res.valid && res.hint) {
          setHintMove(res.hint);
          setHintAnalysis(res.analysis || null);
          setHintWinRate(res.winRate || null);
          // Cache hint result for reuse by aiMove / autoPlay
          if (res.analysis) {
            aiHintCacheRef.current = {
              moveCount: room.moveCount,
              bestMove: res.hint,
              analysis: res.analysis,
            };
          }
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

   const handleWatchAnalysis = async () => {
     if (!roomCode) return;
     setWatchAnalyzing(true);
     try {
       const res = await gomoku.gomokuApi.watchAnalysis({ roomCode });
       if (res.valid) {
         setWatchAnalysisData(res);
       } else {
         toast.error(res.message || '分析失败');
       }
     } catch (error: unknown) {
       logger.error('观战分析失败', error);
       toast.error('分析失败，请重试');
     } finally {
       setWatchAnalyzing(false);
     }
   };

   const handleAiSubstitute = async () => {
     if (!roomCode || !room || !opponentColor) return;
     setAiSubLoading(true);
     try {
       const res = await gomoku.gomokuApi.aiSubstitute({
         roomCode,
         playerId,
         targetColor: opponentColor,
         difficulty: 'hell',
       });
       if (res.success) {
         setRoom(res.room);
         setOpponentDisconnected(false);
         toast.success('AI 替补已激活');
       } else {
         toast.error(res.message || '召唤AI失败');
       }
     } catch (error: unknown) {
       logger.error('召唤AI替补失败', error);
       toast.error('召唤AI失败，请重试');
     } finally {
       setAiSubLoading(false);
     }
   };

   const handleRemoveAiSubstitute = async () => {
     if (!roomCode || !room || !opponentColor) return;
     setAiSubLoading(true);
     try {
       const res = await gomoku.gomokuApi.removeAiSubstitute({
         roomCode,
         playerId,
         targetColor: opponentColor,
       });
       if (res.success) {
         setRoom(res.room);
         toast.success('已移除AI替补');
       } else {
         toast.error(res.message || '移除AI失败');
       }
     } catch (error: unknown) {
       logger.error('移除AI替补失败', error);
       toast.error('移除AI失败，请重试');
     } finally {
       setAiSubLoading(false);
     }
   };

   const handleAiMove = async () => {
     if (!roomCode || !isMyTurn || !room || room.status !== 'playing') return;
     const difficulty: AiDifficulty = godlikeActive ? 'godlike' : 'hell';

     // Check AI hint cache first — reuse result if moveCount matches
      const cached = aiHintCacheRef.current;
      if (cached && cached.moveCount === room.moveCount) {
        setAiThinking(true);
        try {
          const { row, col } = cached.bestMove;
          const newBoard = room.board.map((r: string[]) => [...r]);
          newBoard[row][col] = myColor as string;
          optimisticMoveCountRef.current = room.moveCount + 1;
          setOptimisticBoard(newBoard);
          setOptimisticLastMove({ row, col });
          const res = await gomoku.gomokuApi.makeMove({ roomCode, playerId, row, col });
          if (res.valid && res.room) {
            setRoom(res.room);
            setOptimisticBoard(null);
            setOptimisticLastMove(null);
            optimisticMoveCountRef.current = -1;
            aiHintCacheRef.current = null;
            toast.success('AI 已落子');
          } else {
           toast.error(res.message || 'AI 落子失败');
         }
       } catch (error: unknown) {
         logger.error('AI 落子失败（缓存）', error);
         toast.error('AI 落子失败，请重试');
       } finally {
         setAiThinking(false);
         if (autoTimerRef.current !== null) {
           clearTimeout(autoTimerRef.current);
           autoTimerRef.current = null;
         }
       }
       return;
     }

     setAiThinking(true);
     try {
       const res = await gomoku.gomokuApi.aiMove({ roomCode, playerId, difficulty, thinkingStrength: aiSettings.godlike.thinkingStrength });
       if (res.valid) {
         setRoom(res.room);
         setOptimisticBoard(null);
         setOptimisticLastMove(null);
         toast.success('AI 已落子');
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
     if (!roomCode || restartRequesting) return;
     setRestartRequesting(true);
     try {
       const res = await gomoku.gomokuApi.restart({ roomCode, playerId });
       setRoom(res.room);
       if (res.success) {
         setShowEndDialog(false);
         toast.success(res.room.restartRequestStatus === 'accepted' ? '已重新开始' : '已发送重新开始请求，等待对方同意');
       } else toast.error(res.message || '请求重新开始失败');
     } catch (error: unknown) {
       logger.error('重新开始失败', error);
       toast.error('重新开始失败');
     } finally {
       setRestartRequesting(false);
     }
   };

  const handleRespondRestart = async (accept: boolean) => {
    if (!roomCode || restartResponding) return;
    setRestartResponding(true);
    try {
      const res = await gomoku.gomokuApi.restartRespond({ roomCode, playerId, accept });
      setRoom(res.room);
      if (res.success) toast.success(accept ? '已同意重新开始' : '已拒绝重新开始');
      else toast.error(res.message || '操作失败');
    } catch (error: unknown) {
      logger.error('重新开始响应失败', error);
      toast.error('操作失败，请重试');
    } finally {
      setRestartResponding(false);
    }
  };

    const handleLeave = async () => {
     if (!roomCode) return;
     setShowEndDialog(false);
     try {
       await gomoku.gomokuApi.leave({ roomCode, playerId });
     } catch (error: unknown) {
       logger.error('离开房间失败', error);
     }
     navigate('/');
   };

   const handleSaveKifu = () => {
     if (!room) return;
     if (isKifuFull()) {
       toast.error('棋谱已达上限，请先清理旧棋谱');
       return;
     }
     const result: GameResult = room.winner || (room.moveCount >= 225 ? 'draw' : 'unknown');
     const record = saveKifu({
       name: generateDefaultName('online', result),
       mode: 'online',
       result,
       moves: room.moveHistory.map((m: MoveWithPlayer) => ({
         row: m.row,
         col: m.col,
         player: m.player,
       })),
       moveCount: room.moveCount,
       blackPlayer: room.blackPlayer === playerId ? '我（黑）' : '对手（黑）',
       whitePlayer: room.whitePlayer === playerId ? '我（白）' : '对手（白）',
     });
     setShowEndDialog(false);
     toast.success('棋谱已保存');
     navigate(`/kifu/${record.id}`);
   };

  const getStatusText = () => {
    if (!room) return '';
    if (room.status === 'waiting') return '等待对方加入...';
    if (room.status === 'ended') {
      if (!room.winner) return '平局';
      return room.winner === 'black' ? '黑方获胜' : '白方获胜';
    }
    if (room.currentPlayer === 'black') return '黑方回合';
    return '白方回合';
  };

  const canUndo =
    room &&
    (room.status === 'playing' || room.status === 'ended') &&
    myColor &&
    room.moveCount > 0 &&
    room.undoRequestStatus !== 'pending' &&
    room.restartRequestStatus !== 'pending';

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
      >
        <div className="text-lg text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-background"
      >
        <div className="text-center space-y-4">
          <p className="text-lg text-foreground">房间不存在</p>
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

  const isBlackTurn = room.currentPlayer === 'black';
  const turnLabel = room.status === 'playing'
    ? (isBlackTurn ? '黑方回合' : '白方回合')
    : room.status === 'waiting'
      ? '等待中'
      : room.winner
        ? (room.winner === 'black' ? '黑方胜' : '白方胜')
        : '平局';

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
            {/* Left: back button + my info */}
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
                    {isWatchMode
                      ? '观战'
                      : myColor
                        ? (isRoomOwner ? '你（房主）' : '你')
                        : '观战'}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {myColor
                      ? (myColor === 'black' ? '执黑' : '执白')
                      : '模式'}
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
                {aiThinking && room.status === 'playing' && (
                  <div
                    className="flex items-center gap-1.5 mt-1 text-xs font-medium"
                    style={{ color: godlikeActive ? 'var(--ai-godlike-accent)' : 'var(--foreground)' }}
                  >
                    <Loader2
                      className="w-3 h-3 animate-spin"
                      style={{
                        color: godlikeActive ? 'var(--ai-godlike-accent)' : 'var(--foreground)',
                      }}
                    />
                    <span>
                      {godlikeActive ? 'AI深度思考中...' : 'AI思考中...'}
                    </span>
                  </div>
                )}
               {!aiThinking && room.status === 'playing' && !isWatchMode && (
                 <p className="text-xs mt-1" style={{ color: isMyTurn ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                   {isMyTurn ? '轮到你落子' : '等待对方...'}
                 </p>
               )}
               {isWatchMode && room.status === 'playing' && (
                 <p className="text-xs mt-1 text-muted-foreground/70">
                   观战中
                 </p>
               )}
             </div>

            {/* Right: opponent info + room code */}
            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
              <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 border"
                  style={{
                    borderColor:
                      opponentColor === 'black' ? '#1a1a1a' : '#d9ccb8',
                    ...pieceStyle(opponentColor || 'white'),
                  }}
                />
                <div className="min-w-0 text-right">
                  <p className="text-sm font-medium truncate text-foreground">
                    {isWatchMode
                      ? '对局中'
                      : hasAiOpponent
                        ? `AI·${getAiDifficultyLabel(room.aiDifficulty)}`
                        : '对手'}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {opponentColor
                      ? (opponentColor === 'black' ? '执黑' : '执白')
                      : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Room code row */}
          <div className="max-w-xl mx-auto flex items-center justify-center gap-2 mt-2">
            <span
              className="text-xs font-mono cursor-default select-none text-muted-foreground"
              onClick={handleSecretClick}
            >
              房间号 {room.roomCode}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyRoomCode}
              aria-label="复制房间号"
               className="h-6 w-6 rounded-md text-muted-foreground/70"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {isWatchMode && (
              <Badge
                variant="outline"
                 className="text-[10px] h-5 gap-1 border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"
              >
                <Eye className="w-3 h-3" />
                观战
              </Badge>
            )}
          </div>
        </div>

        {/* Win rate bar */}
        {effectiveAiSettings.showWinRate && room.moveCount > 0 && (
           <div
             className="rounded-2xl p-4 border bg-card border-border"
           >
            <WinRateBar winRate={winRate} loading={winRateLoading} />
          </div>
        )}

        {/* Disconnect / AI substitute notice */}
        <AnimatePresence>
          {!isWatchMode && opponentDisconnected && isRoomOwner && room.status === 'playing' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
               <div
                 className="flex items-center justify-between gap-3 py-3 px-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
               >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">⚠️</span>
                   <span className="text-sm truncate">
                     对方似乎掉线了
                   </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleAiSubstitute}
                  disabled={aiSubLoading}
                   className="shrink-0 gap-1.5 h-8 text-xs rounded-lg"
                   style={{ backgroundColor: 'hsl(var(--color-gold))', color: 'hsl(220, 8%, 10%)' }}
                >
                  <Bot className="w-3.5 h-3.5" />
                  {aiSubLoading ? '召唤中...' : '召唤AI替补'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI opponent invite hint */}
        <AnimatePresence>
          {!isWatchMode && isRoomOwner && hasAiOpponent && !opponentDisconnected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
               <div className="flex items-center justify-between gap-3 py-3 px-4 rounded-2xl border bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-300">
                 <div className="flex items-center gap-2 min-w-0">
                   <Bot className="w-4 h-4 shrink-0" />
                   <span className="text-sm truncate">
                     当前对手为 AI，分享房间号邀请好友替换
                   </span>
                 </div>
                 <Button
                   size="sm"
                   variant="outline"
                   onClick={handleCopyRoomCode}
                   className="shrink-0 gap-1.5 h-8 text-xs rounded-lg border-purple-500/30 bg-card text-purple-700 dark:text-purple-300"
                 >
                  <Copy className="w-3.5 h-3.5" />
                  复制
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Remove AI substitute button */}
        {!isWatchMode && isRoomOwner && hasAiOpponent && (
          <div className="flex justify-end -mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRemoveAiSubstitute}
              disabled={aiSubLoading}
               className="gap-1.5 h-7 text-xs text-muted-foreground/70"
            >
              {aiSubLoading ? '移除中...' : '移除AI替补'}
            </Button>
          </div>
        )}

        {/* Undo pending notice */}
        {room.undoRequestStatus === 'pending' && isUndoRequester && (
           <div className="py-2 px-4 rounded-2xl text-center border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
             <p className="text-sm">
               等待对方同意悔棋...
             </p>
           </div>
        )}
        {room.restartRequestStatus === 'pending' && isRestartRequester && (
          <div className="py-2 px-4 rounded-2xl text-center border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
            <p className="text-sm">等待对方同意重新开始...</p>
          </div>
        )}

        {/* Board area */}
        <div className="flex justify-center relative py-2">
          <GomokuBoard
            board={displayBoard}
            lastMove={displayLastMove}
            winningLine={room.winningLine}
            onCellClick={handleCellClick}
            disabled={isWatchMode || !isMyTurn || !!optimisticBoard || aiThinking}
            currentPlayer={room.currentPlayer}
            hintMove={effectiveAiSettings.hintEnabled && !isWatchMode ? hintMove : null}
          />
           {isWatchMode && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                <Badge
                  variant="outline"
                  className="text-xs gap-1.5 backdrop-blur-sm bg-card/80 border-border text-foreground"
                >
                 <Eye className="w-3 h-3" />
                 观战中
               </Badge>
             </div>
           )}


         </div>

        {/* Chat button + panel */}
        {(!isWatchMode && !hasAiOpponent && myColor) || isWatchMode ? (
          <div className="space-y-2">
            <div className="flex justify-center">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleChatToggle}
                 className="gap-2 h-9 text-xs px-4 relative rounded-xl border-border bg-card text-foreground"
               >
                <MessageCircle className="w-4 h-4" />
                聊天
                {chatUnread > 0 && (
                  <span
                   className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 bg-destructive"
                  >
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </Button>
            </div>

            <AnimatePresence>
              {chatOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                   <div className="rounded-2xl overflow-hidden flex flex-col border bg-card border-border">
                    {/* Messages list */}
                    <div
                      ref={chatListRef}
                      className="overflow-y-auto px-3 py-3 space-y-2"
                      style={{ maxHeight: '300px' }}
                    >
                      {chatMessages.length === 0 && (
                           <div className="text-center text-xs py-6 text-muted-foreground/70">
                             {isWatchMode ? '暂无消息' : '暂无消息，打个招呼吧'}
                           </div>
                      )}
                      {chatMessages.map((msg: ChatMessage) => {
                        if (msg.msgType === 'system') {
                          return (
                             <div
                               key={msg.id}
                               className="text-center text-xs py-1 text-muted-foreground/70"
                             >
                              {msg.content}
                            </div>
                          );
                        }
                        const mine = isMyMessage(msg);
                        const isWatchView = isWatchMode;
                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2 ${mine && !isWatchView ? 'flex-row-reverse' : 'flex-row'}`}
                          >
                            <div
                              className="w-5 h-5 rounded-full border flex-shrink-0 mt-0.5"
                              style={{
                                borderColor:
                                  msg.senderColor === 'black'
                                    ? '#1a1a1a'
                                    : '#d9ccb8',
                                ...pieceStyle(
                                  (msg.senderColor as 'black' | 'white') || 'black',
                                ),
                              }}
                            />
                            <div
                              className={`max-w-[75%] flex flex-col gap-1 ${mine && !isWatchView ? 'items-end' : 'items-start'}`}
                            >
                               <div
                                 className={`px-3 py-2 text-sm break-words rounded-xl ${
                                   mine && !isWatchView
                                     ? 'rounded-tr-sm bg-primary/15 text-foreground'
                                     : 'rounded-tl-sm bg-secondary text-foreground'
                                 }`}
                               >
                                {msg.content}
                              </div>
                               <span className="text-[10px] text-muted-foreground/70">
                                {formatChatTime(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick phrases (only for player mode) */}
                    {!isWatchMode && (
                       <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-border">
                        {QUICK_PHRASES.map((phrase: string) => (
                          <Button
                            key={phrase}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickPhrase(phrase)}
                            disabled={chatSending}
                             className="h-7 text-xs px-2.5 rounded-lg border-border bg-background text-muted-foreground"
                          >
                            {phrase}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Input area (player mode only) */}
                    {!isWatchMode ? (
                       <div className="p-3 border-t flex items-center gap-2 border-border">
                         <Input
                           value={chatInput}
                           onChange={(e) => setChatInput(e.target.value)}
                           onKeyDown={handleChatKeyDown}
                           placeholder="输入消息..."
                           disabled={chatSending}
                           className="h-9 text-sm rounded-xl bg-input border-input text-foreground focus-visible:border-primary"
                         />
                         <Button
                           onClick={handleSendChat}
                           disabled={!chatInput.trim() || chatSending}
                           size="sm"
                           className="h-9 px-3 gap-1.5 shrink-0 rounded-xl bg-primary text-primary-foreground"
                         >
                          <Send className="w-4 h-4" />
                          发送
                        </Button>
                      </div>
                    ) : (
                       <div className="px-3 py-2.5 border-t border-border">
                         <p className="text-xs text-center text-muted-foreground/70">
                           观战模式无法发送消息
                         </p>
                       </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : null}

        {/* The active AI tier uses the same card layout as solo mode. */}
        {effectiveAiSettings.hintEnabled && !isWatchMode && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              {currentTier === 'godlike'
                ? <Sparkles className="w-5 h-5" style={{ color: 'var(--ai-godlike-accent)' }} />
                : <Brain className="w-5 h-5 text-foreground" />}
              <h3 className="font-semibold text-base" style={{ color: currentTier === 'godlike' ? 'var(--ai-godlike-accent)' : 'var(--foreground)' }}>
                {currentTier === 'godlike' ? '终极 AI' : 'AI 助手'}
              </h3>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleRequestHint}
                disabled={!isMyTurn || room.status !== 'playing' || hintLoading || aiThinking}
                className="gap-2 min-h-10 text-sm px-4 rounded-xl bg-background"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <Lightbulb className="w-4 h-4" style={currentTier === 'godlike' ? { color: 'var(--ai-godlike-accent)' } : undefined} />
                {hintLoading ? '提示中...' : 'AI提示'}
              </Button>
              <Button
                variant="outline"
                onClick={handleAiMove}
                disabled={!isMyTurn || room.status !== 'playing' || aiThinking}
                className="gap-2 min-h-10 text-sm px-4 rounded-xl bg-background"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <Sparkles className="w-4 h-4" style={currentTier === 'godlike' ? { color: 'var(--ai-godlike-accent)' } : undefined} />
                {aiThinking ? 'AI 思考中...' : 'AI落子'}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 shrink-0" style={{ color: currentTier === 'godlike' ? 'var(--ai-godlike-accent)' : 'var(--foreground)' }} />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    全自动 AI
                  </p>
                  <p className="text-xs text-muted-foreground">轮到你时自动落子</p>
                </div>
              </div>
              <Switch
                checked={effectiveAiSettings.autoPlayEnabled}
                onCheckedChange={handleAutoPlayToggle}
                disabled={room.status !== 'playing'}
                aria-label="全自动 AI"
                style={currentTier === 'godlike' && effectiveAiSettings.autoPlayEnabled ? { backgroundColor: 'var(--ai-godlike-accent)' } : undefined}
              />
            </div>
          </div>
        )}

        {/* Hint win rate mini card */}
         {effectiveAiSettings.hintEnabled && !isWatchMode && hintWinRate && (
           <div
             className="rounded-2xl p-4 border bg-card border-border"
           >
             <WinRateBar winRate={hintWinRate} compact />
           </div>
         )}

         {/* AI analysis panel (hint enabled, not watch mode) */}
         {effectiveAiSettings.hintEnabled && !isWatchMode && (
           <AiAnalysisPanel
             analysis={hintAnalysis}
             loading={hintLoading}
           />
         )}

        {/* Watch mode: AI analysis */}
        {isWatchMode && (
          <div className="space-y-4">
            <div className="flex justify-center">
               <Button
                 onClick={handleWatchAnalysis}
                 disabled={watchAnalyzing}
                 className="gap-2 min-h-11 text-base px-6 rounded-xl bg-primary text-primary-foreground"
               >
                <Brain className="w-4 h-4" />
                {watchAnalyzing ? '分析中...' : 'AI 分析'}
              </Button>
            </div>

             {watchAnalysisData && (
                <div
                  className="rounded-2xl p-5 border bg-card border-border"
                >
                  <WinRateBar winRate={watchAnalysisData.winRate} />
                </div>
             )}

            {watchAnalysisData && (
              <AiAnalysisPanel
                analysis={watchAnalysisData.analysis}
                loading={watchAnalyzing}
                title="AI 分析"
                hintMove={watchAnalysisData.bestMove}
              />
            )}
          </div>
        )}

        {/* Bottom control buttons */}
        {!isWatchMode && (
          <div
            className="flex items-center justify-center gap-3 flex-wrap pt-2"
          >
             <Button
               variant="outline"
               onClick={handleRequestUndo}
               disabled={!canUndo || undoRequesting}
               className="gap-2 min-h-11 text-base px-4 rounded-xl border-border bg-card text-foreground"
             >
              <Undo2 className="w-4 h-4" />
              {undoRequesting ? '请求中...' : '悔棋'}
            </Button>
             <Button
               variant="outline"
               onClick={handleRestart}
               disabled={room.status === 'waiting' || room.restartRequestStatus === 'pending' || room.undoRequestStatus === 'pending' || restartRequesting}
               className="gap-2 min-h-11 text-base px-4 rounded-xl border-border bg-card text-foreground"
             >
              <RotateCcw className="w-4 h-4" />
              {restartRequesting ? '请求中...' : '重新开始'}
            </Button>
             <Button
               variant="destructive"
               onClick={handleLeave}
               className="gap-2 min-h-11 text-base px-4 rounded-xl"
             >
              <ArrowLeft className="w-4 h-4" />
              离开房间
            </Button>
          </div>
        )}

        {isWatchMode && (
          <div className="flex items-center justify-center pt-2">
             <Button
               variant="outline"
               onClick={() => navigate('/')}
               className="gap-2 min-h-11 text-base px-6 rounded-xl border-border bg-card text-foreground"
             >
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Button>
          </div>
        )}
      </div>

      {/* Undo dialog */}
      <Dialog open={showUndoDialog} onOpenChange={(open) => { if (!open && !undoResponding && isUndoResponder) void handleRespondUndo(false); }}>
         <DialogContent
           className="sm:max-w-md border-border p-0 overflow-hidden rounded-2xl bg-background"
         >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="p-6"
          >
            <DialogHeader>
               <DialogTitle className="text-foreground">
                 悔棋请求
               </DialogTitle>
               <DialogDescription className="text-muted-foreground">
                 对方请求悔棋，是否同意？
               </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row justify-end gap-2 sm:justify-end pt-4">
               <Button
                 variant="outline"
                 onClick={() => handleRespondUndo(false)}
                 disabled={undoResponding}
                 className="rounded-xl border-border bg-card text-foreground"
               >
                拒绝
              </Button>
               <Button
                 onClick={() => handleRespondUndo(true)}
                 disabled={undoResponding}
                 className="rounded-xl bg-primary text-primary-foreground"
               >
                {undoResponding ? '处理中...' : '同意'}
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRestartDialog} onOpenChange={(open) => { if (!open && !restartResponding && isRestartResponder) void handleRespondRestart(false); }}>
        <DialogContent className="sm:max-w-md border-border rounded-2xl bg-background">
          <DialogHeader>
            <DialogTitle>重新开始请求</DialogTitle>
            <DialogDescription>对方想重新开始，是否同意？同意后当前棋局会清空。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => handleRespondRestart(false)} disabled={restartResponding}>拒绝</Button>
            <Button onClick={() => handleRespondRestart(true)} disabled={restartResponding}>{restartResponding ? '处理中...' : '同意'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GameEndDialog
        open={showEndDialog}
        winner={endWinner}
        myColor={myColor}
        onRestart={handleRestart}
        onLeave={handleLeave}
        onClose={() => setShowEndDialog(false)}
        onSaveKifu={handleSaveKifu}
      />

       {!isWatchMode && (
         <HiddenAiPanel
            open={showSecretPanel}
            onOpenChange={setShowSecretPanel}
            tier={currentTier}
            settings={aiSettings[currentTier]}
            thinkingStrength={aiSettings.godlike.thinkingStrength ?? 'medium'}
            onThinkingStrengthChange={handleThinkingStrengthChange}
            onHintChange={handleHintToggle}
            onAutoPlayChange={handleAutoPlayToggle}
            onWinRateChange={handleShowWinRateToggle}
            disabled={currentTier === 'pro' && godlikeActive}
            onUpgradeToGodlike={handleUpgradeToGodlike}
            onDowngradeToPro={handleDowngradeToPro}
           />
       )}
    </motion.div>
  );
};

export default RoomPage;
