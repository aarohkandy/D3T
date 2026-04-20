import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api";
import { markForcedTargetHintSeen } from "@/lib/data/store";
import { requireApiViewer } from "@/lib/auth/session";

export async function POST() {
  try {
    const viewer = await requireApiViewer();
    await markForcedTargetHintSeen(viewer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
