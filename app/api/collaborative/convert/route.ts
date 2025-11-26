import { validateUserIdentity } from "@/lib/server/api"
import { nanoid } from "nanoid"

type ConvertToCollaborativeInput = {
  userId: string
  chatId: string
  isAuthenticated: boolean
  maxParticipants?: number
}

export async function POST(request: Request) {
  try {
    const {
      userId,
      chatId,
      isAuthenticated,
      maxParticipants = 3,
    }: ConvertToCollaborativeInput = await request.json()

    if (!userId || !chatId) {
      return new Response(JSON.stringify({ error: "Missing userId or chatId" }), {
        status: 400,
      })
    }

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Authentication required for collaborative chats" }),
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

    // Verify chat exists and belongs to user
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single()

    if (chatError || !chat) {
      return new Response(
        JSON.stringify({ error: "Chat not found or not owned by user" }),
        { status: 404 }
      )
    }

    if (chat.is_collaborative) {
      return new Response(
        JSON.stringify({ error: "Chat is already collaborative" }),
        { status: 400 }
      )
    }

    // Update chat to be collaborative
    const { error: updateError } = await supabase
      .from("chats")
      .update({
        is_collaborative: true,
        max_participants: Math.min(maxParticipants, 3),
      })
      .eq("id", chatId)

    if (updateError) {
      console.error("Error converting chat:", updateError)
      return new Response(
        JSON.stringify({ error: "Failed to convert chat" }),
        { status: 500 }
      )
    }

    // Add owner as first collaborator with color_index 0
    const { error: collaboratorError } = await supabase
      .from("chat_collaborators")
      .insert({
        chat_id: chatId,
        user_id: userId,
        role: "owner",
        status: "accepted",
        color_index: 0,
        invited_by: userId,
      })

    if (collaboratorError) {
      console.error("Error adding owner as collaborator:", collaboratorError)
      // Rollback chat conversion
      await supabase
        .from("chats")
        .update({ is_collaborative: false, max_participants: null })
        .eq("id", chatId)
      return new Response(
        JSON.stringify({ error: "Failed to setup collaborator" }),
        { status: 500 }
      )
    }

    // Generate initial invite link
    const inviteCode = nanoid(12)
    const { data: invite, error: inviteError } = await supabase
      .from("chat_invites")
      .insert({
        chat_id: chatId,
        invite_code: inviteCode,
        created_by: userId,
        max_uses: Math.min(maxParticipants, 3) - 1, // Owner already in
      })
      .select("*")
      .single()

    if (inviteError) {
      console.error("Error creating invite:", inviteError)
      // Don't rollback - chat is still usable, just no invite
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite: invite
          ? {
              code: invite.invite_code,
              expiresAt: invite.expires_at,
            }
          : null,
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in collaborative/convert endpoint:", err)
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}
