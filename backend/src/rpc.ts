// rpc.ts
// InitModule entry point. This is the first function called by the Nakama runtime.
// It registers all match handlers, RPC functions, and hooks.
//
// IMPORTANT: This file is the last in tsconfig "files" array so all other
// functions (matchInit, matchJoin, etc.) are already in scope when this runs.

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): Error | void {
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
