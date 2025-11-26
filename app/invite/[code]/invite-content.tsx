"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { validateInvite, joinCollaborativeChat } from "@/lib/collaborative-store/api"
import { useUser } from "@/lib/user-store/provider"
import { Users, WarningCircle, ChatCircleDots, ArrowRight } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

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
      // Small delay to allow chats list to refresh before navigation
      // This prevents the chat page from redirecting due to stale cache
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push(`/c/${inviteData.chatId}`)
    } catch (err) {
      setError((err as Error).message)
      setIsJoining(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="relative">
              <div className="size-12 rounded-full border-2 border-muted" />
              <div className="absolute inset-0 size-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <span className="text-sm text-muted-foreground animate-pulse">
              Validating invite...
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !inviteData?.valid) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
            <WarningCircle className="size-10 text-destructive" weight="duotone" />
          </div>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            Invalid Invite
          </h1>
          <p className="mb-8 text-muted-foreground">
            {error || inviteData?.error || "This invite link is invalid or has expired."}
          </p>
          <Button asChild size="lg" className="px-8">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center">
          {/* Avatar with gradient ring */}
          <div className="relative mx-auto mb-6 inline-block">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 opacity-75 blur-sm" />
            <Avatar className="relative size-20 border-4 border-background">
              <AvatarImage src={inviteData.owner?.profileImage || undefined} />
              <AvatarFallback className="text-2xl font-medium bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {inviteData.owner?.displayName?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </div>

          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            {inviteData.owner?.displayName} invited you
          </h1>
          <p className="mb-6 text-muted-foreground">
            Join &ldquo;{inviteData.chatTitle}&rdquo; and chat with AI together
          </p>

          {/* Stats */}
          <div className="mb-8 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" weight="duotone" />
              <span>{inviteData.participantCount}/{inviteData.maxParticipants} participants</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChatCircleDots className="size-4" weight="duotone" />
              <span>Collaborative</span>
            </div>
          </div>

          <Button asChild size="lg" className="w-full max-w-xs">
            <Link href={`/auth/login?redirect=/invite/${code}`}>
              Sign in to join
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>

          <p className="mt-4 text-xs text-muted-foreground">
            You need to sign in to join collaborative chats
          </p>
        </div>
      </div>
    )
  }

  // Authenticated - ready to join
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        {/* Avatar with gradient ring */}
        <div className="relative mx-auto mb-6 inline-block">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 opacity-75 blur-sm" />
          <Avatar className="relative size-20 border-4 border-background">
            <AvatarImage src={inviteData.owner?.profileImage || undefined} />
            <AvatarFallback className="text-2xl font-medium bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {inviteData.owner?.displayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          {inviteData.owner?.displayName} invited you
        </h1>
        <p className="mb-6 text-muted-foreground">
          Join &ldquo;{inviteData.chatTitle}&rdquo; and chat with AI together
        </p>

        {/* Stats */}
        <div className="mb-8 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" weight="duotone" />
            <span>{inviteData.participantCount}/{inviteData.maxParticipants} participants</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ChatCircleDots className="size-4" weight="duotone" />
            <span>Collaborative</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Join button */}
        <Button
          onClick={handleJoin}
          disabled={isJoining}
          size="lg"
          className={cn(
            "w-full max-w-xs transition-all",
            isJoining && "animate-pulse"
          )}
        >
          {isJoining ? (
            <>
              <div className="mr-2 size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Joining...
            </>
          ) : (
            <>
              Join Chat
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          You&apos;ll be able to collaborate with others in real-time
        </p>
      </div>
    </div>
  )
}
