import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api";
import { isLocalAuthEnabled } from "@/lib/config";
import {
  createLocalViewer,
  getLocalViewerByUsername,
  LOCAL_VIEWER_COOKIE,
  LOCAL_VIEWER_MAX_AGE,
  serializeLocalViewer,
} from "@/lib/dev/mock-session";

const localAuthSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("sign-in"),
    username: z.string().trim().min(2).max(18),
  }),
  z.object({
    mode: z.literal("sign-up"),
    username: z.string().trim().min(2).max(18),
    displayName: z.string().trim().max(32).optional().default(""),
    email: z.string().trim().max(120).optional().default(""),
  }),
]);

export async function POST(request: Request) {
  try {
    if (!isLocalAuthEnabled()) {
      return NextResponse.json({ error: "Local auth is disabled." }, { status: 404 });
    }

    const payload = localAuthSchema.parse(await request.json());

    const viewer = payload.mode === "sign-in"
      ? getLocalViewerByUsername(payload.username)
      : (() => {
        const existing = getLocalViewerByUsername(payload.username);
        if (existing) {
          return null;
        }

        return createLocalViewer({
          username: payload.username,
          displayName: payload.displayName,
          email: payload.email,
        });
      })();

    if (!viewer) {
      return NextResponse.json(
        {
          error: payload.mode === "sign-in"
            ? "No local account matches that username."
            : "That username is already taken.",
        },
        { status: payload.mode === "sign-in" ? 404 : 409 },
      );
    }

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
  if (!isLocalAuthEnabled()) {
    return NextResponse.json({ error: "Local auth is disabled." }, { status: 404 });
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
