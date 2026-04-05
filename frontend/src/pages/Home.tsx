import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useNakama } from "../hooks/useNakama";
import Matchmaking from "../components/Matchmaking";
import { GameMode } from "../types/game";

export default function Home() {
  const navigate = useNavigate();
  const { socket, isConnected, connect, session } = useNakama();
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<GameMode>("classic");
  const [ticketToken, setTicketToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Auto-connect on mount
  useEffect(() => {
    if (!isConnected) {
      setIsConnecting(true);
      connect()
        .catch((e) => setError(String(e)))
        .finally(() => setIsConnecting(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for matchmaker match
  useEffect(() => {
    if (!socket) return;

    socket.onmatchmakermatched = (matched) => {
      setSearching(false);
      setTicketToken(null);
      // Navigate to game page with the match ID
      navigate(`/game/${matched.match_id}`);
    };

    return () => {
      socket.onmatchmakermatched = () => {};
    };
  }, [socket, navigate]);

  const startMatchmaking = useCallback(
    async (selectedMode: GameMode) => {
      if (!socket || !isConnected) {
        setError("Not connected to server. Please wait...");
        return;
      }

      setError(null);
      setMode(selectedMode);
      setSearching(true);

      try {
        const result = await socket.addMatchmaker(
          "*",                            // any opponent
          2,                              // min players
          2,                              // max players
          { mode: selectedMode },         // string properties (mode)
          {}                              // numeric properties
        );
        setTicketToken(result.ticket);
      } catch (e) {
        setSearching(false);
        setError("Failed to join matchmaker: " + String(e));
      }
    },
    [socket, isConnected]
  );

  const cancelMatchmaking = useCallback(async () => {
    if (!socket || !ticketToken) return;
    try {
      await socket.removeMatchmaker(ticketToken);
    } catch {
      // Ignore errors on cancel
    }
    setSearching(false);
    setTicketToken(null);
  }, [socket, ticketToken]);

  if (searching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Matchmaking mode={mode} onCancel={cancelMatchmaking} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / title */}
        <div className="text-center space-y-2">
          <div className="text-6xl font-black tracking-tight">
            <span className="text-blue-400">✕</span>
            <span className="text-gray-600 mx-2">·</span>
            <span className="text-rose-400">○</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Tic-Tac-Toe</h1>
          <p className="text-gray-400 text-sm">Multiplayer · Real-time · Server-authoritative</p>
        </div>

        {/* Connection status */}
        <div className="flex items-center justify-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-emerald-400"
                : isConnecting
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-400"
            }`}
          />
          <span className="text-xs text-gray-500">
            {isConnected
              ? `Connected · ${session?.username || "anonymous"}`
              : isConnecting
              ? "Connecting..."
              : "Disconnected"}
          </span>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Play buttons */}
        <div className="card space-y-3">
          <h2 className="text-gray-300 text-sm font-semibold uppercase tracking-wider mb-4">
            Choose a mode
          </h2>

          <button
            onClick={() => startMatchmaking("classic")}
            disabled={!isConnected || isConnecting}
            className="btn-primary w-full flex items-center justify-center gap-3"
          >
            <span className="text-xl">⚡</span>
            <div className="text-left">
              <div className="font-bold">Play Classic</div>
              <div className="text-xs text-indigo-200 font-normal">No time limit</div>
            </div>
          </button>

          <button
            onClick={() => startMatchmaking("timed")}
            disabled={!isConnected || isConnecting}
            className="w-full flex items-center justify-center gap-3 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-purple-500/25"
          >
            <span className="text-xl">⏱</span>
            <div className="text-left">
              <div className="font-bold">Play Timed</div>
              <div className="text-xs text-purple-200 font-normal">30s per turn</div>
            </div>
          </button>
        </div>

        {/* Leaderboard link */}
        <Link
          to="/leaderboard"
          className="block text-center text-gray-400 hover:text-white text-sm transition-colors duration-150"
        >
          🏆 View Leaderboard
        </Link>
      </div>
    </div>
  );
}
