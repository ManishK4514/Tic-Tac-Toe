// leaderboard.ts
// Leaderboard RPC handlers and player stats management.

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
}

interface SubmitScorePayload {
  result: "win" | "loss" | "draw";
}

var LEADERBOARD_ID = "global_wins";
var STATS_COLLECTION = "player_stats";

function initLeaderboard(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  try {
    // authoritative=false, sort=desc, operator=incr, resetSchedule=undefined, metadata={}, enableRanks=true
    nk.leaderboardCreate(LEADERBOARD_ID, false, nkruntime.SortOrder.DESCENDING, nkruntime.Operator.INCREMENTAL, null, {}, true);
    logger.debug("Leaderboard created: " + LEADERBOARD_ID);
  } catch (e) {
    // Leaderboard may already exist — not an error
    logger.debug("Leaderboard already exists or creation skipped: " + e);
  }
}

function getPlayerStats(nk: nkruntime.Nakama, userId: string): PlayerStats {
  try {
    var reads: nkruntime.StorageReadRequest[] = [
      { collection: STATS_COLLECTION, key: "stats", userId: userId },
    ];
    var objects = nk.storageRead(reads);
    if (objects.length > 0) {
      return objects[0].value as PlayerStats;
    }
  } catch (e) {
    // Return defaults on error
  }
  return { wins: 0, losses: 0, draws: 0, currentStreak: 0, bestStreak: 0 };
}

function savePlayerStats(nk: nkruntime.Nakama, userId: string, stats: PlayerStats): void {
  var writes: nkruntime.StorageWriteRequest[] = [
    {
      collection: STATS_COLLECTION,
      key: "stats",
      userId: userId,
      value: stats as unknown as { [key: string]: any },
      permissionRead: 2,  // public read
      permissionWrite: 0, // server-only write
    },
  ];
  nk.storageWrite(writes);
}

function submitScore(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  if (!ctx.userId) {
    throw new Error("No user ID in context");
  }

  var data: SubmitScorePayload;
  try {
    data = JSON.parse(payload) as SubmitScorePayload;
  } catch (e) {
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
  } else if (data.result === "loss") {
    stats.losses++;
    stats.currentStreak = 0;
  } else {
    stats.draws++;
    // Streak is preserved on draw
  }

  savePlayerStats(nk, ctx.userId, stats);

  logger.debug("Score submitted for " + ctx.userId + ": " + data.result);

  return JSON.stringify({ success: true, stats: stats });
}

function getLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var limit = 10;
  try {
    if (payload && payload !== "null" && payload !== "") {
      var parsed = JSON.parse(payload) as { limit?: number };
      if (parsed.limit && parsed.limit > 0 && parsed.limit <= 100) {
        limit = parsed.limit;
      }
    }
  } catch (e) {
    // Use default limit
  }

  var result = nk.leaderboardRecordsList(LEADERBOARD_ID, [], limit, "", 0);

  var records: { [key: string]: any }[] = [];
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
