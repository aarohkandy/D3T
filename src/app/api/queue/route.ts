import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { cancelQuickPlay, queueForQuickPlay } from "@/lib/data/store";

const queueSchema = z.object({
  presetId: z.enum(["bullet", "blitz", "rapid", "classic"]),
});

export async function POST(request: Request) {
  try {
    const viewer = await requireApiViewer();
    const payload = queueSchema.parse(await request.json());
    const result = await queueForQuickPlay(viewer, payload.presetId);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const viewer = await requireApiViewer();
    await cancelQuickPlay(viewer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
