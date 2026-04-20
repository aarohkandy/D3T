import { NextResponse } from "next/server";

import { getViewer, requireApiViewer } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/api";
import { getDashboardData } from "@/lib/data/store";

export async function GET() {
  try {
    const viewer = await getViewer();

    if (!viewer) {
      return NextResponse.json({ viewer: null, hub: null });
    }

    const hub = await getDashboardData(await requireApiViewer());

    return NextResponse.json({
      viewer,
      hub,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
