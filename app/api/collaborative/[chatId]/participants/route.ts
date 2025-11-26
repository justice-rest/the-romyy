import { validateUserIdentity } from "@/lib/server/api"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

// GET - List participants in a collaborative chat
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

    // Verify user is a collaborator or owner
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    const isOwner = chat?.user_id === userId

    const { data: collaborator } = await supabase
      .from("chat_collaborators")
      .select("id")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .eq("status", "accepted")
      .single()

    if (!isOwner && !collaborator) {
      return new Response(
        JSON.stringify({ error: "Not authorized to view participants" }),
        { status: 403 }
      )
    }

    // Get all participants with user info
    const { data: collaborators, error } = await supabase
      .from("chat_collaborators")
      .select(`
        id,
        user_id,
        role,
        status,
        color_index,
        joined_at,
        users:user_id (
          id,
          display_name,
          profile_image,
          email
        )
      `)
      .eq("chat_id", chatId)
      .eq("status", "accepted")
      .order("joined_at", { ascending: true })

    if (error) {
      console.error("Error fetching participants:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch participants" }),
        { status: 500 }
      )
    }

    // Transform the data to flatten user info
    const participants = collaborators?.map((c) => ({
      id: c.id,
      userId: c.user_id,
      role: c.role,
      colorIndex: c.color_index,
      joinedAt: c.joined_at,
      displayName: (c.users as { display_name?: string })?.display_name || "Unknown",
      profileImage: (c.users as { profile_image?: string })?.profile_image || null,
      email: (c.users as { email?: string })?.email || null,
    }))

    return new Response(
      JSON.stringify({
        participants,
        isOwner,
        ownerId: chat?.user_id,
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in participants GET:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// DELETE - Remove a participant (owner only) or leave (self)
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { chatId } = await context.params
    const { userId, isAuthenticated, targetUserId } = await request.json()

    if (!userId || !targetUserId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or targetUserId" }),
        { status: 400 }
      )
    }

    const supabase = await validateUserIdentity(userId, isAuthenticated)
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Get chat details
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

    const isOwner = chat.user_id === userId
    const isSelf = userId === targetUserId

    // Owner can't remove themselves (must transfer ownership first or delete chat)
    if (isOwner && isSelf) {
      return new Response(
        JSON.stringify({ error: "Owner cannot leave. Transfer ownership or delete the chat." }),
        { status: 400 }
      )
    }

    // Non-owner can only remove themselves
    if (!isOwner && !isSelf) {
      return new Response(
        JSON.stringify({ error: "Only the owner can remove other participants" }),
        { status: 403 }
      )
    }

    // Update collaborator status to removed
    const { error } = await supabase
      .from("chat_collaborators")
      .update({ status: "removed" })
      .eq("chat_id", chatId)
      .eq("user_id", targetUserId)
      .neq("role", "owner") // Can't remove owner via this method

    if (error) {
      console.error("Error removing participant:", error)
      return new Response(
        JSON.stringify({ error: "Failed to remove participant" }),
        { status: 500 }
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in participants DELETE:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// PUT - Transfer ownership (owner only)
// Uses atomic database function to prevent partial updates
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { chatId } = await context.params
    const { userId, isAuthenticated, newOwnerId } = await request.json()

    if (!userId || !newOwnerId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or newOwnerId" }),
        { status: 400 }
      )
    }

    const supabase = await validateUserIdentity(userId, isAuthenticated)
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Use atomic function for ownership transfer
    const { data: result, error: rpcError } = await (supabase.rpc as CallableFunction)(
      "transfer_chat_ownership",
      {
        p_chat_id: chatId,
        p_current_owner_id: userId,
        p_new_owner_id: newOwnerId,
      }
    )

    if (rpcError) {
      // If function doesn't exist, fall back to non-atomic flow
      if (rpcError.code === "42883") {
        console.warn("[Transfer] Atomic function not available, using fallback flow")
        return await fallbackTransfer(supabase, chatId, userId, newOwnerId)
      }
      console.error("Error in transfer RPC:", rpcError)
      return new Response(
        JSON.stringify({ error: "Failed to transfer ownership" }),
        { status: 500 }
      )
    }

    const transferResult = result as { success: boolean; error?: string }

    if (!transferResult.success) {
      return new Response(
        JSON.stringify({ error: transferResult.error || "Failed to transfer ownership" }),
        { status: 400 }
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in participants PUT:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// Fallback for when atomic function is not available
async function fallbackTransfer(
  supabase: Awaited<ReturnType<typeof validateUserIdentity>>,
  chatId: string,
  userId: string,
  newOwnerId: string
) {
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: "Database not available" }),
      { status: 503 }
    )
  }

  // Verify current user is owner
  const { data: chat } = await supabase
    .from("chats")
    .select("user_id")
    .eq("id", chatId)
    .single()

  if (!chat || chat.user_id !== userId) {
    return new Response(
      JSON.stringify({ error: "Only the owner can transfer ownership" }),
      { status: 403 }
    )
  }

  // Verify new owner is a collaborator
  const { data: newOwnerCollab } = await supabase
    .from("chat_collaborators")
    .select("id, color_index")
    .eq("chat_id", chatId)
    .eq("user_id", newOwnerId)
    .eq("status", "accepted")
    .single()

  if (!newOwnerCollab) {
    return new Response(
      JSON.stringify({ error: "New owner must be an existing participant" }),
      { status: 400 }
    )
  }

  // Get current owner's collaborator record
  const { data: currentOwnerCollab } = await supabase
    .from("chat_collaborators")
    .select("id, color_index")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single()

  // Update chat owner
  const { error: chatError } = await supabase
    .from("chats")
    .update({ user_id: newOwnerId })
    .eq("id", chatId)

  if (chatError) {
    console.error("Error updating chat owner:", chatError)
    return new Response(
      JSON.stringify({ error: "Failed to transfer ownership" }),
      { status: 500 }
    )
  }

  // Update collaborator roles
  await supabase
    .from("chat_collaborators")
    .update({ role: "owner", color_index: 0 })
    .eq("id", newOwnerCollab.id)

  if (currentOwnerCollab) {
    await supabase
      .from("chat_collaborators")
      .update({ role: "participant", color_index: newOwnerCollab.color_index || 1 })
      .eq("id", currentOwnerCollab.id)
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
