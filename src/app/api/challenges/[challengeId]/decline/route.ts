import { NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { declineChallenge } from "@/lib/data/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ challengeId: string }> },
) {
  try {
    const viewer = await requireApiViewer();
    const { challengeId } = await params;
    const challenge = await declineChallenge(viewer, challengeId);
    return NextResponse.json({ challenge });
  } catch (error) {
    return handleRouteError(error);
  }
}
