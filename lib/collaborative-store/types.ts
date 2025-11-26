import { Tables } from "@/app/types/database.types"

export type ChatCollaborator = Tables<"chat_collaborators">
export type ChatInvite = Tables<"chat_invites">
export type ChatLock = Tables<"chat_locks">

export interface Participant {
  id: string
  userId: string
  role: "owner" | "participant"
  colorIndex: number
  joinedAt: string | null
  displayName: string
  profileImage: string | null
  email: string | null
}

export interface LockState {
  lockedBy: string
  lockedByName: string
  lockedByImage: string | null
  lockedAt: string
  expiresAt: string
}

export interface OnlineUser {
  user_id: string
  display_name: string
  profile_image: string | null
  online_at: string
}

export interface CollaborativeContextType {
  // Chat info
  chatId: string | null
  isCollaborative: boolean
  isOwner: boolean
  ownerId: string | null

  // Participants
  participants: Participant[]
  onlineUsers: OnlineUser[]
  refreshParticipants: () => Promise<void>

  // Lock state
  currentLock: LockState | null
  canPrompt: boolean
  acquireLock: () => Promise<boolean>
  releaseLock: () => Promise<void>

  // Typing (optional)
  typingUsers: string[]
  setTyping: (isTyping: boolean) => void

  // Invite management (owner only)
  generateInviteLink: () => Promise<string | null>
  revokeInvite: (inviteId: string) => Promise<void>
  currentInvite: { code: string; expiresAt: string | null } | null

  // Admin actions (owner only)
  removeParticipant: (userId: string) => Promise<void>
  transferOwnership: (userId: string) => Promise<void>
  leaveChat: () => Promise<void>

  // Loading states
  isLoading: boolean
  error: string | null
}

// Color palette for participants (iMessage-style)
export const PARTICIPANT_COLORS = [
  "var(--color-blue-600)", // Index 0: Owner (always blue)
  "var(--color-green-600)", // Index 1: First participant
  "var(--color-purple-600)", // Index 2: Second participant
] as const

export function getParticipantColor(colorIndex: number): string {
  return PARTICIPANT_COLORS[colorIndex] || PARTICIPANT_COLORS[1]
}
