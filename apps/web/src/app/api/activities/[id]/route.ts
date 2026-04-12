import { NextResponse } from "next/server";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;

  return NextResponse.json({
    message: "Get activity placeholder",
    id,
  });
}

export async function PUT(_: Request, context: Context) {
  const { id } = await context.params;

  return NextResponse.json(
    {
      message: "Update activity placeholder",
      id,
    },
    { status: 501 },
  );
}

export async function DELETE(_: Request, context: Context) {
  const { id } = await context.params;

  return NextResponse.json(
    {
      message: "Delete activity placeholder",
      id,
    },
    { status: 501 },
  );
}
