import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ status: "ok", message: "RAG test route works" })
}

export async function POST() {
  return NextResponse.json({ status: "ok", message: "RAG POST test route works" })
}
