"use client"

import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function Home() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      const supabase = createClient()

      if (!supabase) {
        setIsChecking(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Only check for authenticated, non-anonymous users
      if (user && !user.is_anonymous) {
        const { data: userData } = await supabase
          .from("users")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single()

        if (userData && !userData.onboarding_completed) {
          router.push("/onboarding")
          return
        }
      }

      setIsChecking(false)
    }

    checkOnboardingStatus()
  }, [router])

  if (isChecking) {
    return <div className="bg-background h-dvh" />
  }

  return (
    <MessagesProvider>
      <LayoutApp>
        <ChatContainer />
      </LayoutApp>
    </MessagesProvider>
  )
}
