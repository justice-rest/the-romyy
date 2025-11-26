import { validateUserIdentity } from "@/lib/server/api"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

// POST - Leave a collaborative chat
export async function POST(request: Request, context: RouteContext) {
  try {
    const { chatId } = await context.params
    const { userId, isAuthenticated } = await request.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    const supabase = await validateUserIdentity(userId, isAuthenticated)
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Check if user is owner
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    if (!chat) {
      return new Response(
        JSON.stringify({ error: "Chat not found" }),
        { status: 404 }
      )
    }

    if (chat.user_id === userId) {
      // Owner cannot leave - must transfer ownership first
      // Get count of other participants
      const { count } = await supabase
        .from("chat_collaborators")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chatId)
        .eq("status", "accepted")
        .neq("user_id", userId)

      if (count && count > 0) {
        return new Response(
          JSON.stringify({
            error: "Owner cannot leave while other participants exist. Transfer ownership or remove all participants first.",
          }),
          { status: 400 }
        )
      }

      // If owner is the only one, convert to non-collaborative
      await supabase
        .from("chats")
        .update({ is_collaborative: false })
        .eq("id", chatId)

      // Remove collaborator entry
      await supabase
        .from("chat_collaborators")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", userId)

      // Deactivate all invites
      await supabase
        .from("chat_invites")
        .update({ is_active: false })
        .eq("chat_id", chatId)

      return new Response(
        JSON.stringify({
          success: true,
          message: "Converted to solo chat",
        }),
        { status: 200 }
      )
    }

    // Non-owner leaving
    const { error } = await supabase
      .from("chat_collaborators")
      .update({ status: "removed" })
      .eq("chat_id", chatId)
      .eq("user_id", userId)

    if (error) {
      console.error("Error leaving chat:", error)
      return new Response(
        JSON.stringify({ error: "Failed to leave chat" }),
        { status: 500 }
      )
    }

    // Release any lock the user might have
    await supabase.rpc("release_chat_lock", {
      p_chat_id: chatId,
      p_user_id: userId,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: "Left the chat",
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in leave POST:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
