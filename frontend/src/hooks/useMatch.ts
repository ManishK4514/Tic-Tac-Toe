import { useState, useCallback, useRef } from "react";
import { useNakama } from "./useNakama";
import {
  MatchState,
  OpCode,
  PlayerInfo,
  PlayerJoinedMessage,
  GameOverMessage,
  TimerUpdateMessage,
  Mark,
} from "../types/game";

interface UseMatchReturn {
  matchState: MatchState | null;
  myMark: Mark | null;
  opponentInfo: PlayerInfo | null;
  myInfo: PlayerInfo | null;
  isMyTurn: boolean;
  gameOver: boolean;
  winner: string | null;
  timerTicks: number;
  sendMove: (cellIndex: number) => Promise<void>;
  joinMatch: (matchId: string) => Promise<void>;
  leaveMatch: () => Promise<void>;
  matchId: string | null;
  isOpponentConnected: boolean;
}

export function useMatch(): UseMatchReturn {
  const { socket, session } = useNakama();
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [myMark, setMyMark] = useState<Mark | null>(null);
  const [opponentInfo, setOpponentInfo] = useState<PlayerInfo | null>(null);
  const [myInfo, setMyInfo] = useState<PlayerInfo | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [timerTicks, setTimerTicks] = useState<number>(150);
  const [isOpponentConnected, setIsOpponentConnected] = useState(false);

  // Use ref for matchId so callbacks always see the latest value
  const matchIdRef = useRef<string | null>(null);

  const joinMatch = useCallback(
    async (id: string) => {
      if (!socket || !session) throw new Error("Not connected to Nakama");

      matchIdRef.current = id;
      setMatchId(id);

      // Join the match
      await socket.joinMatch(id);

      // Set up the match data listener
      socket.onmatchdata = (matchData) => {
        const raw = matchData.data;
        let parsed: Record<string, unknown>;
        try {
          if (typeof raw === "string") {
            parsed = JSON.parse(raw);
          } else if (raw instanceof Uint8Array) {
            parsed = JSON.parse(new TextDecoder().decode(raw));
          } else {
            parsed = JSON.parse(String.fromCharCode(...Array.from(raw as Uint8Array)));
          }
        } catch {
          console.error("Failed to parse match data", raw);
          return;
        }

        const opCode = matchData.op_code;

        if (opCode === OpCode.PLAYER_JOINED) {
          const msg = parsed as unknown as PlayerJoinedMessage;
          const userId = session.user_id!;

          // Determine own mark and opponent info
          const myMark = msg.marks[userId] as Mark;
          setMyMark(myMark);

          const myPlayerInfo = msg.players[userId];
          setMyInfo(myPlayerInfo ? { ...myPlayerInfo, mark: myMark } : null);

          for (const uid in msg.players) {
            if (uid !== userId) {
              const oppMark = msg.marks[uid] as Mark;
              setOpponentInfo({ ...msg.players[uid], mark: oppMark });
            }
          }

          setIsOpponentConnected(true);

          // Set initial match state
          setMatchState({
            board: [null, null, null, null, null, null, null, null, null],
            marks: msg.marks as { [userId: string]: Mark },
            turn: msg.turn,
            winner: null,
            gameOver: false,
            timerEnabled: false,
            timerTicks: 150,
          });
        } else if (opCode === OpCode.STATE_UPDATE) {
          const state = parsed as unknown as MatchState;
          setMatchState(state);
          setTimerTicks(state.timerTicks);
        } else if (opCode === OpCode.GAME_OVER) {
          const msg = parsed as unknown as GameOverMessage;
          setMatchState((prev) =>
            prev
              ? {
                  ...prev,
                  board: msg.board,
                  winner: msg.winner,
                  gameOver: true,
                }
              : null
          );
        } else if (opCode === OpCode.TIMER_UPDATE) {
          const msg = parsed as unknown as TimerUpdateMessage;
          setTimerTicks(msg.timerTicks);
        }
      };
    },
    [socket, session]
  );

  const sendMove = useCallback(
    async (cellIndex: number) => {
      if (!socket || !matchIdRef.current) return;
      const payload = JSON.stringify({ cell: cellIndex });
      await socket.sendMatchState(matchIdRef.current, OpCode.MOVE, payload);
    },
    [socket]
  );

  const leaveMatch = useCallback(async () => {
    if (!socket || !matchIdRef.current) return;
    await socket.leaveMatch(matchIdRef.current);
    matchIdRef.current = null;
    setMatchId(null);
    setMatchState(null);
    setMyMark(null);
    setOpponentInfo(null);
    setMyInfo(null);
    setIsOpponentConnected(false);
    socket.onmatchdata = () => {};
  }, [socket]);

  const isMyTurn =
    !!matchState && !!session?.user_id && matchState.turn === session.user_id;

  const gameOver = matchState?.gameOver ?? false;
  const winner = matchState?.winner ?? null;

  return {
    matchState,
    myMark,
    opponentInfo,
    myInfo,
    isMyTurn,
    gameOver,
    winner,
    timerTicks,
    sendMove,
    joinMatch,
    leaveMatch,
    matchId,
    isOpponentConnected,
  };
}
