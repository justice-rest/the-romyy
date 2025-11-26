import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { Chat } from "@/lib/chat-store/types"
import { useUser } from "@/lib/user-store/provider"
import { DotsThree, PencilSimple, Trash, UsersThree } from "@phosphor-icons/react"
import { Pin, PinOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { DialogDeleteChat } from "./dialog-delete-chat"

type SidebarItemMenuProps = {
  chat: Chat
  onStartEditing: () => void
  onMenuOpenChange?: (open: boolean) => void
}

export function SidebarItemMenu({
  chat,
  onStartEditing,
  onMenuOpenChange,
}: SidebarItemMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const router = useRouter()
  const { deleteMessages } = useMessages()
  const { deleteChat, togglePinned, refresh } = useChats()
  const { chatId } = useChatSession()
  const { user } = useUser()
  const isMobile = useBreakpoint(768)

  const isAuthenticated = !!user?.id && !user.anonymous

  const handleConfirmDelete = async () => {
    await deleteMessages()
    await deleteChat(chat.id, chatId!, () => router.push("/"))
  }

  const handleMakeCollaborative = async () => {
    if (!isAuthenticated || !user?.id) {
      toast({
        title: "Sign in required",
        description: "You need to sign in to create collaborative chats.",
        status: "error",
      })
      return
    }

    setIsConverting(true)
    try {
      const response = await fetch("/api/collaborative/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          chatId: chat.id,
          isAuthenticated: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to convert chat")
      }

      const data = await response.json()

      // Refresh chats to show updated status
      await refresh()

      // Navigate to the chat to see the collaborative header
      router.push(`/c/${chat.id}`)

      // Show success with invite link if available
      if (data.invite?.code) {
        const inviteUrl = `${window.location.origin}/invite/${data.invite.code}`
        await navigator.clipboard.writeText(inviteUrl)
        toast({
          title: "Chat is now collaborative!",
          description: "Invite link copied to clipboard. Share it with others to invite them.",
          status: "success",
        })
      } else {
        toast({
          title: "Chat is now collaborative!",
          description: "You can invite others from the chat header.",
          status: "success",
        })
      }
    } catch (error) {
      console.error("Failed to make collaborative:", error)
      toast({
        title: "Failed to convert chat",
        description: (error as Error).message,
        status: "error",
      })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <>
      <DropdownMenu
        // shadcn/ui / radix pointer-events-none issue
        modal={isMobile ? true : false}
        onOpenChange={onMenuOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <button
            className="hover:bg-secondary flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThree size={18} className="text-primary" weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              togglePinned(chat.id, !chat.pinned)
            }}
          >
            {chat.pinned ? (
              <PinOff size={16} className="mr-2" />
            ) : (
              <Pin size={16} className="mr-2" />
            )}
            {chat.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onStartEditing()
            }}
          >
            <PencilSimple size={16} className="mr-2" />
            Rename
          </DropdownMenuItem>
          {/* Make Collaborative option - only for non-collaborative chats owned by authenticated users */}
          {isAuthenticated && !chat.is_collaborative && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={isConverting}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleMakeCollaborative()
                }}
              >
                <UsersThree size={16} className="mr-2" />
                {isConverting ? "Converting..." : "Make Collaborative"}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDeleteDialogOpen(true)
            }}
          >
            <Trash size={16} className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogDeleteChat
        isOpen={isDeleteDialogOpen}
        setIsOpen={setIsDeleteDialogOpen}
        chatTitle={chat.title || "Untitled chat"}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  )
}
