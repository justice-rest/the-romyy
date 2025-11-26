import { validateUserIdentity } from "@/lib/server/api"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

// GET - Check lock status
export async function GET(request: Request, context: RouteContext) {
  try {
    const { chatId } = await context.params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const isAuthenticated = searchParams.get("isAuthenticated") === "true"

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

    // Use the can_user_prompt function
    const { data, error } = await supabase.rpc("can_user_prompt", {
      p_chat_id: chatId,
      p_user_id: userId,
    })

    if (error) {
      console.error("Error checking lock status:", error)
      return new Response(
        JSON.stringify({ error: "Failed to check lock status" }),
        { status: 500 }
      )
    }

    // Parse the JSONB result
    const result = data as { can_prompt: boolean; reason?: string; locked_by?: string; locked_by_name?: string } | null

    // Get additional lock info if locked
    let lockInfo = null
    if (result && !result.can_prompt && result.reason === "locked") {
      const { data: lockData } = await supabase
        .from("chat_locks")
        .select(`
          locked_by,
          locked_at,
          expires_at,
          users:locked_by (
            display_name,
            profile_image
          )
        `)
        .eq("chat_id", chatId)
        .single()

      if (lockData) {
        lockInfo = {
          lockedBy: lockData.locked_by,
          lockedByName: (lockData.users as { display_name?: string })?.display_name || "Someone",
          lockedByImage: (lockData.users as { profile_image?: string })?.profile_image || null,
          lockedAt: lockData.locked_at,
          expiresAt: lockData.expires_at,
        }
      }
    }

    return new Response(
      JSON.stringify({
        canPrompt: result?.can_prompt ?? true,
        reason: result?.reason || null,
        lock: lockInfo,
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in lock GET:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// POST - Acquire lock
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

    // Verify user is a collaborator
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id, is_collaborative")
      .eq("id", chatId)
      .single()

    const isOwner = chat?.user_id === userId

    if (!isOwner) {
      const { data: collaborator } = await supabase
        .from("chat_collaborators")
        .select("id")
        .eq("chat_id", chatId)
        .eq("user_id", userId)
        .eq("status", "accepted")
        .single()

      if (!collaborator) {
        return new Response(
          JSON.stringify({ error: "Not authorized to prompt in this chat" }),
          { status: 403 }
        )
      }
    }

    // Try to acquire lock
    const { data: lockAcquired, error } = await supabase.rpc("acquire_chat_lock", {
      p_chat_id: chatId,
      p_user_id: userId,
    })

    if (error) {
      console.error("Error acquiring lock:", error)
      return new Response(
        JSON.stringify({ error: "Failed to acquire lock" }),
        { status: 500 }
      )
    }

    if (!lockAcquired) {
      // Get who has the lock
      const { data: lockData } = await supabase
        .from("chat_locks")
        .select(`
          locked_by,
          users:locked_by (
            display_name,
            profile_image
          )
        `)
        .eq("chat_id", chatId)
        .single()

      return new Response(
        JSON.stringify({
          acquired: false,
          reason: "locked",
          lockedBy: lockData?.locked_by,
          lockedByName: (lockData?.users as { display_name?: string })?.display_name || "Someone",
          lockedByImage: (lockData?.users as { profile_image?: string })?.profile_image || null,
        }),
        { status: 200 }
      )
    }

    return new Response(
      JSON.stringify({
        acquired: true,
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in lock POST:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// DELETE - Release lock
export async function DELETE(request: Request, context: RouteContext) {
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

    // Release lock
    const { error } = await supabase.rpc("release_chat_lock", {
      p_chat_id: chatId,
      p_user_id: userId,
    })

    if (error) {
      console.error("Error releasing lock:", error)
      return new Response(
        JSON.stringify({ error: "Failed to release lock" }),
        { status: 500 }
      )
    }

    return new Response(JSON.stringify({ released: true }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in lock DELETE:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
