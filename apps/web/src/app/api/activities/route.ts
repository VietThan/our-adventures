import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "List activities placeholder",
  });
}

export async function POST() {
  return NextResponse.json(
    {
      message: "Create activity placeholder",
    },
    { status: 501 },
  );
}
