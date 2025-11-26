import { normalizeModelId } from "@/lib/models"
import { validateUserIdentity } from "@/lib/server/api"
import { nanoid } from "nanoid"

type CreateCollaborativeChatInput = {
  userId: string
  title?: string
  model: string
  isAuthenticated: boolean
  maxParticipants?: number
}

export async function POST(request: Request) {
  try {
    const {
      userId,
      title,
      model,
      isAuthenticated,
      maxParticipants = 3,
    }: CreateCollaborativeChatInput = await request.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
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

    // Normalize model ID
    const normalizedModel = normalizeModelId(model)

    // Create the collaborative chat
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        user_id: userId,
        title: title || "Collaborative Chat",
        model: normalizedModel,
        is_collaborative: true,
        max_participants: Math.min(maxParticipants, 3), // Cap at 3
      })
      .select("*")
      .single()

    if (chatError || !chat) {
      console.error("Error creating collaborative chat:", chatError)
      return new Response(
        JSON.stringify({ error: "Failed to create chat" }),
        { status: 500 }
      )
    }

    // Add owner as first collaborator with color_index 0
    const { error: collaboratorError } = await supabase
      .from("chat_collaborators")
      .insert({
        chat_id: chat.id,
        user_id: userId,
        role: "owner",
        status: "accepted",
        color_index: 0,
        invited_by: userId,
      })

    if (collaboratorError) {
      console.error("Error adding owner as collaborator:", collaboratorError)
      // Rollback chat creation
      await supabase.from("chats").delete().eq("id", chat.id)
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
        chat_id: chat.id,
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
        chat,
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
    console.error("Error in collaborative/create endpoint:", err)
    return new Response(
      JSON.stringify({
        error: (err as Error).message || "Internal server error",
      }),
      { status: 500 }
    )
  }
}
