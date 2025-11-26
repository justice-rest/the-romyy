import { createClient } from "@/lib/supabase/server"

// GET - Validate an invite code and return chat/owner info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing invite code" }), {
        status: 400,
      })
    }

    const supabase = await createClient()
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Get invite with chat and owner info
    const { data: invite, error } = await supabase
      .from("chat_invites")
      .select(`
        id,
        chat_id,
        invite_code,
        expires_at,
        max_uses,
        use_count,
        is_active,
        chats:chat_id (
          id,
          title,
          user_id,
          is_collaborative,
          max_participants,
          users:user_id (
            id,
            display_name,
            profile_image
          )
        )
      `)
      .eq("invite_code", code)
      .eq("is_active", true)
      .single()

    if (error || !invite) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invite code", valid: false }),
        { status: 200 } // Return 200 with valid: false for cleaner handling
      )
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invite has expired", valid: false }),
        { status: 200 }
      )
    }

    // Check if max uses reached
    if (invite.max_uses && (invite.use_count || 0) >= invite.max_uses) {
      return new Response(
        JSON.stringify({ error: "Invite has reached maximum uses", valid: false }),
        { status: 200 }
      )
    }

    // Get current participant count
    const { count } = await supabase
      .from("chat_collaborators")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", invite.chat_id)
      .eq("status", "accepted")

    const chat = invite.chats as {
      id: string
      title: string
      user_id: string
      is_collaborative: boolean
      max_participants: number
      users: { id: string; display_name: string; profile_image: string }
    }

    // Check if chat is full
    if (count && count >= (chat.max_participants || 3)) {
      return new Response(
        JSON.stringify({ error: "Chat is at maximum capacity", valid: false }),
        { status: 200 }
      )
    }

    return new Response(
      JSON.stringify({
        valid: true,
        chatId: chat.id,
        chatTitle: chat.title || "Collaborative Chat",
        owner: {
          id: chat.users.id,
          displayName: chat.users.display_name || "Unknown",
          profileImage: chat.users.profile_image || null,
        },
        participantCount: count || 1,
        maxParticipants: chat.max_participants || 3,
      }),
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error("Error in validate-invite GET:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
