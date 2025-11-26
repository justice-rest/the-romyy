"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCollaborative, getParticipantColor } from "@/lib/collaborative-store"
import { cn } from "@/lib/utils"
import { Copy, SignOut, UserPlus, Crown, Check, UsersThree } from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "@/components/ui/toast"

export function CollaborativeMenu() {
  const {
    isCollaborative,
    participants,
    onlineUsers,
    isOwner,
    generateInviteLink,
    removeParticipant,
    leaveChat,
  } = useCollaborative()
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  if (!isCollaborative) return null

  const handleGenerateInvite = async () => {
    setIsGenerating(true)
    try {
      const link = await generateInviteLink()
      if (link) {
        setInviteLink(link)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyInvite = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      toast({
        title: "Link copied!",
        description: "Share this link with others to invite them.",
        status: "success",
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleLeave = async () => {
    if (confirm("Are you sure you want to leave this collaborative chat?")) {
      await leaveChat()
      window.location.href = "/"
    }
  }

  const onlineUserIds = onlineUsers.map((u) => u.user_id)
  const spotsLeft = 3 - participants.length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground hover:bg-muted bg-background rounded-full p-1.5 transition-colors"
              >
                <UsersThree className="size-5" weight="duotone" />
                {/* Online indicator dot */}
                <span className="absolute -top-0.5 -right-0.5 flex size-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex size-3 rounded-full bg-green-500" />
                </span>
                <span className="sr-only">Collaborative chat</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Collaborative ({onlineUserIds.length}/{participants.length} online)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-72 p-0" align="end">
        {/* Header */}
        <div className="p-3 border-b">
          <h4 className="font-medium text-sm">Collaborative Chat</h4>
          <p className="text-xs text-muted-foreground">
            {participants.length} participant{participants.length !== 1 ? "s" : ""} · {onlineUserIds.length} online
          </p>
        </div>

        {/* Participants list */}
        <div className="p-2 max-h-48 overflow-y-auto">
          {participants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Avatar className="size-8">
                    <AvatarImage src={p.profileImage || undefined} />
                    <AvatarFallback
                      style={{ backgroundColor: getParticipantColor(p.colorIndex) }}
                      className="text-white text-xs font-medium"
                    >
                      {p.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {onlineUserIds.includes(p.userId) && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm flex items-center gap-1 truncate">
                    {p.displayName}
                    {p.role === "owner" && (
                      <Crown className="size-3 text-yellow-500 flex-shrink-0" weight="fill" />
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {p.role === "owner" ? "Owner" : "Participant"}
                  </span>
                </div>
              </div>
              {isOwner && p.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => removeParticipant(p.userId)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Invite section (owner only, if spots available) */}
        {isOwner && spotsLeft > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium">
                Invite ({spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left)
              </span>
            </div>
            {inviteLink ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 text-xs bg-background border rounded-md px-2 py-1.5 truncate"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2"
                  onClick={handleCopyInvite}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGenerateInvite}
                disabled={isGenerating}
                className="w-full h-8 text-xs"
                size="sm"
              >
                {isGenerating ? "Generating..." : "Generate invite link"}
              </Button>
            )}
          </div>
        )}

        {/* Leave option (non-owners) */}
        {!isOwner && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-8 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleLeave}
            >
              <SignOut className="size-3.5 mr-2" />
              Leave chat
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
