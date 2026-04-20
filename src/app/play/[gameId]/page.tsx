import { Metadata } from "next";

import { requireViewer } from "@/lib/auth/session";
import { getGameAggregate } from "@/lib/data/store";

import { GameRoomClient } from "@/components/game/game-room-client";

export const metadata: Metadata = {
  title: "Play",
};

export default async function PlayPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const viewer = await requireViewer();
  const { gameId } = await params;
  const game = await getGameAggregate(viewer, gameId);

  return <GameRoomClient initialGame={game} viewer={viewer} />;
}
