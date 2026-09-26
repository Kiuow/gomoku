export type PlayerColor = 'black' | 'white';

export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'hell' | 'godlike';
export type AiThinkingStrength = 'low' | 'medium' | 'high';

export type RoomStatus = 'waiting' | 'playing' | 'ended';

export interface Move {
  row: number;
  col: number;
}

export interface MoveWithPlayer {
  row: number;
  col: number;
  player: PlayerColor;
}

export type UndoRequestStatus = 'pending' | 'accepted' | 'rejected' | null;

export interface GomokuRoom {
   id: string;
   roomCode: string;
   board: string[][];
   currentPlayer: PlayerColor;
   blackPlayer: string | null;
   whitePlayer: string | null;
   status: RoomStatus;
   winner: PlayerColor | null;
   winningLine: Move[] | null;
   lastMove: Move | null;
   moveCount: number;
   moveHistory: MoveWithPlayer[];
   undoRequestBy: PlayerColor | null;
   undoRequestStatus: UndoRequestStatus;
   restartRequestBy?: PlayerColor | null;
   restartRequestStatus?: UndoRequestStatus;
   aiDifficulty: AiDifficulty | null;
   aiPendingSince?: number | null;
 }

export type RoomMode = 'normal' | 'ai';

export interface CreateRoomRequest {
  playerId: string;
  roomCode?: string;
  playerColor?: PlayerColor;
}

export interface CreateRoomResponse {
  room: GomokuRoom;
  playerColor: PlayerColor;
}

export interface JoinRoomRequest {
  roomCode: string;
  playerId: string;
}

export interface JoinRoomResponse {
  room: GomokuRoom;
  playerColor: PlayerColor;
}

export interface MakeMoveRequest {
  roomCode: string;
  playerId: string;
  row: number;
  col: number;
}

export interface MakeMoveResponse {
  room: GomokuRoom;
  valid: boolean;
  message?: string;
}

export interface GetRoomResponse {
  room: GomokuRoom;
}

export interface RestartRequest {
  roomCode: string;
  playerId: string;
}

export interface RestartResponse {
  room: GomokuRoom;
}

export interface LeaveRoomRequest {
  roomCode: string;
  playerId: string;
}

export interface UndoRequestRequest {
  roomCode: string;
  playerId: string;
}

export interface UndoRequestResponse {
  room: GomokuRoom;
  success: boolean;
  message?: string;
}

export interface UndoRespondRequest {
  roomCode: string;
  playerId: string;
  accept: boolean;
}

export interface UndoRespondResponse {
  room: GomokuRoom;
  success: boolean;
  message?: string;
}

export interface AiMoveRequest {
  roomCode: string;
  playerId: string;
  difficulty?: AiDifficulty;
  thinkingStrength?: AiThinkingStrength;
}

export interface AiMoveResponse {
  room: GomokuRoom;
  valid: boolean;
  message?: string;
}

export interface AiHintRequest {
  roomCode: string;
  playerId: string;
  difficulty?: AiDifficulty;
  thinkingStrength?: AiThinkingStrength;
}

export interface WinRateInfo {
  black: number;
  white: number;
  draw: number;
  description: string;
  advantage: 'black' | 'white' | 'balanced';
  level: 'winning' | 'big_advantage' | 'slight_advantage' | 'balanced' | 'slight_disadvantage' | 'big_disadvantage' | 'losing';
}

export interface AiHintAnalysis {
  intention: 'attack' | 'defense' | 'balanced';
  intentionText: string;
  alternatives: Array<{ row: number; col: number; score: number; reason: string }>;
  // —— 旧版字段（hell 及以下难度使用）——
  pattern?: string;
  reasoning?: string;
  nextSteps?: string;
  // —— 神仙级深度分析字段（godlike 使用）——
  coreIntent?: string;
  patternDetail?: {
    type: string;
    threat: string;
    development: string;
    directionCount: number;
  };
  whyThisPoint?: string;
  followUpPlan?: string[];
  opponentResponses?: Array<{ move: string; counter: string }>;
  globalSituation?: string;
  ifNotPlayed?: string;
  midLongTerm?: string;
  risks?: string;
}

export interface AiHintResponse {
  hint: Move | null;
  analysis: AiHintAnalysis | null;
  winRate: WinRateInfo | null;
  valid: boolean;
  message?: string;
}

export interface AiSubstituteRequest {
  roomCode: string;
  playerId: string;
  targetColor: PlayerColor;
  difficulty?: AiDifficulty;
}

export interface AiSubstituteResponse {
  room: GomokuRoom;
  success: boolean;
  message?: string;
}

export interface RemoveAiSubstituteRequest {
  roomCode: string;
  playerId: string;
  targetColor: PlayerColor;
}

export interface RemoveAiSubstituteResponse {
  room: GomokuRoom;
  success: boolean;
  message?: string;
}

export interface WatchAnalysisRequest {
  roomCode: string;
  difficulty?: AiDifficulty;
}

export interface WatchAnalysisResponse {
  valid: boolean;
  bestMove: Move | null;
  analysis: AiHintAnalysis | null;
  winRate: WinRateInfo;
  message?: string;
}

// === Solo Mode ===

export interface CreateSoloGameRequest {
   playerId: string;
   playerColor: PlayerColor;
   difficulty?: AiDifficulty;
 }

export interface CreateSoloGameResponse {
   room: GomokuRoom;
   playerColor: PlayerColor;
 }

export interface SoloMoveRequest {
   roomCode: string;
   playerId: string;
   row: number;
   col: number;
 }

export interface SoloMoveResponse {
   valid: boolean;
   room: GomokuRoom;
   message?: string;
   opponentAnalysis?: AiHintAnalysis | null;
   aiThinking?: boolean;
 }

export interface SoloUndoRequest {
   roomCode: string;
   playerId: string;
 }

export interface SoloUndoResponse {
   success: boolean;
   room: GomokuRoom;
   message?: string;
 }

export interface SoloAiMoveRequest {
   roomCode: string;
   playerId: string;
   difficulty?: AiDifficulty;
 }

export interface SoloAiMoveResponse {
   valid: boolean;
   room: GomokuRoom;
   message?: string;
   opponentAnalysis?: AiHintAnalysis | null;
 }

export interface SoloAiHintRequest {
   roomCode: string;
   playerId: string;
   difficulty?: AiDifficulty;
 }

export interface SoloRestartRequest {
   roomCode: string;
   playerId: string;
 }

export interface SoloRestartResponse {
   room: GomokuRoom;
 }

export interface SoloGetRoomResponse {
   room: GomokuRoom;
 }

export interface GetSoloRoomResponse {
   room: GomokuRoom;
 }

// === Analyze Board (for practice/free-play mode) ===

export interface AnalyzeBoardRequest {
  board: string;
  currentPlayer: PlayerColor;
  difficulty?: AiDifficulty;
}

export type AnalyzeBoardResponse = AiHintResponse;

// === Win Rate ===

export interface WinRateRequest {
  roomCode: string;
  difficulty?: AiDifficulty;
}

export interface WinRateResponse {
  valid: boolean;
  winRate: WinRateInfo;
  message?: string;
}

// === Chat ===

export type ChatMessageType = 'player' | 'system';

export interface ChatMessage {
  id: string;
  roomCode: string;
  senderId: string | null;
  senderColor: PlayerColor | null;
  content: string;
  msgType: ChatMessageType;
  createdAt: string;
}

export interface SendChatRequest {
  roomCode: string;
  playerId: string;
  content: string;
}

export interface SendChatResponse {
  valid: boolean;
  message?: string;
  chatMessage?: ChatMessage;
}

export interface GetChatRequest {
  roomCode: string;
  sinceTime?: string;
}

export interface GetChatResponse {
  valid: boolean;
  messages: ChatMessage[];
  message?: string;
}

