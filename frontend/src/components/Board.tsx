import { Mark } from "../types/game";

interface BoardProps {
  board: (Mark | null)[];
  isMyTurn: boolean;
  gameOver: boolean;
  onCellClick: (index: number) => void;
  myMark: Mark | null;
  winningCells?: number[];
}

const WIN_CONDITIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getWinningCells(board: (Mark | null)[]): number[] {
  for (const combo of WIN_CONDITIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combo;
    }
  }
  return [];
}

export default function Board({
  board,
  isMyTurn,
  gameOver,
  onCellClick,
  myMark,
}: BoardProps) {
  const winningCells = getWinningCells(board);

  const getCellStyle = (index: number, mark: Mark | null): string => {
    const isWinning = winningCells.includes(index);
    const isClickable = isMyTurn && !gameOver && !mark;

    let base =
      "relative w-full aspect-square flex items-center justify-center " +
      "text-4xl sm:text-5xl font-black rounded-2xl border-2 " +
      "transition-all duration-200 select-none ";

    if (isWinning) {
      base += "border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/30 scale-105 ";
    } else if (mark) {
      base += "border-gray-700 bg-gray-800 cursor-default ";
    } else if (isClickable) {
      base +=
        "border-gray-700 bg-gray-800/50 hover:bg-gray-700 hover:border-indigo-500 " +
        "cursor-pointer hover:scale-105 active:scale-95 ";
    } else {
      base += "border-gray-800 bg-gray-900 cursor-not-allowed opacity-60 ";
    }

    return base;
  };

  const getMarkStyle = (mark: Mark | null, index: number): string => {
    const isWinning = winningCells.includes(index);
    if (!mark) return "";
    if (mark === "X") {
      return isWinning ? "text-emerald-300" : "text-blue-400";
    }
    return isWinning ? "text-emerald-300" : "text-rose-400";
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {board.map((mark, index) => (
          <button
            key={index}
            className={getCellStyle(index, mark)}
            onClick={() => onCellClick(index)}
            disabled={!isMyTurn || gameOver || !!mark}
            aria-label={
              mark ? `Cell ${index + 1}: ${mark}` : `Cell ${index + 1}: empty`
            }
          >
            {mark && (
              <span
                className={`${getMarkStyle(mark, index)} animate-bounce-in`}
                style={{ lineHeight: 1 }}
              >
                {mark === "X" ? "✕" : "○"}
              </span>
            )}
            {!mark && isMyTurn && !gameOver && (
              <span className="opacity-0 hover:opacity-20 text-gray-400 transition-opacity duration-150 pointer-events-none">
                {myMark === "X" ? "✕" : "○"}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
