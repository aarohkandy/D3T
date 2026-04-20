import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Liveblocks has been removed from the production path. Supabase Realtime now drives multiplayer sync." },
    { status: 410 },
  );
}
