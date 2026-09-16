import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { pin } = await req.json();
  const correctPin = process.env.APP_PIN || "1977";
  if (pin === correctPin) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
