import { redirect } from "next/navigation";

import { getViewer } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/store";

import { PlayHub } from "@/components/play-hub";

export default async function Home() {
  const viewer = await getViewer();
  const hub = viewer ? await getDashboardData(viewer) : null;

  if (viewer && hub?.activeGame) {
    redirect(`/play/${hub.activeGame.id}`);
  }

  return <PlayHub viewer={viewer} initialHub={hub} />;
}
