import { NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { getGameAggregate } from "@/lib/data/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const viewer = await requireApiViewer();
    const { gameId } = await params;
    const game = await getGameAggregate(viewer, gameId);
    return NextResponse.json({ game });
  } catch (error) {
    return handleRouteError(error);
  }
}
