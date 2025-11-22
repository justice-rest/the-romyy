"use client"

import { MultiChat } from "@/app/components/multi-chat/multi-chat"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { Chat } from "./chat"

interface ChatContainerProps {
  showWelcome?: boolean
  firstName?: string | null
  onWelcomeDismiss?: () => void
}

export function ChatContainer({
  showWelcome,
  firstName,
  onWelcomeDismiss,
}: ChatContainerProps) {
  const { preferences } = useUserPreferences()
  const multiModelEnabled = preferences.multiModelEnabled

  if (multiModelEnabled) {
    return <MultiChat />
  }

  return (
    <Chat
      showWelcome={showWelcome}
      firstName={firstName}
      onWelcomeDismiss={onWelcomeDismiss}
    />
  )
}
