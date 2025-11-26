"use client"

import { toast } from "@/components/ui/toast"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { useStandaloneChatSession } from "@/lib/chat-store/session/standalone-provider"
import { createClient } from "@/lib/supabase/client"
import type { Message as MessageAISDK } from "ai"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { writeToIndexedDB } from "../persist"
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  setMessages as saveMessages,
  ExtendedMessageAISDK,
} from "./api"

interface MessagesContextType {
  messages: MessageAISDK[]
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<MessageAISDK[]>>
  refresh: () => Promise<void>
  saveAllMessages: (messages: MessageAISDK[]) => Promise<void>
  cacheAndAddMessage: (message: MessageAISDK) => Promise<void>
  resetMessages: () => Promise<void>
  deleteMessages: () => Promise<void>
}

const MessagesContext = createContext<MessagesContextType | null>(null)

export function useMessages() {
  const context = useContext(MessagesContext)
  if (!context)
    throw new Error("useMessages must be used within MessagesProvider")
  return context
}

export function MessagesProvider({
  children,
  chatIdOverride,
  isCollaborative = false,
}: {
  children: React.ReactNode
  chatIdOverride?: string | null
  isCollaborative?: boolean
}) {
  const [messages, setMessages] = useState<MessageAISDK[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const urlSession = useChatSession()
  const standaloneSession = useStandaloneChatSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionRef = useRef<any>(null)

  // Priority: prop override > standalone context > URL-based context
  const chatId =
    chatIdOverride !== undefined
      ? chatIdOverride
      : standaloneSession.chatId ?? urlSession.chatId

  // Convert database message to MessageAISDK format
  const convertToMessageAISDK = useCallback((dbMessage: {
    id: string
    content: string | null
    role: string
    experimental_attachments?: unknown
    created_at: string | null
    parts?: unknown
    message_group_id?: string | null
    model?: string | null
    user_id?: string | null
    sender_display_name?: string | null
    sender_profile_image?: string | null
  }): ExtendedMessageAISDK => ({
    id: String(dbMessage.id),
    role: dbMessage.role as MessageAISDK["role"],
    content: dbMessage.content ?? "",
    createdAt: new Date(dbMessage.created_at || ""),
    experimental_attachments: dbMessage.experimental_attachments as MessageAISDK["experimental_attachments"],
    parts: dbMessage.parts as MessageAISDK["parts"],
    message_group_id: dbMessage.message_group_id ?? undefined,
    model: dbMessage.model ?? undefined,
    user_id: dbMessage.user_id ?? undefined,
    sender_display_name: dbMessage.sender_display_name ?? undefined,
    sender_profile_image: dbMessage.sender_profile_image,
  }), [])

  useEffect(() => {
    if (chatId === null) {
      setMessages([])
      setIsLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    if (!chatId) return

    const load = async () => {
      setIsLoading(true)
      const cached = await getCachedMessages(chatId)
      setMessages(cached)

      try {
        const fresh = await getMessagesFromDb(chatId)
        setMessages(fresh)
        cacheMessages(chatId, fresh)
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [chatId])

  // Set up realtime subscription for collaborative chats
  useEffect(() => {
    if (!chatId || !isCollaborative) return

    const supabase = createClient()
    if (!supabase) return

    // Clean up any existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current)
    }

    // Subscribe to message changes for this chat
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = convertToMessageAISDK(payload.new as {
            id: string
            content: string | null
            role: string
            experimental_attachments?: unknown
            created_at: string | null
            parts?: unknown
            message_group_id?: string | null
            model?: string | null
            user_id?: string | null
            sender_display_name?: string | null
            sender_profile_image?: string | null
          })

          setMessages((prev) => {
            // Check if message already exists (avoid duplicates)
            const exists = prev.some((m) => m.id === newMessage.id)
            if (exists) return prev

            const updated = [...prev, newMessage]
            // Update cache
            writeToIndexedDB("messages", { id: chatId, messages: updated })
            return updated
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const deletedId = String((payload.old as { id: string }).id)
          setMessages((prev) => {
            const updated = prev.filter((m) => m.id !== deletedId)
            writeToIndexedDB("messages", { id: chatId, messages: updated })
            return updated
          })
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [chatId, isCollaborative, convertToMessageAISDK])

  const refresh = async () => {
    if (!chatId) return

    try {
      const fresh = await getMessagesFromDb(chatId)
      setMessages(fresh)
    } catch {
      toast({ title: "Failed to refresh messages", status: "error" })
    }
  }

  const cacheAndAddMessage = async (message: MessageAISDK) => {
    if (!chatId) return

    try {
      setMessages((prev) => {
        const updated = [...prev, message]
        writeToIndexedDB("messages", { id: chatId, messages: updated })
        return updated
      })
    } catch {
      toast({ title: "Failed to save message", status: "error" })
    }
  }

  const saveAllMessages = async (newMessages: MessageAISDK[]) => {
    // @todo: manage the case where the chatId is null (first time the user opens the chat)
    if (!chatId) return

    try {
      await saveMessages(chatId, newMessages)
      setMessages(newMessages)
    } catch {
      toast({ title: "Failed to save messages", status: "error" })
    }
  }

  const deleteMessages = async () => {
    if (!chatId) return

    setMessages([])
    await clearMessagesForChat(chatId)
  }

  const resetMessages = async () => {
    setMessages([])
  }

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages,
        refresh,
        saveAllMessages,
        cacheAndAddMessage,
        resetMessages,
        deleteMessages,
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}
