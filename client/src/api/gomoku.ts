import axios from 'axios';
import { rapfiMove, rapfiWinRate } from './rapfi';
import { toast } from 'sonner';
const axiosForBackend = axios.create({ baseURL: '/' });
import type {
   AiDifficulty,
   AiThinkingStrength,
   GomokuRoom,
   Move,
   PlayerColor,
   CreateRoomRequest,
   CreateRoomResponse,
   JoinRoomRequest,
   JoinRoomResponse,
   MakeMoveRequest,
   MakeMoveResponse,
   GetRoomResponse,
   RestartRequest,
   LeaveRoomRequest,
   UndoRequestRequest,
   UndoRequestResponse,
   UndoRespondRequest,
   UndoRespondResponse,
   AiMoveRequest,
   AiMoveResponse,
   AiHintRequest,
   AiHintResponse,
   AiSubstituteRequest,
   AiSubstituteResponse,
   RemoveAiSubstituteRequest,
   RemoveAiSubstituteResponse,
   WatchAnalysisRequest,
   WatchAnalysisResponse,
   CreateSoloGameRequest,
   CreateSoloGameResponse,
   SoloMoveRequest,
   SoloMoveResponse,
   SoloUndoRequest,
   SoloUndoResponse,
   SoloRestartRequest,
   SoloAiHintRequest,
   SoloAiMoveRequest,
   GetSoloRoomResponse,
    WinRateResponse,
    SendChatRequest,
    SendChatResponse,
    GetChatRequest,
    GetChatResponse,
    AnalyzeBoardRequest,
    AnalyzeBoardResponse,
  } from '@shared/api.interface';

let onlineRapfiFallback = false;
let onlineRapfiSubscribed = false;

function noteOnlineRapfi(available: boolean) {
  if (available) {
    if (onlineRapfiFallback) toast.success('Rapfi 已恢复');
    onlineRapfiFallback = false;
  } else if (!onlineRapfiFallback) {
    onlineRapfiFallback = true;
    toast.warning('Rapfi 暂不可用，本次使用 JS 引擎；正在自动重试');
    if (!onlineRapfiSubscribed && window.RapfiBridge) {
      onlineRapfiSubscribed = true;
      window.RapfiBridge?.onChange((state) => {
        if (state === 'ready') noteOnlineRapfi(true);
      });
    }
  }
}

async function rapfiHint(room: GomokuRoom, color: PlayerColor, budget = 2000) {
  const move = await rapfiMove(room, color, budget);
  if (!move) return null;
  const rate = await rapfiWinRate(room);
  return {
    valid: true, hint: move, winRate: rate,
    analysis: {
      intention: 'balanced' as const,
      intentionText: '兼顾进攻与防守',
      alternatives: [],
      reasoning: '优先考虑双方连线与关键交叉点',
      nextSteps: '留意对手的活三和冲四',
    },
  };
}

const soloRapfiBudget = (difficulty: AiDifficulty | null) => difficulty === 'hard' ? 900 : 3000;
const godlikeBudget: Record<AiThinkingStrength, number> = { low: 800, medium: 2000, high: 5000 };

async function finishSoloAiTurn(room: GomokuRoom, playerId: string): Promise<GomokuRoom> {
  const aiColor = room.currentPlayer;
  let move: Move | null = null;
  if (room.aiDifficulty === 'hard' || room.aiDifficulty === 'hell' || room.aiDifficulty === 'godlike') {
    try { move = await rapfiMove(room, aiColor, soloRapfiBudget(room.aiDifficulty)); } catch { /* JS AI fallback below */ }
  }
  try {
    const reply = await axiosForBackend.post('/api/gomoku/solo/ai-reply', {
      roomCode: room.roomCode, playerId, expectedMoveCount: room.moveCount,
      expectedPendingSince: room.aiPendingSince, ...move,
    });
    if (reply.data.room) return reply.data.room;
  } catch { /* The player's move was already saved; reconcile below. */ }
  try {
    const latest = await axiosForBackend.get(`/api/gomoku/solo/${room.roomCode}`);
    return latest.data.room;
  } catch {
    return room;
  }
}

export const gomokuApi = {
  async createRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms', data);
    return res.data;
  },

  async joinRoom(data: JoinRoomRequest): Promise<JoinRoomResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/join', data);
    return res.data;
  },

  async getRoom(roomCode: string): Promise<GetRoomResponse> {
    const res = await axiosForBackend.get(`/api/gomoku/rooms/${roomCode}`);
    return res.data;
  },

  async makeMove(data: MakeMoveRequest): Promise<MakeMoveResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/move', data);
    return res.data;
  },

  async restart(data: RestartRequest): Promise<GetRoomResponse & { success: boolean; message?: string }> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/restart', data);
    return res.data;
  },

  async restartRespond(data: UndoRespondRequest): Promise<UndoRespondResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/restart-respond', data);
    return res.data;
  },

  async leave(data: LeaveRoomRequest): Promise<void> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/leave', data);
    return res.data;
  },

  async undoRequest(data: UndoRequestRequest): Promise<UndoRequestResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/undo-request', data);
    return res.data;
  },

  async undoRespond(data: UndoRespondRequest): Promise<UndoRespondResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/undo-respond', data);
    return res.data;
  },

  async aiMove(data: AiMoveRequest): Promise<AiMoveResponse> {
    if (data.difficulty === 'godlike') {
      const room = (await this.getRoom(data.roomCode)).room;
      const color = room.blackPlayer === data.playerId ? 'black' : room.whitePlayer === data.playerId ? 'white' : null;
      if (color && room.currentPlayer === color) {
        let move: Move | null = null;
        try { move = await rapfiMove(room, color, godlikeBudget[data.thinkingStrength ?? 'medium']); } catch { /* JS fallback below */ }
        noteOnlineRapfi(!!move);
        if (move) return this.makeMove({ ...data, ...move });
      }
    }
    const res = await axiosForBackend.post('/api/gomoku/rooms/ai-move', { ...data, difficulty: data.difficulty === 'godlike' ? 'hard' : data.difficulty });
    return res.data;
  },

  async aiHint(data: AiHintRequest): Promise<AiHintResponse> {
    if (data.difficulty === 'godlike') {
      const room = (await this.getRoom(data.roomCode)).room;
      const color = room.blackPlayer === data.playerId ? 'black' : room.whitePlayer === data.playerId ? 'white' : null;
      if (color) {
        let result = null;
        try { result = await rapfiHint(room, color, godlikeBudget[data.thinkingStrength ?? 'medium']); } catch { /* JS fallback below */ }
        noteOnlineRapfi(!!result);
        if (result) return result;
      }
    }
    const res = await axiosForBackend.post('/api/gomoku/rooms/ai-hint', { ...data, difficulty: data.difficulty === 'godlike' ? 'hard' : data.difficulty });
    if (res.data.valid) {
      const room = (await this.getRoom(data.roomCode)).room;
      res.data.winRate = await rapfiWinRate(room) || res.data.winRate;
    }
    return res.data;
  },

  async aiSubstitute(data: AiSubstituteRequest): Promise<AiSubstituteResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/ai-substitute', data);
    return res.data;
  },

  async removeAiSubstitute(data: RemoveAiSubstituteRequest): Promise<RemoveAiSubstituteResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/remove-ai-substitute', data);
    return res.data;
  },

  async watchAnalysis(data: WatchAnalysisRequest): Promise<WatchAnalysisResponse> {
    const res = await axiosForBackend.post('/api/gomoku/rooms/analyze', data);
    return res.data;
  },

  // Solo game APIs
  async createSoloGame(data: CreateSoloGameRequest): Promise<CreateSoloGameResponse> {
    const useRapfi = (data.difficulty === 'hard' || data.difficulty === 'hell' || data.difficulty === 'godlike') && data.playerColor === 'white';
    const res = await axiosForBackend.post('/api/gomoku/solo/create', { ...data, deferAi: useRapfi });
    if (useRapfi) {
      res.data.room = await finishSoloAiTurn(res.data.room, data.playerId);
    }
    return res.data;
  },

  async getSoloRoom(roomCode: string): Promise<GetSoloRoomResponse> {
    const res = await axiosForBackend.get(`/api/gomoku/solo/${roomCode}`);
    return res.data;
  },

  async changeSoloDifficulty(data: { roomCode: string; playerId: string; difficulty: AiDifficulty }): Promise<GetSoloRoomResponse> {
    const res = await axiosForBackend.post('/api/gomoku/solo/difficulty', data);
    return res.data;
  },

  async soloMove(data: SoloMoveRequest): Promise<SoloMoveResponse> {
    const res = await axiosForBackend.post('/api/gomoku/solo/move', { ...data, deferAi: true });
    const room = res.data.room as GomokuRoom;
    if (res.data.valid && room.status === 'playing') {
      const aiColor = room.currentPlayer;
      if ((aiColor === 'black' ? room.blackPlayer : room.whitePlayer) === `ai_${aiColor}`) {
        void finishSoloAiTurn(room, data.playerId);
      }
    }
    return res.data;
  },

  async soloUndo(data: SoloUndoRequest): Promise<SoloUndoResponse> {
    const res = await axiosForBackend.post('/api/gomoku/solo/undo', data);
    return res.data;
  },

  async soloRestart(data: SoloRestartRequest): Promise<GetSoloRoomResponse> {
    const current = (await this.getSoloRoom(data.roomCode)).room;
    const useRapfi = (current.aiDifficulty === 'hard' || current.aiDifficulty === 'hell' || current.aiDifficulty === 'godlike') && current.blackPlayer === 'ai_black';
    const res = await axiosForBackend.post('/api/gomoku/solo/restart', { ...data, deferAi: useRapfi });
    if (useRapfi) {
      res.data.room = await finishSoloAiTurn(res.data.room, data.playerId);
    }
    return res.data;
  },

  async soloAiHint(data: SoloAiHintRequest): Promise<AiHintResponse> {
    if (data.difficulty === 'hard' || data.difficulty === 'hell' || data.difficulty === 'godlike') {
      const room = (await this.getSoloRoom(data.roomCode)).room;
      const color = room.blackPlayer === data.playerId ? 'black' : room.whitePlayer === data.playerId ? 'white' : null;
      if (color) {
        const result = await rapfiHint(room, color, soloRapfiBudget(data.difficulty));
        if (result) return result;
      }
    }
    const fallbackDifficulty = data.difficulty === 'hell' || data.difficulty === 'godlike' ? 'hard' : data.difficulty === 'hard' ? 'normal' : data.difficulty;
    const res = await axiosForBackend.post('/api/gomoku/solo/ai-hint', { ...data, difficulty: fallbackDifficulty });
    if (res.data.valid) {
      const room = (await this.getSoloRoom(data.roomCode)).room;
      res.data.winRate = await rapfiWinRate(room) || res.data.winRate;
    }
    return res.data;
  },

   async soloAiMove(data: SoloAiMoveRequest): Promise<SoloMoveResponse> {
     if (data.difficulty === 'hard' || data.difficulty === 'hell' || data.difficulty === 'godlike') {
       const room = (await this.getSoloRoom(data.roomCode)).room;
       const color = room.blackPlayer === data.playerId ? 'black' : room.whitePlayer === data.playerId ? 'white' : null;
       if (color && room.currentPlayer === color) {
         const move = await rapfiMove(room, color, soloRapfiBudget(data.difficulty));
         if (move) return this.soloMove({ roomCode: data.roomCode, playerId: data.playerId, ...move });
       }
     }
     const fallbackDifficulty = data.difficulty === 'hell' || data.difficulty === 'godlike' ? 'hard' : data.difficulty === 'hard' ? 'normal' : data.difficulty;
     const res = await axiosForBackend.post('/api/gomoku/solo/ai-move', { ...data, difficulty: fallbackDifficulty, deferAi: true });
     if (res.data.valid && res.data.aiThinking) void finishSoloAiTurn(res.data.room, data.playerId);
     return res.data;
   },

   // Win rate
   async getWinRate(roomCode: string): Promise<WinRateResponse> {
     const room = (await this.getRoom(roomCode)).room;
     const estimate = await rapfiWinRate(room);
     if (estimate) return { valid: true, winRate: estimate };
     const res = await axiosForBackend.post('/api/gomoku/rooms/winrate', { roomCode });
     return res.data;
   },

   async getSoloWinRate(roomCode: string): Promise<WinRateResponse> {
     const room = (await this.getSoloRoom(roomCode)).room;
     const estimate = await rapfiWinRate(room);
     if (estimate) return { valid: true, winRate: estimate };
     const res = await axiosForBackend.post('/api/gomoku/solo/winrate', { roomCode });
     return res.data;
   },

   // Chat
   async sendChat(data: SendChatRequest): Promise<SendChatResponse> {
     const res = await axiosForBackend.post('/api/gomoku/rooms/chat/send', data);
     return res.data;
   },

   async getChat(roomCode: string, sinceTime?: string): Promise<GetChatResponse> {
     const res = await axiosForBackend.post('/api/gomoku/rooms/chat', { roomCode, sinceTime });
     return res.data;
   },

   async analyzeBoard(data: AnalyzeBoardRequest): Promise<AnalyzeBoardResponse> {
     const res = await axiosForBackend.post('/api/gomoku/analyze-board', data);
     return res.data;
   },
 };
