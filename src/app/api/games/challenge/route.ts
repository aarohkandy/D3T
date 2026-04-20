import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { createChallengeGame } from "@/lib/data/store";

const challengeSchema = z.object({
  username: z.string().trim().min(2).max(18),
});

export async function POST(request: Request) {
  try {
    const viewer = await requireApiViewer();
    const { username } = challengeSchema.parse(await request.json());
    const game = await createChallengeGame(viewer, username);
    return NextResponse.json({ game });
  } catch (error) {
    return handleRouteError(error);
  }
}
