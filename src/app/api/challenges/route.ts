import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { createChallenge, getPendingChallenges } from "@/lib/data/store";

const challengeSchema = z.object({
  username: z.string().trim().min(2).max(18),
  presetId: z.enum(["bullet", "blitz", "rapid", "classic"]).default("blitz"),
});

export async function GET() {
  try {
    const viewer = await requireApiViewer();
    const challenges = await getPendingChallenges(viewer);
    return NextResponse.json(challenges);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await requireApiViewer();
    const payload = challengeSchema.parse(await request.json());
    const challenge = await createChallenge(viewer, payload.username, payload.presetId);
    return NextResponse.json({ challenge });
  } catch (error) {
    return handleRouteError(error);
  }
}
