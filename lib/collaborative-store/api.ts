import { fetchClient } from "@/lib/fetch"
import { Participant, LockState } from "./types"

// Fetch participants for a collaborative chat
export async function fetchParticipants(
  chatId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<{
  participants: Participant[]
  isOwner: boolean
  ownerId: string
}> {
  const res = await fetchClient(
    `/api/collaborative/${chatId}/participants?userId=${userId}&isAuthenticated=${isAuthenticated}`,
    { method: "GET" }
  )

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to fetch participants")
  }

  return res.json()
}

// Create a new collaborative chat
export async function createCollaborativeChat(
  userId: string,
  title: string,
  model: string,
  isAuthenticated: boolean,
  maxParticipants: number = 3
): Promise<{
  chat: { id: string; title: string }
  invite: { code: string; expiresAt: string } | null
}> {
  const res = await fetchClient("/api/collaborative/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      title,
      model,
      isAuthenticated,
      maxParticipants,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create collaborative chat")
  }

  return res.json()
}

// Generate a new invite link
export async function generateInvite(
  chatId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<{ code: string; expiresAt: string; maxUses: number }> {
  const res = await fetchClient(`/api/collaborative/${chatId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to generate invite")
  }

  const data = await res.json()
  return data.invite
}

// Revoke an invite
export async function revokeInvite(
  chatId: string,
  inviteId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<void> {
  const res = await fetchClient(`/api/collaborative/${chatId}/invite`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated, inviteId }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to revoke invite")
  }
}

// Join a collaborative chat
export async function joinCollaborativeChat(
  chatId: string,
  inviteCode: string,
  userId: string,
  isAuthenticated: boolean
): Promise<{ chatId: string; chatTitle: string }> {
  const res = await fetchClient(`/api/collaborative/${chatId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated, inviteCode }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to join chat")
  }

  const data = await res.json()
  return { chatId: data.chat.id, chatTitle: data.chat.title }
}

// Check lock status
export async function checkLockStatus(
  chatId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<{
  canPrompt: boolean
  reason: string | null
  lock: LockState | null
}> {
  const res = await fetchClient(
    `/api/collaborative/${chatId}/lock?userId=${userId}&isAuthenticated=${isAuthenticated}`,
    { method: "GET" }
  )

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to check lock status")
  }

  return res.json()
}

// Acquire lock
export async function acquireChatLock(
  chatId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<{
  acquired: boolean
  lockedBy?: string
  lockedByName?: string
  lockedByImage?: string
}> {
  const res = await fetchClient(`/api/collaborative/${chatId}/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to acquire lock")
  }

  return res.json()
}

// Release lock
export async function releaseChatLock(
  chatId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<void> {
  const res = await fetchClient(`/api/collaborative/${chatId}/lock`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to release lock")
  }
}

// Remove participant
export async function removeParticipant(
  chatId: string,
  targetUserId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<void> {
  const res = await fetchClient(`/api/collaborative/${chatId}/participants`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated, targetUserId }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to remove participant")
  }
}

// Transfer ownership
export async function transferOwnership(
  chatId: string,
  newOwnerId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<void> {
  const res = await fetchClient(`/api/collaborative/${chatId}/participants`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated, newOwnerId }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to transfer ownership")
  }
}

// Leave chat
export async function leaveChat(
  chatId: string,
  userId: string,
  isAuthenticated: boolean
): Promise<void> {
  const res = await fetchClient(`/api/collaborative/${chatId}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, isAuthenticated }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to leave chat")
  }
}

// Validate invite code (for invite page)
export async function validateInvite(code: string): Promise<{
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
}> {
  const res = await fetchClient(
    `/api/collaborative/validate-invite?code=${encodeURIComponent(code)}`,
    { method: "GET" }
  )

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to validate invite")
  }

  return res.json()
}
