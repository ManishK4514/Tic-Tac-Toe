import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNakama } from "../hooks/useNakama";
import LeaderboardComponent from "../components/Leaderboard";
import { LeaderboardRecord } from "../types/game";

export default function LeaderboardPage() {
  const { client, session, isConnected } = useNakama();
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLeaderboard = async () => {
    if (!client || !session) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.rpc(session, "get_leaderboard", {});
      const data = result.payload as { records: LeaderboardRecord[] };
      setRecords(data.records ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      setError("Failed to load leaderboard: " + String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && session) {
      fetchLeaderboard();
    }
  }, [isConnected, session]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-8">
      <div className="w-full max-w-lg space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          >
            ← Back
          </Link>
          <button
            onClick={fetchLeaderboard}
            disabled={isLoading}
            className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black text-white">🏆 Leaderboard</h1>
          <p className="text-gray-400 text-sm">Top players by total wins</p>
          {lastUpdated && (
            <p className="text-gray-600 text-xs">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Leaderboard table */}
        <div className="card">
          <LeaderboardComponent
            records={records}
            myUserId={session?.user_id ?? null}
            isLoading={isLoading}
          />
        </div>

        {/* Play button */}
        <Link to="/" className="btn-primary block text-center">
          ⚡ Play Now
        </Link>
      </div>
    </div>
  );
}
