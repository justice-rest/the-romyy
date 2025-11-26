import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { CollaborativeProvider } from "@/lib/collaborative-store/provider"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

interface PageProps {
  params: Promise<{ chatId: string }>
}

export default async function Page({ params }: PageProps) {
  const { chatId } = await params
  let isCollaborative = false

  if (isSupabaseEnabled) {
    const supabase = await createClient()
    if (supabase) {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        redirect("/")
      }

      // Check if chat is collaborative (gracefully handle if column doesn't exist)
      try {
        const { data: chatData, error: chatError } = await supabase
          .from("chats")
          .select("is_collaborative")
          .eq("id", chatId)
          .single()

        // Only set collaborative if column exists and is true
        // Error code 42703 = column does not exist
        if (!chatError && chatData?.is_collaborative === true) {
          isCollaborative = true
        }
      } catch {
        // Collaborative feature not available yet
        isCollaborative = false
      }
    }
  }

  return (
    <CollaborativeProvider chatId={chatId} isCollaborative={isCollaborative}>
      <MessagesProvider isCollaborative={isCollaborative}>
        <LayoutApp>
          <ChatContainer />
        </LayoutApp>
      </MessagesProvider>
    </CollaborativeProvider>
  )
}
