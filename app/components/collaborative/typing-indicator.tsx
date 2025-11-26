"use client"

import { useCollaborative } from "@/lib/collaborative-store"
import { cn } from "@/lib/utils"

interface TypingIndicatorProps {
  className?: string
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
  const { typingUsers, participants, isCollaborative } = useCollaborative()

  if (!isCollaborative || typingUsers.length === 0) return null

  // Get display names for typing users
  const typingNames = typingUsers
    .map((userId) => {
      const participant = participants.find((p) => p.userId === userId)
      return participant?.displayName || "Someone"
    })
    .slice(0, 2) // Max 2 names

  const displayText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length === 2
        ? `${typingNames[0]} and ${typingNames[1]} are typing...`
        : `${typingNames[0]} and others are typing...`

  return (
    <div className={cn("flex items-center gap-2 px-6 py-1", className)}>
      <div className="flex gap-1">
        <span
          className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{displayText}</span>
    </div>
  )
}
