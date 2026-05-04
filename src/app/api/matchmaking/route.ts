import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { getQuickplayStatus, joinQuickplay, leaveQuickplay } from "@/lib/data/store";

const quickplaySchema = z.object({
  presetId: z.enum(["bullet", "blitz", "rapid", "classic"]).default("blitz"),
});

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const quickplay = await getQuickplayStatus(viewer);
    return NextResponse.json({ quickplay });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireApiViewer();
    const payload = quickplaySchema.parse(await request.json());
    const quickplay = await joinQuickplay(viewer, payload.presetId);
    return NextResponse.json({ quickplay });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  try {
    const viewer = await requireApiViewer();
    const quickplay = await leaveQuickplay(viewer);
    return NextResponse.json({ quickplay });
  } catch (error) {
    return handleRouteError(error);
  }
}
