import { createClient } from "@/lib/supabase/server"
import { normalizeModelId } from "@/lib/models"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { chatId, model } = await request.json()

    if (!chatId || !model) {
      return new Response(
        JSON.stringify({ error: "Missing chatId or model" }),
        { status: 400 }
      )
    }

    // If Supabase is not available, we still return success
    if (!supabase) {
      console.log("Supabase not enabled, skipping DB update")
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    // Normalize model ID for backwards compatibility (e.g., grok-4-fast → grok-4.1-fast)
    const normalizedModel = normalizeModelId(model)

    const { error } = await supabase
      .from("chats")
      .update({ model: normalizedModel })
      .eq("id", chatId)

    if (error) {
      console.error("Error updating chat model:", error)
      return new Response(
        JSON.stringify({
          error: "Failed to update chat model",
          details: error.message,
        }),
        { status: 500 }
      )
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    })
  } catch (err: unknown) {
    console.error("Error in update-chat-model endpoint:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
