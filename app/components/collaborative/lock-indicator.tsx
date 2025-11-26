"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useCollaborative } from "@/lib/collaborative-store"
import { cn } from "@/lib/utils"
import { Spinner } from "@phosphor-icons/react"

interface LockIndicatorProps {
  className?: string
}

export function LockIndicator({ className }: LockIndicatorProps) {
  const { currentLock, canPrompt, isCollaborative } = useCollaborative()

  // Don't show if not collaborative or user can prompt
  if (!isCollaborative || canPrompt || !currentLock) return null

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg border border-border/50",
        className
      )}
    >
      <Avatar className="size-6">
        <AvatarImage src={currentLock.lockedByImage || undefined} />
        <AvatarFallback className="text-xs">
          {currentLock.lockedByName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground">
        {currentLock.lockedByName} is prompting...
      </span>
      <Spinner className="size-4 animate-spin text-muted-foreground" />
    </div>
  )
}
