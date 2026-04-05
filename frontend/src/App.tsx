import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NakamaProvider } from "./NakamaProvider";
import Home from "./pages/Home";
import Game from "./pages/Game";
import LeaderboardPage from "./pages/LeaderboardPage";

export default function App() {
  return (
    <NakamaProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:matchId" element={<Game />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </NakamaProvider>
  );
}
