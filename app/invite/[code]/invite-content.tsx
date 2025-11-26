"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { validateInvite, joinCollaborativeChat } from "@/lib/collaborative-store/api"
import { useUser } from "@/lib/user-store/provider"
import { Users, WarningCircle, ChatCircleDots } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"

interface InviteContentProps {
  code: string
}

interface InviteData {
  valid: boolean
  chatId?: string
  chatTitle?: string
  owner?: {
    id: string
    displayName: string
    profileImage: string | null
  }
  participantCount?: number
  maxParticipants?: number
  error?: string
}

export function InviteContent({ code }: InviteContentProps) {
  const { user } = useUser()
  const router = useRouter()
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = !!user && !user.anonymous

  useEffect(() => {
    async function fetchInvite() {
      try {
        const data = await validateInvite(code)
        setInviteData(data)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchInvite()
  }, [code])

  const handleJoin = async () => {
    if (!inviteData?.chatId || !user?.id) return

    setIsJoining(true)
    setError(null)

    try {
      await joinCollaborativeChat(
        inviteData.chatId,
        code,
        user.id,
        isAuthenticated
      )
      router.push(`/c/${inviteData.chatId}`)
    } catch (err) {
      setError((err as Error).message)
      setIsJoining(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-[400px]">
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Validating invite...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !inviteData?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <WarningCircle className="size-8 text-destructive" />
            </div>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>
              {error || inviteData?.error || "This invite link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-[400px]">
          <CardHeader className="text-center">
            <Avatar className="mx-auto mb-4 size-16">
              <AvatarImage src={inviteData.owner?.profileImage || undefined} />
              <AvatarFallback className="text-lg">
                {inviteData.owner?.displayName?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <CardTitle>{inviteData.owner?.displayName} invited you</CardTitle>
            <CardDescription>
              Join &ldquo;{inviteData.chatTitle}&rdquo; and chat with AI together
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>
                {inviteData.participantCount}/{inviteData.maxParticipants} participants
              </span>
            </div>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href={`/auth/login?redirect=/invite/${code}`}>
                  Sign in to join
                </Link>
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                You need to sign in to join collaborative chats
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <Avatar className="mx-auto mb-4 size-16">
            <AvatarImage src={inviteData.owner?.profileImage || undefined} />
            <AvatarFallback className="text-lg bg-primary text-primary-foreground">
              {inviteData.owner?.displayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <CardTitle>{inviteData.owner?.displayName} invited you</CardTitle>
          <CardDescription>
            Join &ldquo;{inviteData.chatTitle}&rdquo; and chat with AI together
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>
                {inviteData.participantCount}/{inviteData.maxParticipants}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChatCircleDots className="size-4" />
              <span>Collaborative</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full"
            size="lg"
          >
            {isJoining ? "Joining..." : "Join Chat"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You&apos;ll be able to collaborate with others in real-time
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
