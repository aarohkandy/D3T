import { getViewer } from "@/lib/auth/session";
import { isChallengeOnlyBeta } from "@/lib/config";
import { getDashboardData } from "@/lib/data/store";

import { GameRoomClient } from "@/components/game/game-room-client";
import { PlayHub } from "@/components/play-hub";

export default async function Home() {
  const viewer = await getViewer();
  const hub = viewer ? await getDashboardData(viewer) : null;

  if (viewer && hub?.activeGame) {
    return <GameRoomClient initialGame={hub.activeGame} viewer={viewer} />;
  }

  return <PlayHub viewer={viewer} initialHub={hub} challengeOnlyBeta={isChallengeOnlyBeta()} />;
}
