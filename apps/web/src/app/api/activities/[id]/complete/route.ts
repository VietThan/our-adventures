import { NextResponse } from "next/server";

import { markActivityComplete, removeActivityCompletion } from "@/db/queries";
import { getCurrentAppUser } from "@/lib/current-user";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const activityId = Number.parseInt(id, 10);

  if (!Number.isInteger(activityId) || activityId <= 0) {
    return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
  }

  const activity = await markActivityComplete(activityId, currentUser.id);
  if (!activity?.activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(activity);
}

export async function DELETE(_: Request, context: Context) {
  const currentUser = await getCurrentAppUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const activityId = Number.parseInt(id, 10);

  if (!Number.isInteger(activityId) || activityId <= 0) {
    return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
  }

  const activity = await removeActivityCompletion(activityId, currentUser.id);
  if (!activity?.activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(activity);
}
