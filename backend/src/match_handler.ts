// match_handler.ts
// Server-authoritative Tic-Tac-Toe match handler for Nakama runtime.
// ALL game logic lives here. The client is a pure view layer.

interface MatchState {
  board: (string | null)[];
  marks: { [userId: string]: "X" | "O" };
  turn: string;                              // userId of the player whose turn it is
  winner: string | null;                     // userId of winner, "draw", or null
  gameOver: boolean;
  players: { [userId: string]: nkruntime.Presence };
  timerEnabled: boolean;
  timerTicks: number;                        // ticks remaining for current player's turn
  emptyBoardSent: boolean;                   // whether we've sent initial state to both players
}

interface MatchLabel {
  open: number;
  timerEnabled: boolean;
}

var OpCode = {
  MOVE: 1,
  STATE_UPDATE: 2,
  GAME_OVER: 3,
  TIMER_UPDATE: 4,
  PLAYER_JOINED: 5,
};

var WIN_CONDITIONS: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

var TICK_RATE = 5;          // 5 ticks per second
var TURN_TICKS = 150;       // 30 seconds × 5 ticks/sec

function checkWinner(board: (string | null)[], mark: string): boolean {
  for (var i = 0; i < WIN_CONDITIONS.length; i++) {
    var combo = WIN_CONDITIONS[i];
    if (board[combo[0]] === mark && board[combo[1]] === mark && board[combo[2]] === mark) {
      return true;
    }
  }
  return false;
}

function isDraw(board: (string | null)[]): boolean {
  for (var i = 0; i < board.length; i++) {
    if (board[i] === null) return false;
  }
  return true;
}

function broadcastState(
  dispatcher: nkruntime.MatchDispatcher,
  state: MatchState
): void {
  var payload: { [key: string]: any } = {
    board: state.board,
    marks: state.marks,
    turn: state.turn,
    winner: state.winner,
    gameOver: state.gameOver,
    timerEnabled: state.timerEnabled,
    timerTicks: state.timerTicks,
  };
  dispatcher.broadcastMessage(OpCode.STATE_UPDATE, JSON.stringify(payload), null, null, true);
}

function broadcastGameOver(
  dispatcher: nkruntime.MatchDispatcher,
  state: MatchState
): void {
  var payload: { [key: string]: any } = {
    winner: state.winner,
    board: state.board,
    marks: state.marks,
  };
  dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(payload), null, null, true);
}

function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  var timerEnabled = false;
  if (params && params["timerEnabled"] === "true") {
    timerEnabled = true;
  }

  var label: MatchLabel = { open: 1, timerEnabled: timerEnabled };

  var state: MatchState = {
    board: [null, null, null, null, null, null, null, null, null],
    marks: {},
    turn: "",
    winner: null,
    gameOver: false,
    players: {},
    timerEnabled: timerEnabled,
    timerTicks: TURN_TICKS,
    emptyBoardSent: false,
  };

  logger.debug("Match initialized, timerEnabled=" + timerEnabled);

  return {
    state: state as unknown as nkruntime.MatchState,
    tickRate: TICK_RATE,
    label: JSON.stringify(label),
  };
}

function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } | null {
  var s = state as unknown as MatchState;

  var playerCount = Object.keys(s.players).length;
  if (playerCount >= 2) {
    return { state: state, accept: false, rejectMessage: "Match is full" };
  }

  // Reject if game is already over
  if (s.gameOver) {
    return { state: state, accept: false, rejectMessage: "Match has ended" };
  }

  return { state: state, accept: true };
}

function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var s = state as unknown as MatchState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    s.players[presence.userId] = presence;

    // Assign marks: first player gets X, second gets O
    var playerCount = Object.keys(s.marks).length;
    if (playerCount === 0) {
      s.marks[presence.userId] = "X";
    } else {
      s.marks[presence.userId] = "O";
    }

    logger.debug("Player joined: " + presence.userId + " as " + s.marks[presence.userId]);
  }

  // When both players are in, start the game
  if (Object.keys(s.players).length === 2) {
    // X always goes first — find the X player
    for (var uid in s.marks) {
      if (s.marks[uid] === "X") {
        s.turn = uid;
        break;
      }
    }
    s.timerTicks = TURN_TICKS;

    // Update label to mark match as no longer open
    var label: MatchLabel = { open: 0, timerEnabled: s.timerEnabled };
    dispatcher.matchLabelUpdate(JSON.stringify(label));

    // Build player info for PLAYER_JOINED message
    var playerInfo: { [key: string]: any } = {};
    for (var playerId in s.players) {
      playerInfo[playerId] = {
        userId: playerId,
        username: s.players[playerId].username,
        mark: s.marks[playerId],
      };
    }

    dispatcher.broadcastMessage(
      OpCode.PLAYER_JOINED,
      JSON.stringify({
        players: playerInfo,
        turn: s.turn,
        marks: s.marks,
      }),
      null,
      null,
      true
    );

    logger.debug("Game started! X=" + s.turn);
  }

  return { state: s as unknown as nkruntime.MatchState };
}

function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var s = state as unknown as MatchState;

  for (var i = 0; i < presences.length; i++) {
    var leavingUserId = presences[i].userId;
    delete s.players[leavingUserId];
    logger.debug("Player left: " + leavingUserId);
  }

  // If the game is still active and a player disconnected, forfeit
  if (!s.gameOver && Object.keys(s.players).length > 0) {
    s.gameOver = true;
    // The remaining player wins
    var remainingPlayers = Object.keys(s.players);
    s.winner = remainingPlayers[0];
    broadcastGameOver(dispatcher, s);
    logger.debug("Player disconnected mid-game. Winner: " + s.winner);
  }

  return { state: s as unknown as nkruntime.MatchState };
}

function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  var s = state as unknown as MatchState;

  // Terminate if game is over with no players left
  if (s.gameOver && Object.keys(s.players).length === 0) {
    return null;
  }

  // If game is over just keep the loop running briefly for late joiners to get final state
  if (s.gameOver) {
    return { state: s as unknown as nkruntime.MatchState };
  }

  // Only run game logic when both players are present
  var playerCount = Object.keys(s.players).length;
  if (playerCount < 2) {
    return { state: s as unknown as nkruntime.MatchState };
  }

  // --- Timer logic ---
  if (s.timerEnabled && s.turn !== "") {
    s.timerTicks--;
    // Broadcast timer update every tick
    dispatcher.broadcastMessage(
      OpCode.TIMER_UPDATE,
      JSON.stringify({ timerTicks: s.timerTicks, turn: s.turn }),
      null,
      null,
      true
    );

    if (s.timerTicks <= 0) {
      // Auto-forfeit the current player
      s.gameOver = true;
      // The other player wins
      for (var uid in s.players) {
        if (uid !== s.turn) {
          s.winner = uid;
          break;
        }
      }
      logger.debug("Timer expired. Winner by forfeit: " + s.winner);
      broadcastGameOver(dispatcher, s);
      return { state: s as unknown as nkruntime.MatchState };
    }
  }

  // --- Process incoming move messages ---
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];

    if (msg.opCode !== OpCode.MOVE) {
      continue;
    }

    var senderId = msg.sender.userId;

    // Reject if not the current player's turn
    if (senderId !== s.turn) {
      logger.warn("Out-of-turn move rejected from: " + senderId);
      continue;
    }

    // Parse the move payload — msg.data is ArrayBuffer, decode to string first
    var data: { cell?: number };
    try {
      var rawStr = String.fromCharCode.apply(null, Array.from(new Uint8Array(msg.data)));
      data = JSON.parse(rawStr);
    } catch (e) {
      logger.warn("Failed to parse move data from: " + senderId + " error: " + e);
      continue;
    }

    var cell = data.cell;

    // Validate cell index
    if (cell === undefined || cell < 0 || cell > 8) {
      logger.warn("Invalid cell index " + cell + " from: " + senderId);
      continue;
    }

    // Reject if cell is already occupied
    if (s.board[cell] !== null) {
      logger.warn("Cell " + cell + " already occupied, rejected from: " + senderId);
      continue;
    }

    // Apply the move
    var mark = s.marks[senderId];
    s.board[cell] = mark;
    logger.debug("Player " + senderId + " played " + mark + " at cell " + cell);

    // Check for win
    if (checkWinner(s.board, mark)) {
      s.winner = senderId;
      s.gameOver = true;
      broadcastState(dispatcher, s);
      broadcastGameOver(dispatcher, s);
      logger.debug("Game over! Winner: " + senderId);
      return { state: s as unknown as nkruntime.MatchState };
    }

    // Check for draw
    if (isDraw(s.board)) {
      s.winner = "draw";
      s.gameOver = true;
      broadcastState(dispatcher, s);
      broadcastGameOver(dispatcher, s);
      logger.debug("Game over! Draw.");
      return { state: s as unknown as nkruntime.MatchState };
    }

    // Switch turn to the other player
    for (var nextUid in s.players) {
      if (nextUid !== senderId) {
        s.turn = nextUid;
        break;
      }
    }

    // Reset timer for next player
    if (s.timerEnabled) {
      s.timerTicks = TURN_TICKS;
    }

    // Broadcast updated state to all players
    broadcastState(dispatcher, s);
  }

  return { state: s as unknown as nkruntime.MatchState };
}

function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  var s = state as unknown as MatchState;
  logger.debug("Match terminating with grace seconds: " + graceSeconds);
  return { state: s as unknown as nkruntime.MatchState };
}

function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  var s = state as unknown as MatchState;
  return { state: s as unknown as nkruntime.MatchState, data: "" };
}
