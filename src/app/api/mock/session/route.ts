import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api";
import { isDevDemoEnabled } from "@/lib/config";
import {
  getMockViewer,
  LOCAL_VIEWER_COOKIE,
  LOCAL_VIEWER_MAX_AGE,
  serializeLocalViewer,
} from "@/lib/dev/mock-session";

const mockSessionSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!isDevDemoEnabled()) {
      return NextResponse.json({ error: "Mock sessions are disabled." }, { status: 404 });
    }

    const payload = mockSessionSchema.parse(await request.json());
    const viewer = getMockViewer(payload.userId);
    const response = NextResponse.json({ viewer });

    response.cookies.set(LOCAL_VIEWER_COOKIE, serializeLocalViewer(viewer), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: LOCAL_VIEWER_MAX_AGE,
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  if (!isDevDemoEnabled()) {
    return NextResponse.json({ error: "Mock sessions are disabled." }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_VIEWER_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
