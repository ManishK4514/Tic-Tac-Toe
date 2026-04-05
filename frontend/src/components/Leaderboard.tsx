import { LeaderboardRecord } from "../types/game";

interface LeaderboardProps {
  records: LeaderboardRecord[];
  myUserId: string | null;
  isLoading: boolean;
}

export default function Leaderboard({ records, myUserId, isLoading }: LeaderboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl bg-gray-800 animate-pulse"
            style={{ opacity: 1 - i * 0.15 }}
          />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-4xl mb-3">🏆</p>
        <p className="font-medium">No records yet.</p>
        <p className="text-sm mt-1">Play a game to appear on the leaderboard!</p>
      </div>
    );
  }

  const rankEmoji = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-12 text-xs text-gray-500 font-semibold uppercase tracking-wider px-4 pb-1">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">Player</div>
        <div className="col-span-2 text-center">Wins</div>
        <div className="col-span-2 text-center">W/L/D</div>
        <div className="col-span-2 text-center">Streak</div>
      </div>

      {records.map((record) => {
        const isMe = record.userId === myUserId;
        const rankDisplay =
          record.rank <= 3 ? rankEmoji[record.rank - 1] : `${record.rank}`;

        return (
          <div
            key={record.userId}
            className={`grid grid-cols-12 items-center px-4 py-3 rounded-xl border transition-colors ${
              isMe
                ? "bg-indigo-500/15 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                : "bg-gray-800/50 border-gray-700/50 hover:bg-gray-800"
            }`}
          >
            {/* Rank */}
            <div className="col-span-1 text-center text-sm font-bold">
              {rankDisplay}
            </div>

            {/* Username */}
            <div className="col-span-5 flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isMe ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300"
                }`}
              >
                {(record.username || "?").charAt(0).toUpperCase()}
              </div>
              <span
                className={`text-sm font-medium truncate ${
                  isMe ? "text-indigo-300" : "text-gray-200"
                }`}
              >
                {record.username || "Anonymous"}
                {isMe && (
                  <span className="ml-1 text-xs text-indigo-400">(you)</span>
                )}
              </span>
            </div>

            {/* Wins */}
            <div className="col-span-2 text-center">
              <span className="text-emerald-400 font-bold text-sm">
                {record.wins}
              </span>
            </div>

            {/* W/L/D */}
            <div className="col-span-2 text-center text-xs text-gray-400">
              {record.wins}/{record.losses}/{record.draws}
            </div>

            {/* Best streak */}
            <div className="col-span-2 text-center">
              <span className="text-yellow-400 text-sm font-semibold">
                🔥 {record.bestStreak}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
