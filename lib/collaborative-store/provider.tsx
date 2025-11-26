"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/toast"
import {
  CollaborativeContextType,
  Participant,
  LockState,
  OnlineUser,
} from "./types"
import {
  fetchParticipants,
  generateInvite,
  revokeInvite as revokeInviteApi,
  removeParticipant as removeParticipantApi,
  transferOwnership as transferOwnershipApi,
  leaveChat as leaveChatApi,
  acquireChatLock,
  releaseChatLock,
  checkLockStatus,
} from "./api"
import { createCollaborativeRealtime, CollaborativeRealtimeManager } from "./realtime"
import { useUser } from "@/lib/user-store/provider"

const CollaborativeContext = createContext<CollaborativeContextType | null>(null)

interface CollaborativeProviderProps {
  chatId: string | null
  isCollaborative: boolean
  children: React.ReactNode
}

export function CollaborativeProvider({
  chatId,
  isCollaborative,
  children,
}: CollaborativeProviderProps) {
  const { user } = useUser()
  const router = useRouter()
  const userId = user?.id
  const isAuthenticated = !!user && !user.anonymous

  // State
  const [participants, setParticipants] = useState<Participant[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [currentLock, setCurrentLock] = useState<LockState | null>(null)
  const [canPrompt, setCanPrompt] = useState(true)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [currentInvite, setCurrentInvite] = useState<{
    code: string
    expiresAt: string | null
  } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs
  const realtimeRef = useRef<CollaborativeRealtimeManager | null>(null)
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})

  // Refresh participants
  const refreshParticipants = useCallback(async () => {
    if (!chatId || !userId || !isCollaborative) return

    try {
      const data = await fetchParticipants(chatId, userId, isAuthenticated)
      setParticipants(data.participants)
      setIsOwner(data.isOwner)
      setOwnerId(data.ownerId)
    } catch (err) {
      console.error("Error fetching participants:", err)
      setError((err as Error).message)
    }
  }, [chatId, userId, isAuthenticated, isCollaborative])

  // Check lock status
  const refreshLockStatus = useCallback(async () => {
    if (!chatId || !userId || !isCollaborative) return

    try {
      const data = await checkLockStatus(chatId, userId, isAuthenticated)
      setCanPrompt(data.canPrompt)
      setCurrentLock(data.lock)
    } catch (err) {
      console.error("Error checking lock status:", err)
    }
  }, [chatId, userId, isAuthenticated, isCollaborative])

  // Acquire lock
  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!chatId || !userId || !isCollaborative) return true // Non-collaborative always allows

    try {
      const result = await acquireChatLock(chatId, userId, isAuthenticated)
      if (result.acquired) {
        setCanPrompt(true)
        setCurrentLock(null)
        return true
      } else {
        setCanPrompt(false)
        if (result.lockedBy) {
          setCurrentLock({
            lockedBy: result.lockedBy,
            lockedByName: result.lockedByName || "Someone",
            lockedByImage: result.lockedByImage || null,
            lockedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
        }
        return false
      }
    } catch (err) {
      console.error("Error acquiring lock:", err)
      return false
    }
  }, [chatId, userId, isAuthenticated, isCollaborative])

  // Release lock
  const releaseLock = useCallback(async (): Promise<void> => {
    if (!chatId || !userId || !isCollaborative) return

    try {
      await releaseChatLock(chatId, userId, isAuthenticated)
      setCurrentLock(null)
      setCanPrompt(true)
    } catch (err) {
      console.error("Error releasing lock:", err)
    }
  }, [chatId, userId, isAuthenticated, isCollaborative])

  // Set typing
  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!realtimeRef.current) return
      realtimeRef.current.broadcastTyping(isTyping)
    },
    []
  )

  // Generate invite link
  const generateInviteLink = useCallback(async (): Promise<string | null> => {
    if (!chatId || !userId || !isOwner) return null

    try {
      const invite = await generateInvite(chatId, userId, isAuthenticated)
      setCurrentInvite({
        code: invite.code,
        expiresAt: invite.expiresAt,
      })
      // Build full URL
      const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
      return `${baseUrl}/invite/${invite.code}`
    } catch (err) {
      console.error("Error generating invite:", err)
      setError((err as Error).message)
      return null
    }
  }, [chatId, userId, isAuthenticated, isOwner])

  // Revoke invite
  const revokeInvite = useCallback(
    async (inviteId: string): Promise<void> => {
      if (!chatId || !userId || !isOwner) return

      try {
        await revokeInviteApi(chatId, inviteId, userId, isAuthenticated)
        setCurrentInvite(null)
      } catch (err) {
        console.error("Error revoking invite:", err)
        setError((err as Error).message)
      }
    },
    [chatId, userId, isAuthenticated, isOwner]
  )

  // Remove participant
  const removeParticipant = useCallback(
    async (targetUserId: string): Promise<void> => {
      if (!chatId || !userId) return

      try {
        await removeParticipantApi(chatId, targetUserId, userId, isAuthenticated)
        await refreshParticipants()
      } catch (err) {
        console.error("Error removing participant:", err)
        setError((err as Error).message)
      }
    },
    [chatId, userId, isAuthenticated, refreshParticipants]
  )

  // Transfer ownership
  const transferOwnership = useCallback(
    async (newOwnerId: string): Promise<void> => {
      if (!chatId || !userId || !isOwner) return

      try {
        await transferOwnershipApi(chatId, newOwnerId, userId, isAuthenticated)
        await refreshParticipants()
      } catch (err) {
        console.error("Error transferring ownership:", err)
        setError((err as Error).message)
      }
    },
    [chatId, userId, isAuthenticated, isOwner, refreshParticipants]
  )

  // Leave chat
  const leaveChat = useCallback(async (): Promise<void> => {
    if (!chatId || !userId) return

    try {
      await leaveChatApi(chatId, userId, isAuthenticated)
    } catch (err) {
      console.error("Error leaving chat:", err)
      setError((err as Error).message)
    }
  }, [chatId, userId, isAuthenticated])

  // Initialize on chat change
  useEffect(() => {
    if (!chatId || !userId || !isCollaborative) {
      // Reset state for non-collaborative chats
      setParticipants([])
      setOnlineUsers([])
      setCurrentLock(null)
      setCanPrompt(true)
      setTypingUsers([])
      setCurrentInvite(null)
      setIsOwner(false)
      setOwnerId(null)
      return
    }

    setIsLoading(true)
    setError(null)

    // Fetch initial data
    Promise.all([refreshParticipants(), refreshLockStatus()])
      .finally(() => setIsLoading(false))

    // Setup realtime subscriptions
    if (user?.display_name) {
      realtimeRef.current = createCollaborativeRealtime(
        chatId,
        userId,
        user.display_name || "Unknown",
        user.profile_image || null
      )

      // Subscribe to lock changes
      realtimeRef.current.subscribeToLock((lock) => {
        if (lock && lock.lockedBy !== userId) {
          setCurrentLock(lock)
          setCanPrompt(false)
        } else {
          setCurrentLock(null)
          setCanPrompt(true)
        }
      })

      // Subscribe to presence
      realtimeRef.current.subscribeToPresence(
        (users) => setOnlineUsers(users),
        undefined,
        undefined
      )

      // Subscribe to typing
      realtimeRef.current.subscribeToTyping((typingUserId, isTyping) => {
        if (isTyping) {
          setTypingUsers((prev) => [...new Set([...prev, typingUserId])])
          // Auto-clear typing after 3 seconds
          if (typingTimeoutRef.current[typingUserId]) {
            clearTimeout(typingTimeoutRef.current[typingUserId])
          }
          typingTimeoutRef.current[typingUserId] = setTimeout(() => {
            setTypingUsers((prev) => prev.filter((id) => id !== typingUserId))
          }, 3000)
        } else {
          setTypingUsers((prev) => prev.filter((id) => id !== typingUserId))
          if (typingTimeoutRef.current[typingUserId]) {
            clearTimeout(typingTimeoutRef.current[typingUserId])
          }
        }
      })

      // Subscribe to removal notification
      realtimeRef.current.subscribeToRemoval(() => {
        toast({
          title: "Removed from chat",
          description: "You have been removed from this collaborative chat.",
          status: "info",
        })
        router.push("/")
      })
    }

    // Cleanup
    return () => {
      if (realtimeRef.current) {
        realtimeRef.current.cleanup()
        realtimeRef.current = null
      }
      // Clear typing timeouts
      Object.values(typingTimeoutRef.current).forEach(clearTimeout)
      typingTimeoutRef.current = {}
    }
  }, [chatId, userId, isCollaborative, user?.display_name, user?.profile_image, refreshParticipants, refreshLockStatus, router])

  const value: CollaborativeContextType = {
    chatId,
    isCollaborative,
    isOwner,
    ownerId,
    participants,
    onlineUsers,
    refreshParticipants,
    currentLock,
    canPrompt,
    acquireLock,
    releaseLock,
    typingUsers,
    setTyping,
    generateInviteLink,
    revokeInvite,
    currentInvite,
    removeParticipant,
    transferOwnership,
    leaveChat,
    isLoading,
    error,
  }

  return (
    <CollaborativeContext.Provider value={value}>
      {children}
    </CollaborativeContext.Provider>
  )
}

export function useCollaborative(): CollaborativeContextType {
  const context = useContext(CollaborativeContext)
  if (!context) {
    // Return a default context for non-collaborative usage
    return {
      chatId: null,
      isCollaborative: false,
      isOwner: true,
      ownerId: null,
      participants: [],
      onlineUsers: [],
      refreshParticipants: async () => {},
      currentLock: null,
      canPrompt: true,
      acquireLock: async () => true,
      releaseLock: async () => {},
      typingUsers: [],
      setTyping: () => {},
      generateInviteLink: async () => null,
      revokeInvite: async () => {},
      currentInvite: null,
      removeParticipant: async () => {},
      transferOwnership: async () => {},
      leaveChat: async () => {},
      isLoading: false,
      error: null,
    }
  }
  return context
}
