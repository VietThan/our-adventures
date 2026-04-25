import { NextResponse } from "next/server";

import { listActivities } from "@/db/queries";
import { parseCategory, parseScope, parseSearch } from "@/lib/dashboard-filters";
import { getCurrentAppUser } from "@/lib/current-user";

export async function GET(request: Request) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const result = await listActivities({
    currentUserId: currentUser.id,
    category: parseCategory(searchParams.get("category") ?? undefined),
    scope: parseScope(searchParams.get("scope") ?? undefined),
    search: parseSearch(searchParams.get("q") ?? undefined),
  });

  return NextResponse.json(result);
}
