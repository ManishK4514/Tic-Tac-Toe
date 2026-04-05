# Multiplayer Tic-Tac-Toe — Nakama Backend

A production-ready, real-time multiplayer Tic-Tac-Toe game built with a **server-authoritative** architecture using [Nakama](https://heroiclabs.com/nakama/) as the game backend.

**Live demo**: `[deployed URL here]`  
**Nakama server**: `[Nakama server URL here]`

---

## Table of Contents

1. [Setup & Installation](#1-setup--installation)
2. [Architecture & Design Decisions](#2-architecture--design-decisions)
3. [Deployment Process](#3-deployment-process)
4. [API & Server Configuration](#4-api--server-configuration)
5. [How to Test Multiplayer](#5-how-to-test-multiplayer)

---

## 1. Setup & Installation

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- [Node.js](https://nodejs.org/) 18+ and npm

### Clone the repository

```bash
git clone <repo-url>
cd tic-tac-toe-nakama
```

### Step 1 — Build the Nakama backend module

```bash
cd backend
npm install
npm run build
cd ..
```

This compiles the TypeScript backend to `backend/build/index.js`, which Nakama loads as its runtime module.

### Step 2 — Start the Nakama server (Docker Compose)

```bash
docker compose up
```

This starts:
- **CockroachDB** on port `26257` — Nakama's database
- **Nakama** on ports `7350` (HTTP API), `7351` (developer console), `7349` (gRPC)

First startup takes ~30 seconds for DB migrations. Verify it's running:

```
http://localhost:7351
```

Login with `admin` / `password`. Navigate to **Runtime → Modules** — you should see `index.js` listed.

> **Note**: If you change backend code, run `npm run build` in `backend/`, then `docker compose restart nakama` to reload the module.

### Step 3 — Start the frontend (development)

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

Open `http://localhost:3000` in two different browser profiles (or incognito windows) to test multiplayer locally.

---

## 2. Architecture & Design Decisions

### Why Nakama?

Nakama is an open-source game server designed specifically for real-time multiplayer games. It provides:
- **Authoritative match handlers** — game logic runs on the server, not the client
- **Built-in matchmaking** — finds opponents and creates matches automatically
- **Real-time socket communication** — low-latency bidirectional messaging
- **Leaderboards & Storage** — persistent player stats without a custom database layer
- **Self-hostable** — full control, no vendor lock-in for production

### Server-Authoritative Design

All game logic runs exclusively on the Nakama server. The client is a pure view layer:

```
Client A                  Nakama Server              Client B
   │                           │                          │
   │── MOVE (cell=4) ─────────▶│                          │
   │                    Validate move                      │
   │                    Update board state                 │
   │                    Check win conditions               │
   │◀── STATE_UPDATE ──────────│─── STATE_UPDATE ─────────▶│
   │                           │                          │
```

The server rejects:
- Moves from the wrong player (out-of-turn)
- Moves to already-occupied cells
- Moves with invalid cell indices (not 0–8)
- Moves after the game is over

The client **never computes** game state — it only sends move intents and renders what the server tells it.

### Matchmaking Flow

```
Player A clicks "Play"          Player B clicks "Play"
        │                                │
        ▼                                ▼
socket.addMatchmaker()           socket.addMatchmaker()
        │                                │
        └──── Nakama Matchmaker ─────────┘
                     │
              matchmakerMatched()
              (server-side hook)
                     │
              nk.matchCreate("tictactoe")
                     │
              Returns matchId to both clients
                     │
        ┌────────────┘────────────┐
        ▼                         ▼
socket.joinMatch(matchId)   socket.joinMatch(matchId)
        │                         │
        └── matchJoin() assigns X and O ──┘
                     │
           PLAYER_JOINED broadcast
           (game begins)
```

### Message Opcodes

| OpCode | Direction | Description |
|--------|-----------|-------------|
| `1` MOVE | Client → Server | Player makes a move (cell index 0–8) |
| `2` STATE_UPDATE | Server → All | Full board state after every move |
| `3` GAME_OVER | Server → All | Game result (winner userId or "draw") |
| `4` TIMER_UPDATE | Server → All | Remaining ticks for current turn (timed mode) |
| `5` PLAYER_JOINED | Server → All | Both players connected, game starting |

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/match_handler.ts` | Core server-authoritative game logic |
| `backend/src/matchmaker.ts` | Matchmaker hook — creates match when 2 players found |
| `backend/src/leaderboard.ts` | Leaderboard RPCs and player stats storage |
| `backend/src/rpc.ts` | `InitModule` — registers everything with Nakama |
| `frontend/src/hooks/useNakama.ts` | Nakama client/session/socket management |
| `frontend/src/hooks/useMatch.ts` | Match state, socket message handling, sendMove |

### Bonus Features

- **Timer mode** — each player has 30 seconds per turn (150 ticks at 5Hz); auto-forfeit on timeout
- **Leaderboard** — global win leaderboard with win/loss/draw stats and streaks
- **Graceful disconnection** — if a player disconnects mid-game, their opponent wins automatically
- **Multiple concurrent sessions** — Nakama handles this natively; each match is an isolated actor

---

## 3. Deployment Process

### Nakama Server — DigitalOcean Droplet

#### Provision the server

1. Create a **$6/month Ubuntu 22.04 Droplet** on DigitalOcean (1 vCPU, 1GB RAM is sufficient)
2. Add your SSH key during creation

#### Install Docker on the droplet

```bash
ssh root@YOUR_DROPLET_IP

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin
```

#### Deploy Nakama

```bash
# On your local machine — copy the required files
scp docker-compose.yml nakama-config.yml root@YOUR_DROPLET_IP:/opt/nakama/
scp -r backend/build root@YOUR_DROPLET_IP:/opt/nakama/backend/

# On the droplet
cd /opt/nakama
docker compose up -d
```

#### Open firewall ports

```bash
ufw allow 7350   # HTTP API (frontend connects here)
ufw allow 7351   # Developer console
ufw enable
```

#### Optional — HTTPS with Nginx + Let's Encrypt

```bash
apt-get install -y nginx certbot python3-certbot-nginx

# Create Nginx config for your domain
cat > /etc/nginx/sites-available/nakama <<'EOF'
server {
    server_name nakama.yourdomain.com;
    location / {
        proxy_pass http://localhost:7350;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
ln -s /etc/nginx/sites-available/nakama /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d nakama.yourdomain.com
```

With SSL, set `VITE_NAKAMA_SSL=true` and `VITE_NAKAMA_PORT=443` in Vercel's environment variables.

### Frontend — Vercel

1. Push the `tic-tac-toe-nakama/` directory to a **public GitHub repository**
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Set **Root Directory** to `frontend`
4. Add the following **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `VITE_NAKAMA_HOST` | `YOUR_DROPLET_IP` or `nakama.yourdomain.com` |
   | `VITE_NAKAMA_PORT` | `7350` (or `443` if using SSL) |
   | `VITE_NAKAMA_KEY` | `defaultkey` |
   | `VITE_NAKAMA_SSL` | `false` (or `true` if using SSL) |

5. Click **Deploy** — Vercel auto-deploys on every push to main

> **Updating the backend**: After any backend code change, run `npm run build` in `backend/`, copy the new `build/index.js` to the server, and run `docker compose restart nakama`.

---

## 4. API & Server Configuration

### Nakama Server Config (`nakama-config.yml`)

```yaml
name: nakama1
runtime:
  js_entrypoint: index.js    # Entry point for the TypeScript module bundle
socket:
  server_key: defaultkey     # Must match VITE_NAKAMA_KEY in frontend
  port: 7350
console:
  port: 7351
  username: admin
  password: password         # Change this in production!
session:
  token_expiry_sec: 7200     # 2-hour session tokens
```

### RPC Endpoints

RPCs are called via `client.rpc(session, id, payload)`.

| ID | Method | Payload | Response | Description |
|----|--------|---------|----------|-------------|
| `submit_score` | POST | `{ "result": "win" \| "loss" \| "draw" }` | `{ success, stats }` | Submit game result; updates leaderboard + player stats |
| `get_leaderboard` | POST | `{}` | `{ records: [...] }` | Get top 10 players by wins |

#### `submit_score` payload
```json
{ "result": "win" }
```

#### `get_leaderboard` response
```json
{
  "records": [
    {
      "rank": 1,
      "userId": "abc123",
      "username": "SwiftFox42",
      "wins": 15,
      "losses": 3,
      "draws": 1,
      "bestStreak": 7,
      "currentStreak": 3
    }
  ]
}
```

### Match Registration

The match type is registered as `"tictactoe"` and can be created with optional params:

```
nk.matchCreate("tictactoe", { timerEnabled: "true" | "false" })
```

### Nakama Storage Schema

**Collection**: `player_stats`  
**Key**: `stats`  
**Permission**: Public read, server-only write

```json
{
  "wins": 0,
  "losses": 0,
  "draws": 0,
  "currentStreak": 0,
  "bestStreak": 0
}
```

---

## 5. How to Test Multiplayer

### Local Testing (Two Browser Profiles)

The easiest way to test both players locally:

1. Start Nakama: `docker compose up`
2. Start frontend: `cd frontend && npm run dev`
3. Open **two incognito windows** (or use Chrome + Firefox) — each gets a different `localStorage` entry and thus a different Nakama device ID
4. In both windows, navigate to `http://localhost:3000`
5. Click **"Play Classic"** in both windows within a few seconds
6. The matchmaker finds both players and redirects them to a shared game screen
7. Take turns clicking cells — each move is validated server-side and synced in real time

### Testing Timer Mode

1. Click **"Play Timed"** in both windows
2. When the game starts, let the timer run out on your turn
3. Nakama automatically forfeits the current player and declares the other player the winner

### Testing Disconnection Handling

1. Start a game in both windows
2. Make at least one move
3. Close one of the browser tabs
4. The remaining player's screen shows "You Win!" (the disconnected player forfeits)

### Testing via Nakama Console

The developer console at `http://localhost:7351` (admin/password) is invaluable for debugging:

- **Runtime → Modules** — verify `index.js` is loaded
- **Matches** — see active matches, inspect state in real time
- **Storage** — browse `player_stats` objects after playing
- **Leaderboard** — view the `global_wins` leaderboard entries
- **Accounts** — see all authenticated device users

### Testing with a Friend (Deployed)

1. Share the deployed frontend URL
2. Both players open it simultaneously
3. Click "Play Classic" — you're matched automatically
4. Play from any device, including mobile (the UI is responsive)

### Full Game Flow Walkthrough

```
1. Player opens frontend → auto-authenticates with device ID → socket connects
2. Player clicks "Play Classic" → joins matchmaker queue
3. Opponent joins queue → Nakama matchmakerMatched hook fires
4. Server creates authoritative match → returns matchId to both clients
5. Both clients joinMatch(matchId) → server assigns X to first joiner, O to second
6. Server broadcasts PLAYER_JOINED → game begins; X player goes first
7. X player clicks cell 4 → MOVE sent to server
8. Server validates: correct player, empty cell, valid index
9. Server updates board, checks win/draw, broadcasts STATE_UPDATE
10. O player's board updates instantly
11. Game continues until win/draw/disconnect
12. GAME_OVER broadcast → both clients show result
13. Frontend calls submit_score RPC → leaderboard updated
```

---

## Development Notes

### Backend Build Requirements

The Nakama JavaScript runtime has strict constraints:
- TypeScript must target `ES5` with `outFile` (single-file bundle)
- No `"module"` field in tsconfig — the runtime is not a Node.js environment
- All source files compiled into a single `index.js`
- Handler functions must be global `function` declarations (not arrow functions)

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_NAKAMA_HOST` | `localhost` | Nakama server hostname or IP |
| `VITE_NAKAMA_PORT` | `7350` | Nakama HTTP port |
| `VITE_NAKAMA_KEY` | `defaultkey` | Server key (must match `socket.server_key` in config) |
| `VITE_NAKAMA_SSL` | `false` | Set to `true` when using HTTPS |

### Changing the Server Key (Production)

1. Update `nakama-config.yml`: `socket.server_key: your-production-key`
2. Update Vercel env var: `VITE_NAKAMA_KEY=your-production-key`
3. Rebuild and redeploy both

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Game Backend | Nakama 3.22 (TypeScript runtime) |
| Database | CockroachDB (Nakama-managed) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS |
| State management | React hooks (useState, useContext) |
| Nakama SDK | `@heroiclabs/nakama-js` |
| Local infra | Docker Compose |
| Server deployment | DigitalOcean Droplet + Docker |
| Frontend deployment | Vercel |
