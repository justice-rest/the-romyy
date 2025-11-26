import { validateUserIdentity } from "@/lib/server/api"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

// POST - Join a collaborative chat via invite code
// Uses atomic database function to prevent race conditions
export async function POST(request: Request, context: RouteContext) {
  try {
    const { chatId } = await context.params
    const { userId, isAuthenticated, inviteCode } = await request.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    if (!inviteCode) {
      return new Response(JSON.stringify({ error: "Missing invite code" }), {
        status: 400,
      })
    }

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Authentication required to join collaborative chats" }),
        { status: 401 }
      )
    }

    const supabase = await validateUserIdentity(userId, isAuthenticated)
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Use atomic function to handle join with proper locking
    // This prevents race conditions where multiple users join simultaneously
    const { data: result, error: rpcError } = await (supabase.rpc as CallableFunction)(
      "join_collaborative_chat",
      {
        p_chat_id: chatId,
        p_user_id: userId,
        p_invite_code: inviteCode,
      }
    )

    if (rpcError) {
      // If function doesn't exist, fall back to non-atomic flow
      if (rpcError.code === "42883") {
        console.warn("[Join] Atomic function not available, using fallback flow")
        return await fallbackJoin(supabase, chatId, userId, inviteCode)
      }
      console.error("Error in join RPC:", rpcError)
      return new Response(
        JSON.stringify({ error: "Failed to join chat" }),
        { status: 500 }
      )
    }

    const joinResult = result as { success: boolean; error?: string; chat_id?: string; chat_title?: string }

    if (!joinResult.success) {
      return new Response(
        JSON.stringify({ error: joinResult.error || "Failed to join chat" }),
        { status: 400 }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        chat: {
          id: joinResult.chat_id,
          title: joinResult.chat_title,
        },
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in join POST:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// Fallback for when atomic function is not available (migration not run)
async function fallbackJoin(
  supabase: Awaited<ReturnType<typeof validateUserIdentity>>,
  chatId: string,
  userId: string,
  inviteCode: string
) {
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: "Database not available" }),
      { status: 503 }
    )
  }

  // Validate invite
  const { data: invite, error: inviteError } = await supabase
    .from("chat_invites")
    .select("*")
    .eq("chat_id", chatId)
    .eq("invite_code", inviteCode)
    .eq("is_active", true)
    .single()

  if (inviteError || !invite) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired invite code" }),
      { status: 400 }
    )
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: "Invite has expired" }),
      { status: 400 }
    )
  }

  if (invite.max_uses && (invite.use_count || 0) >= invite.max_uses) {
    return new Response(
      JSON.stringify({ error: "Invite has reached maximum uses" }),
      { status: 400 }
    )
  }

  // Atomically claim a slot by incrementing use_count with optimistic locking
  // This prevents race conditions where multiple users read the same use_count
  if (invite.max_uses) {
    const currentUseCount = invite.use_count || 0
    const { data: claimedInvite, error: claimError } = await supabase
      .from("chat_invites")
      .update({ use_count: currentUseCount + 1 })
      .eq("id", invite.id)
      .eq("use_count", currentUseCount) // Optimistic lock - only update if unchanged
      .select("id")
      .single()

    if (claimError || !claimedInvite) {
      // Another user claimed a slot - re-check if still valid
      const { data: freshInvite } = await supabase
        .from("chat_invites")
        .select("use_count, max_uses")
        .eq("id", invite.id)
        .single()

      if (!freshInvite || (freshInvite.use_count || 0) >= (freshInvite.max_uses || 0)) {
        return new Response(
          JSON.stringify({ error: "Invite has reached maximum uses" }),
          { status: 400 }
        )
      }

      // Retry once with fresh data
      const freshUseCount = freshInvite.use_count || 0
      const { data: retryInvite } = await supabase
        .from("chat_invites")
        .update({ use_count: freshUseCount + 1 })
        .eq("id", invite.id)
        .eq("use_count", freshUseCount)
        .select("id")
        .single()

      if (!retryInvite) {
        return new Response(
          JSON.stringify({ error: "Failed to join - please try again" }),
          { status: 409 }
        )
      }
    }
  }

  // Check if already a member
  const { data: existingCollaborator } = await supabase
    .from("chat_collaborators")
    .select("id, status")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  if (existingCollaborator?.status === "accepted") {
    return new Response(
      JSON.stringify({ error: "You are already a member of this chat" }),
      { status: 400 }
    )
  }

  // Get chat
  const { data: chat } = await supabase
    .from("chats")
    .select("id, title, max_participants")
    .eq("id", chatId)
    .single()

  if (!chat) {
    return new Response(
      JSON.stringify({ error: "Chat not found" }),
      { status: 404 }
    )
  }

  // Check capacity
  const { count } = await supabase
    .from("chat_collaborators")
    .select("*", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("status", "accepted")

  if ((count || 0) >= (chat.max_participants || 3)) {
    return new Response(
      JSON.stringify({ error: "Chat is at maximum capacity" }),
      { status: 400 }
    )
  }

  // Add or re-join
  if (existingCollaborator) {
    await supabase
      .from("chat_collaborators")
      .update({ status: "accepted", joined_at: new Date().toISOString() })
      .eq("id", existingCollaborator.id)
  } else {
    // Find the next available color index (1 or 2, since 0 is for owner)
    const { data: existingColors } = await supabase
      .from("chat_collaborators")
      .select("color_index")
      .eq("chat_id", chatId)
      .eq("status", "accepted")
      .order("color_index", { ascending: true })

    // Find first available color (1 or 2)
    const usedColors = new Set(existingColors?.map((c) => c.color_index) || [])
    let colorIndex = 1
    if (usedColors.has(1)) {
      colorIndex = 2
    }

    await supabase.from("chat_collaborators").insert({
      chat_id: chatId,
      user_id: userId,
      role: "participant",
      status: "accepted",
      color_index: colorIndex,
      invited_by: invite.created_by,
    })
  }

  // Increment use count for invites without max_uses (unlimited)
  // Invites with max_uses are already incremented above with optimistic locking
  if (!invite.max_uses) {
    await supabase
      .from("chat_invites")
      .update({ use_count: (invite.use_count || 0) + 1 })
      .eq("id", invite.id)
  }

  return new Response(
    JSON.stringify({
      success: true,
      chat: { id: chat.id, title: chat.title },
    }),
    { status: 200 }
  )
}
