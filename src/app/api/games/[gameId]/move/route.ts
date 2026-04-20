import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { playMove } from "@/lib/data/store";

const moveSchema = z.object({
  t1: z.number().int().min(1).max(9),
  t2: z.number().int().min(1).max(9),
  t3: z.number().int().min(1).max(9),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const viewer = await requireApiViewer();
    const { gameId } = await params;
    const move = moveSchema.parse(await request.json());
    const game = await playMove(viewer, gameId, move);
    return NextResponse.json({ game });
  } catch (error) {
    return handleRouteError(error);
  }
}
