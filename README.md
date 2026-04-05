# Multiplayer Tic-Tac-Toe 🎮

A real-time multiplayer Tic-Tac-Toe game where two players can play against each other from anywhere. The game logic runs entirely on the server — so no cheating is possible from the client side.

**Live demo**: `[deployed URL here]`

---

## What's inside?

- **Classic mode** — play without any time pressure
- **Timed mode** — 30 seconds per turn, or you forfeit automatically
- **Leaderboard** — tracks your wins, losses, draws and win streaks
- **Auto-forfeit on disconnect** — if your opponent closes the tab, you win
- Works on mobile too

---

## Tech Stack

| What | Technology |
|------|-----------|
| Game server | [Nakama](https://heroiclabs.com/nakama/) (open-source game backend) |
| Backend logic | TypeScript (compiled and loaded into Nakama) |
| Database | PostgreSQL |
| Frontend | React + TypeScript + Vite |
| Styling | TailwindCSS |
| Local setup | Docker Compose |

---

## 1. Running Locally

### What you need first

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- [Node.js](https://nodejs.org/) 18+

### Step 1 — Build the backend

```bash
cd backend
npm install
npm run build
cd ..
```

This compiles the game logic into `backend/build/index.js`. Nakama picks this up automatically.

### Step 2 — Start the server

```bash
docker compose up
```

This starts the Nakama game server and PostgreSQL database. First time takes about 30 seconds.

Once it's running, open the Nakama developer console to confirm everything loaded:

```
http://localhost:7351
```

Login: `admin` / `password` → go to **Runtime → Modules** → you should see `index.js` listed there.

### Step 3 — Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

### How to test multiplayer locally

Since both players need different identities, **don't use two tabs in the same window** — they'll share storage and appear as the same user.

Instead, open:
- One tab in a **normal window**
- One tab in an **incognito window** (or use a different browser entirely)

Then click **Play Classic** in both within a second or two — they'll be matched automatically.

> If you change any backend code, rebuild with `npm run build` in the `backend/` folder, then run `docker compose restart nakama` to reload it.

---

## 2. How It Works

### The server is in charge of everything

When you click a cell, your browser just sends "I want to play cell 4" to the server. The server decides if that move is valid, updates the board, and sends the new state back to both players.

The client never computes anything on its own — it just displays what the server says.

```
You click cell 4
      ↓
Server checks: Is it your turn? Is that cell empty?
      ↓
Server updates the board
      ↓
Both players get the new board state instantly
```

This means:
- You can't fake a win
- You can't play out of turn
- You can't move to a cell that's already taken

### How matchmaking works

1. You click "Play Classic" → you enter a queue
2. Another player clicks "Play Classic" → they enter the same queue
3. Nakama detects two players waiting → creates a match → sends both players to the game
4. First player to join gets X, second gets O
5. X always goes first

### What happens when someone disconnects

If a player closes their tab mid-game, the server detects the disconnection and immediately declares the other player the winner. The remaining player sees "You Win!" on their screen.

---

## 3. Deploying to Production

### Deploy the game server (DigitalOcean)

The cheapest way is a $6/month DigitalOcean Droplet (Ubuntu 22.04).

**Set it up:**

```bash
# SSH into your droplet
ssh root@YOUR_IP

# Install Docker
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin
```

**Copy your files to the server:**

```bash
# Run this from your local machine
scp docker-compose.yml nakama-config.yml root@YOUR_IP:/opt/nakama/
scp -r backend/build root@YOUR_IP:/opt/nakama/backend/
```

**Start it:**

```bash
cd /opt/nakama
docker compose up -d
```

**Open the ports:**

```bash
ufw allow 7350
ufw allow 7351
ufw enable
```

Your Nakama server is now running at `http://YOUR_IP:7350`

**Want HTTPS?** Install Nginx + Certbot:

```bash
apt-get install -y nginx certbot python3-certbot-nginx

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
certbot --nginx -d nakama.yourdomain.com
```

### Deploy the frontend (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import your repo
3. Set **Root Directory** to `frontend`
4. Add these environment variables:

| Variable | Value |
|----------|-------|
| `VITE_NAKAMA_HOST` | Your server IP or domain |
| `VITE_NAKAMA_PORT` | `7350` (or `443` if using HTTPS) |
| `VITE_NAKAMA_KEY` | `defaultkey` |
| `VITE_NAKAMA_SSL` | `false` (or `true` if using HTTPS) |

5. Deploy — Vercel will auto-deploy every time you push to main.

---

## 4. API Reference

### RPC endpoints

These are server-side functions you can call from the frontend:

| Endpoint | What it does | Input | Output |
|----------|-------------|-------|--------|
| `submit_score` | Save game result to leaderboard | `{ "result": "win" }` | `{ success, stats }` |
| `get_leaderboard` | Fetch top 10 players | `{}` | List of players with stats |

### Message types (opcodes)

These are the real-time messages sent between client and server during a game:

| Code | Direction | What it means |
|------|-----------|---------------|
| 1 — MOVE | You → Server | "I want to play cell X" |
| 2 — STATE_UPDATE | Server → Both | Here's the current board |
| 3 — GAME_OVER | Server → Both | Game ended, here's the result |
| 4 — TIMER_UPDATE | Server → Both | Seconds remaining this turn |
| 5 — PLAYER_JOINED | Server → Both | Both players connected, game starting |

### Player stats (stored per user)

```json
{
  "wins": 5,
  "losses": 2,
  "draws": 1,
  "currentStreak": 3,
  "bestStreak": 5
}
```

---

## 5. Testing Checklist

**Basic game:**
- [ ] Open two incognito windows, click Play Classic in both → game starts
- [ ] Take turns clicking cells → moves show up on both screens
- [ ] Complete a game → winner screen shows correctly on both sides

**Timer mode:**
- [ ] Click Play Timed in both windows
- [ ] Let the timer run out → current player forfeits, opponent wins

**Disconnect handling:**
- [ ] Start a game, make one move, close one tab → remaining player wins

**Leaderboard:**
- [ ] Play a few games → go to `/leaderboard` → your stats appear

**Nakama console (debugging):**
Go to `http://localhost:7351` → login with `admin/password`
- **Runtime → Modules** — `index.js` should be listed
- **Matches** — see live matches while playing
- **Storage** — check player stats after games

---

## Project Structure

```
tic-tac-toe-nakama/
├── backend/
│   ├── src/
│   │   ├── match_handler.ts   ← all game logic lives here
│   │   ├── matchmaker.ts      ← pairs players together
│   │   ├── leaderboard.ts     ← win/loss tracking
│   │   └── rpc.ts             ← registers everything with Nakama
│   └── build/
│       └── index.js           ← compiled output (what Nakama actually runs)
├── frontend/
│   └── src/
│       ├── hooks/
│       │   ├── useNakama.ts   ← manages server connection
│       │   └── useMatch.ts    ← handles game state
│       ├── components/        ← Board, Timer, Leaderboard, etc.
│       └── pages/             ← Home, Game, Leaderboard
├── docker-compose.yml         ← runs Nakama + PostgreSQL locally
└── nakama-config.yml          ← server configuration
```
