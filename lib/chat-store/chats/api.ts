import { readFromIndexedDB, writeToIndexedDB } from "@/lib/chat-store/persist"
import type { Chat, Chats } from "@/lib/chat-store/types"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { MODEL_DEFAULT } from "../../config"
import { fetchClient } from "../../fetch"
import {
  API_ROUTE_TOGGLE_CHAT_PIN,
  API_ROUTE_UPDATE_CHAT_MODEL,
} from "../../routes"

export async function getChatsForUserInDb(userId: string): Promise<Chats[]> {
  const supabase = createClient()
  if (!supabase) return []

  // Fetch chats owned by the user
  const { data: ownedChats, error: ownedError } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })

  if (ownedError) {
    console.error("Failed to fetch owned chats:", ownedError)
    return []
  }

  // Try to fetch collaborative chats (gracefully handle if table doesn't exist yet)
  let collaborativeChats: Chats[] = []
  try {
    const { data: collaboratorData, error: collabError } = await supabase
      .from("chat_collaborators")
      .select("chat_id, chats(*)")
      .eq("user_id", userId)
      .eq("status", "accepted")

    // Only process if table exists and query succeeded
    if (!collabError && collaboratorData) {
      collaborativeChats = collaboratorData
        .map((item) => item.chats as unknown as Chats)
        .filter((chat): chat is Chats => chat !== null)
    } else if (collabError?.code !== "42P01") {
      // Log error only if it's not "table does not exist"
      console.error("Failed to fetch collaborative chats:", collabError)
    }
  } catch {
    // Collaborative feature not available - continue with owned chats only
  }

  // If no collaborative chats, return owned chats directly (no overhead)
  if (collaborativeChats.length === 0) {
    return ownedChats || []
  }

  // Combine and deduplicate (user might be both owner and collaborator in edge cases)
  const allChats = [...(ownedChats || []), ...collaborativeChats]
  const uniqueChats = Array.from(
    new Map(allChats.map((chat) => [chat.id, chat])).values()
  )

  // Sort by pinned, then updated_at
  return uniqueChats.sort((a, b) => {
    // Pinned chats first
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    // Then by updated_at
    return new Date(b.updated_at || "").getTime() - new Date(a.updated_at || "").getTime()
  })
}

export async function updateChatTitleInDb(id: string, title: string) {
  const supabase = createClient()
  if (!supabase) return

  const { error } = await supabase
    .from("chats")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function deleteChatInDb(id: string) {
  const supabase = createClient()
  if (!supabase) return

  const { error } = await supabase.from("chats").delete().eq("id", id)
  if (error) throw error
}

export async function getAllUserChatsInDb(userId: string): Promise<Chats[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (!data || error) return []
  return data
}

export async function createChatInDb(
  userId: string,
  title: string,
  model: string,
  systemPrompt: string
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId, title, model, system_prompt: systemPrompt })
    .select("id")
    .single()

  if (error || !data?.id) return null
  return data.id
}

export async function fetchAndCacheChats(userId: string): Promise<Chats[]> {
  if (!isSupabaseEnabled) {
    return await getCachedChats()
  }

  const data = await getChatsForUserInDb(userId)

  if (data.length > 0) {
    await writeToIndexedDB("chats", data)
  }

  return data
}

export async function getCachedChats(): Promise<Chats[]> {
  const all = await readFromIndexedDB<Chats>("chats")
  return (all as Chats[]).sort(
    (a, b) => +new Date(b.created_at || "") - +new Date(a.created_at || "")
  )
}

export async function updateChatTitle(
  id: string,
  title: string
): Promise<void> {
  await updateChatTitleInDb(id, title)
  const all = await getCachedChats()
  const updated = (all as Chats[]).map((c) =>
    c.id === id ? { ...c, title } : c
  )
  await writeToIndexedDB("chats", updated)
}

export async function deleteChat(id: string): Promise<void> {
  await deleteChatInDb(id)
  const all = await getCachedChats()
  await writeToIndexedDB(
    "chats",
    (all as Chats[]).filter((c) => c.id !== id)
  )
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const all = await readFromIndexedDB<Chat>("chats")
  return (all as Chat[]).find((c) => c.id === chatId) || null
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const data = await getAllUserChatsInDb(userId)
  if (!data) return []
  await writeToIndexedDB("chats", data)
  return data
}

export async function createChat(
  userId: string,
  title: string,
  model: string,
  systemPrompt: string
): Promise<string> {
  const id = await createChatInDb(userId, title, model, systemPrompt)
  const finalId = id ?? crypto.randomUUID()

  await writeToIndexedDB("chats", {
    id: finalId,
    title,
    model,
    user_id: userId,
    system_prompt: systemPrompt,
    created_at: new Date().toISOString(),
  })

  return finalId
}

export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    const all = await getCachedChats()
    const updated = (all as Chats[]).map((c) =>
      c.id === chatId ? { ...c, model } : c
    )
    await writeToIndexedDB("chats", updated)

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}

export async function toggleChatPin(chatId: string, pinned: boolean) {
  try {
    const res = await fetchClient(API_ROUTE_TOGGLE_CHAT_PIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, pinned }),
    })
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update pinned: ${res.status} ${res.statusText}`
      )
    }
    const all = await getCachedChats()
    const now = new Date().toISOString()
    const updated = (all as Chats[]).map((c) =>
      c.id === chatId ? { ...c, pinned, pinned_at: pinned ? now : null } : c
    )
    await writeToIndexedDB("chats", updated)
    return responseData
  } catch (error) {
    console.error("Error updating chat pinned:", error)
    throw error
  }
}

export async function createNewChat(
  userId: string,
  title?: string,
  model?: string,
  isAuthenticated?: boolean,
  projectId?: string
): Promise<Chats> {
  try {
    const payload: {
      userId: string
      title: string
      model: string
      isAuthenticated?: boolean
      projectId?: string
    } = {
      userId,
      title: title || "New Chat",
      model: model || MODEL_DEFAULT,
      isAuthenticated,
    }

    if (projectId) {
      payload.projectId = projectId
    }

    const res = await fetchClient("/api/create-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const responseData = await res.json()

    if (!res.ok || !responseData.chat) {
      throw new Error(responseData.error || "Failed to create chat")
    }

    const chat: Chats = {
      id: responseData.chat.id,
      title: responseData.chat.title,
      created_at: responseData.chat.created_at,
      model: responseData.chat.model,
      user_id: responseData.chat.user_id,
      public: responseData.chat.public,
      updated_at: responseData.chat.updated_at,
      project_id: responseData.chat.project_id || null,
      pinned: responseData.chat.pinned ?? false,
      pinned_at: responseData.chat.pinned_at ?? null,
      is_collaborative: responseData.chat.is_collaborative ?? false,
      max_participants: responseData.chat.max_participants ?? 3,
    }

    await writeToIndexedDB("chats", chat)
    return chat
  } catch (error) {
    console.error("Error creating new chat:", error)
    throw error
  }
}
