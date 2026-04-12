import { NextResponse } from "next/server";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  const { id } = await context.params;

  return NextResponse.json(
    {
      message: "Mark activity complete placeholder",
      id,
    },
    { status: 501 },
  );
}

export async function DELETE(_: Request, context: Context) {
  const { id } = await context.params;

  return NextResponse.json(
    {
      message: "Unmark activity placeholder",
      id,
    },
    { status: 501 },
  );
}
