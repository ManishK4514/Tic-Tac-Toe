import { useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useNakama } from "../hooks/useNakama";
import { useMatch } from "../hooks/useMatch";
import Board from "../components/Board";
import GameStatus from "../components/GameStatus";
import Timer from "../components/Timer";

export default function Game() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { session, isConnected } = useNakama();
  const {
    matchState,
    myMark,
    myInfo,
    opponentInfo,
    isMyTurn,
    gameOver,
    winner,
    timerTicks,
    sendMove,
    joinMatch,
    leaveMatch,
    isOpponentConnected,
  } = useMatch();

  // Guard against React StrictMode double-mount calling leaveMatch prematurely
  const hasJoined = useRef(false);

  useEffect(() => {
    if (!matchId || !isConnected || hasJoined.current) return;
    hasJoined.current = true;

    joinMatch(matchId).catch((e) => {
      console.error("Failed to join match:", e);
      hasJoined.current = false;
      navigate("/");
    });

    return () => {
      // Only leave on true unmount (navigating away), not StrictMode's fake unmount
      if (hasJoined.current) {
        leaveMatch();
        hasJoined.current = false;
      }
    };
  }, [matchId, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCellClick = useCallback(
    (index: number) => {
      if (!isMyTurn || gameOver) return;
      sendMove(index);
    },
    [isMyTurn, gameOver, sendMove]
  );

  const handlePlayAgain = useCallback(async () => {
    await leaveMatch();
    navigate("/");
  }, [leaveMatch, navigate]);

  const handleLeave = useCallback(async () => {
    await leaveMatch();
    navigate("/");
  }, [leaveMatch, navigate]);

  const board = matchState?.board ?? [null, null, null, null, null, null, null, null, null];
  const timerEnabled = matchState?.timerEnabled ?? false;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            onClick={handleLeave}
            className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          >
            ← Leave
          </Link>
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-400" : "bg-red-400"
              }`}
            />
            <span className="text-xs text-gray-500">
              {timerEnabled ? "⏱ Timed" : "⚡ Classic"}
            </span>
          </div>
        </div>

        {/* Game status and player info */}
        <GameStatus
          isMyTurn={isMyTurn}
          gameOver={gameOver}
          winner={winner}
          myMark={myMark}
          myInfo={myInfo}
          opponentInfo={opponentInfo}
          myUserId={session?.user_id ?? null}
          isOpponentConnected={isOpponentConnected}
          onPlayAgain={handlePlayAgain}
        />

        {/* Timer (only in timed mode) */}
        {timerEnabled && isOpponentConnected && !gameOver && (
          <div className="flex justify-center">
            <Timer timerTicks={timerTicks} isMyTurn={isMyTurn} />
          </div>
        )}

        {/* Board */}
        <Board
          board={board}
          isMyTurn={isMyTurn}
          gameOver={gameOver}
          onCellClick={handleCellClick}
          myMark={myMark}
        />

        {/* Match ID (small, for debugging / sharing) */}
        {matchId && (
          <p className="text-center text-xs text-gray-600 break-all">
            Match: {matchId.split(".")[0]}…
          </p>
        )}
      </div>
    </div>
  );
}
