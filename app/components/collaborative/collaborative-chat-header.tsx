"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useCollaborative, getParticipantColor } from "@/lib/collaborative-store"
import { cn } from "@/lib/utils"
import { Copy, SignOut, UserPlus, Users, Crown } from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "@/components/ui/toast"

export function CollaborativeChatHeader() {
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
      toast({
        title: "Link copied!",
        description: "Share this link with others to invite them.",
        status: "success",
      })
    }
  }

  const handleLeave = async () => {
    if (confirm("Are you sure you want to leave this collaborative chat?")) {
      await leaveChat()
      window.location.href = "/"
    }
  }

  const onlineUserIds = onlineUsers.map((u) => u.user_id)

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Participants */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 hover:bg-accent/50 rounded-lg px-2 py-1 transition">
            {/* Stacked avatars */}
            <div className="flex -space-x-2">
              {participants.slice(0, 3).map((p) => (
                <Avatar
                  key={p.userId}
                  className={cn(
                    "size-7 border-2 border-background",
                    onlineUserIds.includes(p.userId) && "ring-2 ring-green-500"
                  )}
                >
                  <AvatarImage src={p.profileImage || undefined} alt={p.displayName} />
                  <AvatarFallback
                    className="text-[10px]"
                    style={{ backgroundColor: getParticipantColor(p.colorIndex) }}
                  >
                    {p.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {onlineUserIds.length}/{participants.length}
            </span>
            <Users className="size-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-3 border-b">
            <h4 className="font-medium text-sm">Participants</h4>
            <p className="text-xs text-muted-foreground">
              {participants.length} participant{participants.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-2">
            {participants.map((p) => (
              <div
                key={p.userId}
                className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage src={p.profileImage || undefined} />
                    <AvatarFallback
                      style={{ backgroundColor: getParticipantColor(p.colorIndex) }}
                      className="text-white text-xs"
                    >
                      {p.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm flex items-center gap-1">
                      {p.displayName}
                      {p.role === "owner" && (
                        <Crown className="size-3 text-yellow-500" weight="fill" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {onlineUserIds.includes(p.userId) ? (
                        <span className="text-green-500">Online</span>
                      ) : (
                        "Offline"
                      )}
                    </span>
                  </div>
                </div>
                {isOwner && p.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => removeParticipant(p.userId)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!isOwner && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleLeave}
              >
                <SignOut className="size-4 mr-2" />
                Leave chat
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Invite button (owner only) */}
      {isOwner && participants.length < 3 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <UserPlus className="size-4 mr-1" />
              Invite
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">Invite collaborators</h4>
                <p className="text-xs text-muted-foreground">
                  Share this link to invite others ({3 - participants.length} spot{3 - participants.length !== 1 ? "s" : ""} left)
                </p>
              </div>

              {inviteLink ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate"
                  />
                  <Button size="sm" onClick={handleCopyInvite}>
                    <Copy className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateInvite}
                  disabled={isGenerating}
                  className="w-full"
                  size="sm"
                >
                  {isGenerating ? "Generating..." : "Generate invite link"}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
