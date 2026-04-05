"use strict";
// match_handler.ts
// Server-authoritative Tic-Tac-Toe match handler for Nakama runtime.
// ALL game logic lives here. The client is a pure view layer.
var OpCode = {
    MOVE: 1,
    STATE_UPDATE: 2,
    GAME_OVER: 3,
    TIMER_UPDATE: 4,
    PLAYER_JOINED: 5,
};
var WIN_CONDITIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6], // diagonals
];
var TICK_RATE = 5; // 5 ticks per second
var TURN_TICKS = 150; // 30 seconds × 5 ticks/sec
function checkWinner(board, mark) {
    for (var i = 0; i < WIN_CONDITIONS.length; i++) {
        var combo = WIN_CONDITIONS[i];
        if (board[combo[0]] === mark && board[combo[1]] === mark && board[combo[2]] === mark) {
            return true;
        }
    }
    return false;
}
function isDraw(board) {
    for (var i = 0; i < board.length; i++) {
        if (board[i] === null)
            return false;
    }
    return true;
}
function broadcastState(dispatcher, state) {
    var payload = {
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
function broadcastGameOver(dispatcher, state) {
    var payload = {
        winner: state.winner,
        board: state.board,
        marks: state.marks,
    };
    dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify(payload), null, null, true);
}
function matchInit(ctx, logger, nk, params) {
    var timerEnabled = false;
    if (params && params["timerEnabled"] === "true") {
        timerEnabled = true;
    }
    var label = { open: 1, timerEnabled: timerEnabled };
    var state = {
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
        state: state,
        tickRate: TICK_RATE,
        label: JSON.stringify(label),
    };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    var s = state;
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
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    var s = state;
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        s.players[presence.userId] = presence;
        // Assign marks: first player gets X, second gets O
        var playerCount = Object.keys(s.marks).length;
        if (playerCount === 0) {
            s.marks[presence.userId] = "X";
        }
        else {
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
        var label = { open: 0, timerEnabled: s.timerEnabled };
        dispatcher.matchLabelUpdate(JSON.stringify(label));
        // Build player info for PLAYER_JOINED message
        var playerInfo = {};
        for (var playerId in s.players) {
            playerInfo[playerId] = {
                userId: playerId,
                username: s.players[playerId].username,
                mark: s.marks[playerId],
            };
        }
        dispatcher.broadcastMessage(OpCode.PLAYER_JOINED, JSON.stringify({
            players: playerInfo,
            turn: s.turn,
            marks: s.marks,
        }), null, null, true);
        logger.debug("Game started! X=" + s.turn);
    }
    return { state: s };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    var s = state;
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
    return { state: s };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    var s = state;
    // Terminate if game is over with no players left
    if (s.gameOver && Object.keys(s.players).length === 0) {
        return null;
    }
    // If game is over just keep the loop running briefly for late joiners to get final state
    if (s.gameOver) {
        return { state: s };
    }
    // Only run game logic when both players are present
    var playerCount = Object.keys(s.players).length;
    if (playerCount < 2) {
        return { state: s };
    }
    // --- Timer logic ---
    if (s.timerEnabled && s.turn !== "") {
        s.timerTicks--;
        // Broadcast timer update every tick
        dispatcher.broadcastMessage(OpCode.TIMER_UPDATE, JSON.stringify({ timerTicks: s.timerTicks, turn: s.turn }), null, null, true);
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
            return { state: s };
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
        var data;
        try {
            var rawStr = String.fromCharCode.apply(null, Array.from(new Uint8Array(msg.data)));
            data = JSON.parse(rawStr);
        }
        catch (e) {
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
            return { state: s };
        }
        // Check for draw
        if (isDraw(s.board)) {
            s.winner = "draw";
            s.gameOver = true;
            broadcastState(dispatcher, s);
            broadcastGameOver(dispatcher, s);
            logger.debug("Game over! Draw.");
            return { state: s };
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
    return { state: s };
}
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    var s = state;
    logger.debug("Match terminating with grace seconds: " + graceSeconds);
    return { state: s };
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
    var s = state;
    return { state: s, data: "" };
}
// leaderboard.ts
// Leaderboard RPC handlers and player stats management.
var LEADERBOARD_ID = "global_wins";
var STATS_COLLECTION = "player_stats";
function initLeaderboard(nk, logger) {
    try {
        // authoritative=false, sort=desc, operator=incr, resetSchedule=undefined, metadata={}, enableRanks=true
        nk.leaderboardCreate(LEADERBOARD_ID, false, "descending" /* nkruntime.SortOrder.DESCENDING */, "increment" /* nkruntime.Operator.INCREMENTAL */, null, {}, true);
        logger.debug("Leaderboard created: " + LEADERBOARD_ID);
    }
    catch (e) {
        // Leaderboard may already exist — not an error
        logger.debug("Leaderboard already exists or creation skipped: " + e);
    }
}
function getPlayerStats(nk, userId) {
    try {
        var reads = [
            { collection: STATS_COLLECTION, key: "stats", userId: userId },
        ];
        var objects = nk.storageRead(reads);
        if (objects.length > 0) {
            return objects[0].value;
        }
    }
    catch (e) {
        // Return defaults on error
    }
    return { wins: 0, losses: 0, draws: 0, currentStreak: 0, bestStreak: 0 };
}
function savePlayerStats(nk, userId, stats) {
    var writes = [
        {
            collection: STATS_COLLECTION,
            key: "stats",
            userId: userId,
            value: stats,
            permissionRead: 2, // public read
            permissionWrite: 0, // server-only write
        },
    ];
    nk.storageWrite(writes);
}
function submitScore(ctx, logger, nk, payload) {
    if (!ctx.userId) {
        throw new Error("No user ID in context");
    }
    var data;
    try {
        data = JSON.parse(payload);
    }
    catch (e) {
        throw new Error("Invalid payload: " + e);
    }
    if (!data.result || (data.result !== "win" && data.result !== "loss" && data.result !== "draw")) {
        throw new Error("Invalid result value. Must be 'win', 'loss', or 'draw'");
    }
    var stats = getPlayerStats(nk, ctx.userId);
    if (data.result === "win") {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.bestStreak) {
            stats.bestStreak = stats.currentStreak;
        }
        // Submit +1 to leaderboard
        nk.leaderboardRecordWrite(LEADERBOARD_ID, ctx.userId, ctx.username || "", 1, 0, {});
    }
    else if (data.result === "loss") {
        stats.losses++;
        stats.currentStreak = 0;
    }
    else {
        stats.draws++;
        // Streak is preserved on draw
    }
    savePlayerStats(nk, ctx.userId, stats);
    logger.debug("Score submitted for " + ctx.userId + ": " + data.result);
    return JSON.stringify({ success: true, stats: stats });
}
function getLeaderboard(ctx, logger, nk, payload) {
    var limit = 10;
    try {
        if (payload && payload !== "null" && payload !== "") {
            var parsed = JSON.parse(payload);
            if (parsed.limit && parsed.limit > 0 && parsed.limit <= 100) {
                limit = parsed.limit;
            }
        }
    }
    catch (e) {
        // Use default limit
    }
    var result = nk.leaderboardRecordsList(LEADERBOARD_ID, [], limit, "", 0);
    var records = [];
    if (result && result.records) {
        for (var i = 0; i < result.records.length; i++) {
            var record = result.records[i];
            // Fetch player stats for streak info
            var stats = getPlayerStats(nk, record.ownerId);
            records.push({
                rank: record.rank,
                userId: record.ownerId,
                username: record.username,
                wins: record.score,
                numScore: record.numScore,
                bestStreak: stats.bestStreak,
                currentStreak: stats.currentStreak,
                losses: stats.losses,
                draws: stats.draws,
            });
        }
    }
    return JSON.stringify({ records: records, total: records.length });
}
// matchmaker.ts
// Handles the matchmakerMatched hook.
// When 2 players are matched by Nakama's matchmaker, this creates an authoritative match.
function matchmakerMatched(ctx, logger, nk, matches) {
    // Determine if any ticket requested timer mode
    var timerEnabled = false;
    for (var i = 0; i < matches.length; i++) {
        var match = matches[i];
        if (match.properties && match.properties["mode"] === "timed") {
            timerEnabled = true;
            break;
        }
    }
    logger.debug("Matchmaker matched " + matches.length + " players. timerEnabled=" + timerEnabled);
    // Create a new authoritative match
    var params = {
        timerEnabled: timerEnabled ? "true" : "false",
    };
    var matchId = nk.matchCreate("tictactoe", params);
    logger.debug("Created match: " + matchId);
    return matchId;
}
// rpc.ts
// InitModule entry point. This is the first function called by the Nakama runtime.
// It registers all match handlers, RPC functions, and hooks.
//
// IMPORTANT: This file is the last in tsconfig "files" array so all other
// functions (matchInit, matchJoin, etc.) are already in scope when this runs.
function InitModule(ctx, logger, nk, initializer) {
    logger.info("Initializing Tic-Tac-Toe module...");
    // Register the match handler under the name "tictactoe"
    initializer.registerMatch("tictactoe", {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal,
    });
    // Register the matchmaker hook — fires when 2 players are matched
    initializer.registerMatchmakerMatched(matchmakerMatched);
    // Register RPC endpoints
    initializer.registerRpc("get_leaderboard", getLeaderboard);
    initializer.registerRpc("submit_score", submitScore);
    // Initialize leaderboard on startup
    initLeaderboard(nk, logger);
    logger.info("Tic-Tac-Toe module loaded successfully.");
}
