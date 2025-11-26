import { MessageUserCollaborative } from "@/app/components/collaborative"
import type { Participant } from "@/lib/collaborative-store/types"
import { Message as MessageType } from "@ai-sdk/react"
import React, { useState } from "react"
import { MessageAssistant } from "./message-assistant"
import { MessageUser } from "./message-user"

type MessageProps = {
  variant: MessageType["role"]
  children: string
  id: string
  attachments?: MessageType["experimental_attachments"]
  isLast?: boolean
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => Promise<void> | void
  onReload: () => void
  hasScrollAnchor?: boolean
  parts?: MessageType["parts"]
  status?: "streaming" | "ready" | "submitted" | "error"
  className?: string
  onQuote?: (text: string, messageId: string) => void
  messageGroupId?: string | null
  isUserAuthenticated?: boolean
  // Collaborative props
  isCollaborative?: boolean
  participants?: Participant[]
  currentUserId?: string
  senderUserId?: string
  senderDisplayName?: string
  senderProfileImage?: string | null
}

export function Message({
  variant,
  children,
  id,
  attachments,
  isLast,
  onEdit,
  onReload,
  hasScrollAnchor,
  parts,
  status,
  className,
  onQuote,
  messageGroupId,
  isUserAuthenticated,
  // Collaborative props
  isCollaborative,
  participants,
  currentUserId,
  senderUserId,
  senderDisplayName,
  senderProfileImage,
}: MessageProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 500)
  }

  if (variant === "user") {
    // Use collaborative message component when in collaborative mode
    if (isCollaborative && senderUserId) {
      const participant = participants?.find((p) => p.userId === senderUserId)
      const isCurrentUser = senderUserId === currentUserId
      const displayName = senderDisplayName || participant?.displayName || "User"
      const profileImage = senderProfileImage ?? participant?.profileImage ?? null
      const colorIndex = participant?.colorIndex ?? 1

      return (
        <MessageUserCollaborative
          copied={copied}
          copyToClipboard={copyToClipboard}
          onEdit={onEdit}
          id={id}
          hasScrollAnchor={hasScrollAnchor}
          attachments={attachments}
          className={className}
          messageGroupId={messageGroupId}
          isUserAuthenticated={isUserAuthenticated}
          isCurrentUser={isCurrentUser}
          senderDisplayName={displayName}
          senderProfileImage={profileImage}
          senderColorIndex={colorIndex}
        >
          {children}
        </MessageUserCollaborative>
      )
    }

    return (
      <MessageUser
        copied={copied}
        copyToClipboard={copyToClipboard}
        onReload={onReload}
        onEdit={onEdit}
        id={id}
        hasScrollAnchor={hasScrollAnchor}
        attachments={attachments}
        className={className}
        messageGroupId={messageGroupId}
        isUserAuthenticated={isUserAuthenticated}
      >
        {children}
      </MessageUser>
    )
  }

  if (variant === "assistant") {
    return (
      <MessageAssistant
        copied={copied}
        copyToClipboard={copyToClipboard}
        onReload={onReload}
        isLast={isLast}
        hasScrollAnchor={hasScrollAnchor}
        parts={parts}
        status={status}
        className={className}
        messageId={id}
        onQuote={onQuote}
      >
        {children}
      </MessageAssistant>
    )
  }

  return null
}
