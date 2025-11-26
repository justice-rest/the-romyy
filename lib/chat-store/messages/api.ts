import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import type { Message as MessageAISDK } from "ai"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

export interface ExtendedMessageAISDK extends MessageAISDK {
  message_group_id?: string
  model?: string
  // Collaborative chat fields
  sender_display_name?: string
  sender_profile_image?: string | null
  user_id?: string
}

export async function getMessagesFromDb(
  chatId: string
): Promise<ExtendedMessageAISDK[]> {
  // fallback to local cache only
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId)
    return cached
  }

  const supabase = createClient()
  if (!supabase) return []

  // Try with collaborative columns first
  const { data: fullData, error: fullError } = await supabase
    .from("messages")
    .select(
      "id, content, role, experimental_attachments, created_at, parts, message_group_id, model, user_id, sender_display_name, sender_profile_image"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  // If column doesn't exist (42703), fall back to basic query
  if (fullError?.code === "42703") {
    const { data: basicData, error: basicError } = await supabase
      .from("messages")
      .select(
        "id, content, role, experimental_attachments, created_at, parts, message_group_id, model, user_id"
      )
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })

    if (basicError) {
      console.error("Failed to fetch messages:", basicError)
      return []
    }

    if (!basicData) return []

    return basicData.map((message) => ({
      id: String(message.id),
      role: message.role as MessageAISDK["role"],
      content: message.content ?? "",
      createdAt: new Date(message.created_at || ""),
      experimental_attachments: message.experimental_attachments as MessageAISDK["experimental_attachments"],
      parts: (message?.parts as MessageAISDK["parts"]) || undefined,
      message_group_id: message.message_group_id ?? undefined,
      model: message.model ?? undefined,
      user_id: message.user_id ?? undefined,
    }))
  }

  if (fullError) {
    console.error("Failed to fetch messages:", fullError)
    return []
  }

  if (!fullData) return []

  return fullData.map((message) => ({
    id: String(message.id),
    role: message.role as MessageAISDK["role"],
    content: message.content ?? "",
    createdAt: new Date(message.created_at || ""),
    experimental_attachments: message.experimental_attachments as MessageAISDK["experimental_attachments"],
    parts: (message?.parts as MessageAISDK["parts"]) || undefined,
    message_group_id: message.message_group_id ?? undefined,
    model: message.model ?? undefined,
    user_id: message.user_id ?? undefined,
    sender_display_name: message.sender_display_name ?? undefined,
    sender_profile_image: message.sender_profile_image ?? undefined,
  }))
}

export async function getLastMessagesFromDb(
  chatId: string,
  limit: number = 2
): Promise<MessageAISDK[]> {
  if (!isSupabaseEnabled) {
    const cached = await getCachedMessages(chatId)
    return cached.slice(-limit)
  }

  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, content, role, experimental_attachments, created_at, parts, message_group_id, model"
    )
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!data || error) {
    console.error("Failed to fetch last messages: ", error)
    return []
  }

  const ascendingData = [...data].reverse()
  return ascendingData.map((message) => ({
    ...message,
    id: String(message.id),
    content: message.content ?? "",
    createdAt: new Date(message.created_at || ""),
    parts: (message?.parts as MessageAISDK["parts"]) || undefined,
    message_group_id: message.message_group_id,
    model: message.model,
  }))
}

async function insertMessageToDb(
  chatId: string,
  message: ExtendedMessageAISDK
) {
  const supabase = createClient()
  if (!supabase) return

  await supabase.from("messages").insert({
    chat_id: chatId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimental_attachments,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  })
}

async function insertMessagesToDb(
  chatId: string,
  messages: ExtendedMessageAISDK[]
) {
  const supabase = createClient()
  if (!supabase) return

  const payload = messages.map((message) => ({
    chat_id: chatId,
    role: message.role,
    content: message.content,
    experimental_attachments: message.experimental_attachments,
    created_at: message.createdAt?.toISOString() || new Date().toISOString(),
    message_group_id: message.message_group_id || null,
    model: message.model || null,
  }))

  await supabase.from("messages").insert(payload)
}

async function deleteMessagesFromDb(chatId: string) {
  const supabase = createClient()
  if (!supabase) return

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId)

  if (error) {
    console.error("Failed to clear messages from database:", error)
  }
}

type ChatMessageEntry = {
  id: string
  messages: MessageAISDK[]
}

export async function getCachedMessages(
  chatId: string
): Promise<MessageAISDK[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: MessageAISDK[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: MessageAISDK
): Promise<void> {
  await insertMessageToDb(chatId, message)
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: MessageAISDK[]
): Promise<void> {
  await insertMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}
