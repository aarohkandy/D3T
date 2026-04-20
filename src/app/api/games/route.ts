import { NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { createPrivateGame } from "@/lib/data/store";

export async function POST() {
  try {
    const viewer = await requireApiViewer();
    const game = await createPrivateGame(viewer);
    return NextResponse.json({ game });
  } catch (error) {
    return handleRouteError(error);
  }
}
