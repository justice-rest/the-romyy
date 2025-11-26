import { createClient } from "@/lib/supabase/server"
import { createGuestServerClient } from "@/lib/supabase/server-guest"

// GET - Fetch all collaborative chats where user is a participant
// Uses service role to bypass RLS on chats table
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const isAuthenticated = searchParams.get("isAuthenticated") === "true"

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
      })
    }

    if (!isAuthenticated) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401 }
      )
    }

    // Verify authentication
    const supabaseAuth = await createClient()
    if (supabaseAuth) {
      const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
      if (authError || !authData?.user?.id || authData.user.id !== userId) {
        return new Response(
          JSON.stringify({ error: "User authentication failed" }),
          { status: 401 }
        )
      }
    }

    // Use service role to fetch collaborative chats (bypasses RLS)
    const supabase = await createGuestServerClient()
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Database not available" }),
        { status: 503 }
      )
    }

    // Get all chats where user is an accepted collaborator
    const { data: collaboratorData, error } = await supabase
      .from("chat_collaborators")
      .select(`
        chat_id,
        role,
        chats (
          id,
          title,
          created_at,
          updated_at,
          model,
          user_id,
          public,
          project_id,
          pinned,
          pinned_at,
          is_collaborative,
          max_participants
        )
      `)
      .eq("user_id", userId)
      .eq("status", "accepted")

    if (error) {
      console.error("Error fetching collaborative chats:", error)
      return new Response(
        JSON.stringify({ error: "Failed to fetch chats" }),
        { status: 500 }
      )
    }

    // Extract and flatten chats
    const chats = collaboratorData
      ?.map((item) => item.chats)
      .filter((chat): chat is NonNullable<typeof chat> => chat !== null)
      || []

    return new Response(JSON.stringify({ chats }), { status: 200 })
  } catch (err: unknown) {
    console.error("Error in my-chats GET:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500 }
    )
  }
}
