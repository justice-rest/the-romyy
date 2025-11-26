import { createClient } from "@/lib/supabase/client"
import { RealtimeChannel } from "@supabase/supabase-js"
import { OnlineUser, LockState } from "./types"
import { Tables } from "@/app/types/database.types"

type Message = Tables<"messages">
type ChatLock = Tables<"chat_locks">

export interface RealtimeCallbacks {
  onNewMessage?: (message: Message) => void
  onLockChange?: (lock: ChatLock | null, action: "INSERT" | "UPDATE" | "DELETE") => void
  onPresenceSync?: (users: OnlineUser[]) => void
  onPresenceJoin?: (user: OnlineUser) => void
  onPresenceLeave?: (user: OnlineUser) => void
  onTyping?: (userId: string, isTyping: boolean) => void
  onRemoved?: () => void
}

export class CollaborativeRealtimeManager {
  private supabase = createClient()
  private channels: RealtimeChannel[] = []
  private chatId: string
  private userId: string
  private displayName: string
  private profileImage: string | null

  constructor(
    chatId: string,
    userId: string,
    displayName: string,
    profileImage: string | null
  ) {
    this.chatId = chatId
    this.userId = userId
    this.displayName = displayName
    this.profileImage = profileImage
  }

  // Subscribe to new messages in the chat
  subscribeToMessages(onMessage: (message: Message) => void): void {
    if (!this.supabase) return

    const channel = this.supabase
      .channel(`collab:messages:${this.chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${this.chatId}`,
        },
        (payload) => {
          // Only notify if it's not our own message
          const message = payload.new as Message
          if (message.user_id !== this.userId) {
            onMessage(message)
          }
        }
      )
      .subscribe()

    this.channels.push(channel)
  }

  // Subscribe to lock changes
  subscribeToLock(
    onLockChange: (lock: LockState | null, lockerName?: string) => void
  ): void {
    if (!this.supabase) return

    const channel = this.supabase
      .channel(`collab:lock:${this.chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "chat_locks",
          filter: `chat_id=eq.${this.chatId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            onLockChange(null)
          } else {
            const lock = payload.new as ChatLock
            if (!lock.locked_by) {
              onLockChange(null)
              return
            }
            // Fetch the locker's user info
            const { data: user } = await this.supabase!
              .from("users")
              .select("display_name, profile_image")
              .eq("id", lock.locked_by)
              .single()

            onLockChange(
              {
                lockedBy: lock.locked_by,
                lockedByName: user?.display_name || "Someone",
                lockedByImage: user?.profile_image ?? null,
                lockedAt: lock.locked_at || new Date().toISOString(),
                expiresAt: lock.expires_at || new Date().toISOString(),
              },
              user?.display_name ?? undefined
            )
          }
        }
      )
      .subscribe()

    this.channels.push(channel)
  }

  // Subscribe to presence (who's online)
  subscribeToPresence(
    onSync: (users: OnlineUser[]) => void,
    onJoin?: (user: OnlineUser) => void,
    onLeave?: (user: OnlineUser) => void
  ): void {
    if (!this.supabase) return

    const channel = this.supabase
      .channel(`collab:presence:${this.chatId}`)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineUser>()
        const users = Object.values(state).flat() as OnlineUser[]
        onSync(users)
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        if (onJoin && newPresences.length > 0) {
          onJoin(newPresences[0] as unknown as OnlineUser)
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        if (onLeave && leftPresences.length > 0) {
          onLeave(leftPresences[0] as unknown as OnlineUser)
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: this.userId,
            display_name: this.displayName,
            profile_image: this.profileImage,
            online_at: new Date().toISOString(),
          })
        }
      })

    this.channels.push(channel)
  }

  // Subscribe to typing indicators
  subscribeToTyping(
    onTyping: (userId: string, isTyping: boolean) => void
  ): void {
    if (!this.supabase) return

    const channel = this.supabase
      .channel(`collab:typing:${this.chatId}`)
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: { payload: { user_id: string; is_typing: boolean } }) => {
          if (payload.user_id !== this.userId) {
            onTyping(payload.user_id, payload.is_typing)
          }
        }
      )
      .subscribe()

    this.channels.push(channel)
  }

  // Subscribe to removal notification (when this user is removed from the chat)
  subscribeToRemoval(onRemoved: () => void): void {
    if (!this.supabase) return

    const channel = this.supabase
      .channel(`collab:removal:${this.chatId}:${this.userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_collaborators",
          filter: `chat_id=eq.${this.chatId}`,
        },
        (payload) => {
          const updated = payload.new as { user_id: string; status: string }
          // If this user's status changed to "removed", trigger callback
          if (updated.user_id === this.userId && updated.status === "removed") {
            onRemoved()
          }
        }
      )
      .subscribe()

    this.channels.push(channel)
  }

  // Broadcast typing status
  async broadcastTyping(isTyping: boolean): Promise<void> {
    if (!this.supabase) return

    const typingChannel = this.channels.find((ch) =>
      ch.topic.includes("typing")
    )
    if (typingChannel) {
      await typingChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: this.userId, is_typing: isTyping },
      })
    }
  }

  // Subscribe to all events
  subscribeAll(callbacks: RealtimeCallbacks): void {
    if (callbacks.onNewMessage) {
      this.subscribeToMessages(callbacks.onNewMessage)
    }
    if (callbacks.onLockChange) {
      this.subscribeToLock((lock) => {
        callbacks.onLockChange!(
          lock
            ? {
                chat_id: this.chatId,
                locked_by: lock.lockedBy,
                locked_at: lock.lockedAt,
                expires_at: lock.expiresAt,
              }
            : null,
          lock ? "UPDATE" : "DELETE"
        )
      })
    }
    if (callbacks.onPresenceSync) {
      this.subscribeToPresence(
        callbacks.onPresenceSync,
        callbacks.onPresenceJoin,
        callbacks.onPresenceLeave
      )
    }
    if (callbacks.onTyping) {
      this.subscribeToTyping(callbacks.onTyping)
    }
  }

  // Cleanup all subscriptions
  cleanup(): void {
    if (!this.supabase) return

    this.channels.forEach((channel) => {
      this.supabase!.removeChannel(channel)
    })
    this.channels = []
  }
}

// Factory function for easier usage
export function createCollaborativeRealtime(
  chatId: string,
  userId: string,
  displayName: string,
  profileImage: string | null
): CollaborativeRealtimeManager {
  return new CollaborativeRealtimeManager(
    chatId,
    userId,
    displayName,
    profileImage
  )
}
