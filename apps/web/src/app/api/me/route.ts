import { NextResponse } from "next/server";

import { getCurrentAppUser } from "@/lib/current-user";

export async function GET() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: currentUser });
}
