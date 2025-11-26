import { validateUserIdentity } from "@/lib/server/api"
import { nanoid } from "nanoid"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

// GET - List active invites for a chat
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

    // Verify user is the owner
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    if (!chat || chat.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Only chat owner can view invites" }),
        { status: 403 }
      )
    }

    // Get active invites
    const { data: invites, error } = await supabase
      .from("chat_invites")
      .select("*")
      .eq("chat_id", chatId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching invites:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch invites" }),
        { status: 500 }
      )
    }

    return new Response(JSON.stringify({ invites }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in invite GET:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// POST - Generate a new invite link
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

    // Verify user is the owner
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id, max_participants")
      .eq("id", chatId)
      .single()

    if (!chat || chat.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Only chat owner can create invites" }),
        { status: 403 }
      )
    }

    // Check current participant count
    const { count } = await supabase
      .from("chat_collaborators")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", chatId)
      .eq("status", "accepted")

    const currentCount = count || 0
    const maxParticipants = chat.max_participants || 3

    if (currentCount >= maxParticipants) {
      return new Response(
        JSON.stringify({ error: "Chat is already at maximum capacity" }),
        { status: 400 }
      )
    }

    // Deactivate existing invites
    await supabase
      .from("chat_invites")
      .update({ is_active: false })
      .eq("chat_id", chatId)
      .eq("is_active", true)

    // Create new invite
    const inviteCode = nanoid(12)
    const { data: invite, error } = await supabase
      .from("chat_invites")
      .insert({
        chat_id: chatId,
        invite_code: inviteCode,
        created_by: userId,
        max_uses: maxParticipants - currentCount,
      })
      .select("*")
      .single()

    if (error || !invite) {
      console.error("Error creating invite:", error)
      return new Response(
        JSON.stringify({ error: "Failed to create invite" }),
        { status: 500 }
      )
    }

    return new Response(
      JSON.stringify({
        invite: {
          code: invite.invite_code,
          expiresAt: invite.expires_at,
          maxUses: invite.max_uses,
          useCount: invite.use_count,
        },
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in invite POST:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}

// DELETE - Revoke an invite
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { chatId } = await context.params
    const { userId, isAuthenticated, inviteId } = await request.json()

    if (!userId || !inviteId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or inviteId" }),
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

    // Verify user is the owner
    const { data: chat } = await supabase
      .from("chats")
      .select("user_id")
      .eq("id", chatId)
      .single()

    if (!chat || chat.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Only chat owner can revoke invites" }),
        { status: 403 }
      )
    }

    // Deactivate the invite
    const { error } = await supabase
      .from("chat_invites")
      .update({ is_active: false })
      .eq("id", inviteId)
      .eq("chat_id", chatId)

    if (error) {
      console.error("Error revoking invite:", error)
      return new Response(
        JSON.stringify({ error: "Failed to revoke invite" }),
        { status: 500 }
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in invite DELETE:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
