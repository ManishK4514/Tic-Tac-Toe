// matchmaker.ts
// Handles the matchmakerMatched hook.
// When 2 players are matched by Nakama's matchmaker, this creates an authoritative match.

function matchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string | void {
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
  var params: { [key: string]: string } = {
    timerEnabled: timerEnabled ? "true" : "false",
  };

  var matchId = nk.matchCreate("tictactoe", params);
  logger.debug("Created match: " + matchId);

  return matchId;
}
