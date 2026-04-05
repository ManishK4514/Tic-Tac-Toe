export type Mark = "X" | "O";

export interface MatchState {
  board: (Mark | null)[];
  marks: { [userId: string]: Mark };
  turn: string;
  winner: string | null; // userId of winner, "draw", or null
  gameOver: boolean;
  timerEnabled: boolean;
  timerTicks: number;
}

export const OpCode = {
  MOVE: 1,
  STATE_UPDATE: 2,
  GAME_OVER: 3,
  TIMER_UPDATE: 4,
  PLAYER_JOINED: 5,
} as const;

export interface PlayerInfo {
  userId: string;
  username: string;
  mark: Mark;
}

export interface PlayerJoinedMessage {
  players: { [userId: string]: PlayerInfo };
  turn: string;
  marks: { [userId: string]: Mark };
}

export interface GameOverMessage {
  winner: string | null; // userId, "draw", or null
  board: (Mark | null)[];
  marks: { [userId: string]: Mark };
}

export interface TimerUpdateMessage {
  timerTicks: number;
  turn: string;
}

export interface LeaderboardRecord {
  rank: number;
  userId: string;
  username: string;
  wins: number;
  numScore: number;
  bestStreak: number;
  currentStreak: number;
  losses: number;
  draws: number;
}

export type GameMode = "classic" | "timed";
