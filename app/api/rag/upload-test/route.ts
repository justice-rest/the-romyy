import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  console.log("[Upload Test] POST request received")

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    console.log(`[Upload Test] File received: ${file.name}, size: ${file.size}`)

    return NextResponse.json({
      message: "Test upload endpoint working",
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (error) {
    console.error("[Upload Test] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload test failed" },
      { status: 500 }
    )
  }
}
