import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/data/errors";

export function handleRouteError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: error.issues[0]?.message ?? "Invalid request payload.",
      },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}
