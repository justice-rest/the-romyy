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
// Using actual hex values for consistent display
export const PARTICIPANT_COLORS = [
  "#2563eb", // Index 0: Owner (blue-600)
  "#16a34a", // Index 1: First participant (green-600)
  "#9333ea", // Index 2: Second participant (purple-600)
] as const

export function getParticipantColor(colorIndex: number): string {
  // Ensure colorIndex is within bounds
  const safeIndex = Math.max(0, Math.min(colorIndex, PARTICIPANT_COLORS.length - 1))
  return PARTICIPANT_COLORS[safeIndex]
}
