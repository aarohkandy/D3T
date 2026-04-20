import { NextResponse } from "next/server";

import { requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { acceptChallenge } from "@/lib/data/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ challengeId: string }> },
) {
  try {
    const viewer = await requireApiViewer();
    const { challengeId } = await params;
    const result = await acceptChallenge(viewer, challengeId);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
