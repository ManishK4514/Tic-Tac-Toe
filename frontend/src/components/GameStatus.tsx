import { Mark, PlayerInfo } from "../types/game";

interface GameStatusProps {
  isMyTurn: boolean;
  gameOver: boolean;
  winner: string | null;
  myMark: Mark | null;
  myInfo: PlayerInfo | null;
  opponentInfo: PlayerInfo | null;
  myUserId: string | null;
  isOpponentConnected: boolean;
  onPlayAgain: () => void;
}

export default function GameStatus({
  isMyTurn,
  gameOver,
  winner,
  myMark,
  myInfo,
  opponentInfo,
  myUserId,
  isOpponentConnected,
  onPlayAgain,
}: GameStatusProps) {
  const getResultText = (): { text: string; color: string; emoji: string } => {
    if (!gameOver) return { text: "", color: "", emoji: "" };
    if (winner === "draw") {
      return { text: "It's a Draw!", color: "text-yellow-400", emoji: "🤝" };
    }
    if (winner === myUserId) {
      return { text: "You Win!", color: "text-emerald-400", emoji: "🎉" };
    }
    return { text: "You Lose", color: "text-rose-400", emoji: "😢" };
  };

  const result = getResultText();

  if (!isOpponentConnected) {
    return (
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-gray-400 text-sm">Waiting for opponent...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Player info row */}
      <div className="flex items-center justify-between gap-2">
        {/* My info */}
        <div
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border transition-all duration-300 ${
            !gameOver && isMyTurn
              ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
              : "border-gray-700 bg-gray-800/50"
          }`}
        >
          <span
            className={`text-2xl font-black ${
              myMark === "X" ? "text-blue-400" : "text-rose-400"
            }`}
          >
            {myMark === "X" ? "✕" : "○"}
          </span>
          <span className="text-xs text-gray-300 mt-1 font-medium truncate max-w-[80px]">
            {myInfo?.username || "You"}
          </span>
          {!gameOver && isMyTurn && (
            <span className="text-xs text-indigo-400 font-semibold mt-1">Your turn</span>
          )}
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center">
          <span className="text-gray-600 text-xs font-bold">VS</span>
        </div>

        {/* Opponent info */}
        <div
          className={`flex-1 flex flex-col items-center p-3 rounded-xl border transition-all duration-300 ${
            !gameOver && !isMyTurn
              ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
              : "border-gray-700 bg-gray-800/50"
          }`}
        >
          <span
            className={`text-2xl font-black ${
              opponentInfo?.mark === "X" ? "text-blue-400" : "text-rose-400"
            }`}
          >
            {opponentInfo?.mark === "X" ? "✕" : "○"}
          </span>
          <span className="text-xs text-gray-300 mt-1 font-medium truncate max-w-[80px]">
            {opponentInfo?.username || "Opponent"}
          </span>
          {!gameOver && !isMyTurn && (
            <span className="text-xs text-indigo-400 font-semibold mt-1">Thinking...</span>
          )}
        </div>
      </div>

      {/* Game over result */}
      {gameOver && (
        <div className="text-center space-y-3 animate-fade-in">
          <div className={`text-3xl font-black ${result.color}`}>
            {result.emoji} {result.text}
          </div>
          <button onClick={onPlayAgain} className="btn-primary w-full">
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
