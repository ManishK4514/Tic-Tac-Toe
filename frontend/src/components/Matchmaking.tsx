interface MatchmakingProps {
  mode: "classic" | "timed";
  onCancel: () => void;
}

export default function Matchmaking({ mode, onCancel }: MatchmakingProps) {
  return (
    <div className="card flex flex-col items-center gap-6 py-10">
      {/* Spinner */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
      </div>

      <div className="text-center space-y-2">
        <p className="text-white font-semibold text-lg">Finding opponent...</p>
        <p className="text-gray-400 text-sm">
          Mode:{" "}
          <span className="text-indigo-400 font-medium capitalize">{mode}</span>
        </p>
        <p className="text-gray-500 text-xs">This usually takes a few seconds</p>
      </div>

      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>

      <button onClick={onCancel} className="btn-secondary text-sm py-2 px-5">
        Cancel
      </button>
    </div>
  );
}
