import type { AppViewer } from "@/lib/auth/session";
import type { D3TGameState, D3TMove } from "@/lib/d3t/engine";

export type GameMode = "challenge";
export type GameStatus = "pending" | "active" | "finished" | "forfeit" | "declined" | "expired" | "cancelled";
export type ChallengeStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";
export type PlayerMark = "X" | "O";
export type TimePresetId = "bullet" | "blitz" | "rapid" | "classic";

export type GamePreset = {
  id: TimePresetId;
  label: string;
  initialMs: number;
  incrementMs: number;
  rated: boolean;
  description: string;
};

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  wins: number;
  losses: number;
  draws: number;
};

export type MoveRecord = {
  id: string;
  gameId: string;
  moveNumber: number;
  playerId: string;
  move: D3TMove;
  resultingState: D3TGameState;
  createdAt: string;
};

export type GameClockState = {
  initialMs: number;
  incrementMs: number;
  playerXRemainingMs: number;
  playerORemainingMs: number;
  turnStartedAt: string | null;
  expiresAt: string | null;
};

export type ChallengeAggregate = {
  id: string;
  status: ChallengeStatus;
  fromUserId: string;
  toUserId: string;
  preset: GamePreset;
  gameId: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  fromUser: UserProfile | null;
  toUser: UserProfile | null;
};

export type GameAggregate = {
  id: string;
  roomId: string;
  inviteUrl: string;
  mode: GameMode;
  status: GameStatus;
  rated: boolean;
  preset: GamePreset;
  creatorId: string;
  playerXId: string | null;
  playerOId: string | null;
  starterId: string | null;
  currentTurnId: string | null;
  winnerId: string | null;
  challengeId: string | null;
  disconnectPlayerId: string | null;
  disconnectExpiresAt: string | null;
  playerXLastSeenAt: string | null;
  playerOLastSeenAt: string | null;
  clock: GameClockState;
  state: D3TGameState;
  moves: MoveRecord[];
  playerX: UserProfile | null;
  playerO: UserProfile | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type HubData = {
  viewer: AppViewer;
  activeGame: GameAggregate | null;
  incomingChallenges: ChallengeAggregate[];
  outgoingChallenges: ChallengeAggregate[];
  presets: GamePreset[];
};
