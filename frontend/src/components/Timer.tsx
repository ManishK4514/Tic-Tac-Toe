interface TimerProps {
  timerTicks: number;
  tickRate?: number;
  isMyTurn: boolean;
}

const TICK_RATE = 5;
const TURN_TICKS = 150;

export default function Timer({ timerTicks, tickRate = TICK_RATE, isMyTurn }: TimerProps) {
  const totalSeconds = TURN_TICKS / tickRate;
  const secondsLeft = Math.max(0, Math.ceil(timerTicks / tickRate));
  const fraction = timerTicks / TURN_TICKS; // 1.0 → 0.0

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - fraction);

  const isUrgent = secondsLeft <= 10;
  const circleColor = isUrgent ? "#f87171" : isMyTurn ? "#818cf8" : "#4b5563";
  const textColor = isUrgent ? "text-red-400" : isMyTurn ? "text-indigo-300" : "text-gray-500";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative w-20 h-20 ${isUrgent && isMyTurn ? "animate-pulse" : ""}`}>
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="#1f2937"
            strokeWidth="6"
          />
          {/* Progress ring */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={circleColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.2s linear, stroke 0.3s ease" }}
          />
        </svg>
        {/* Seconds display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-black tabular-nums ${textColor}`}>
            {secondsLeft}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-500">
        {isMyTurn ? "Your time" : "Their time"}
      </span>
      {/* Invisible spacer to keep reference for total */}
      <span className="sr-only">Total: {totalSeconds}s</span>
    </div>
  );
}
