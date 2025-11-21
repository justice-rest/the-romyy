"use client"

import XIcon from "@/components/icons/x"
import { GoldVerifiedBadge } from "@/components/icons/gold-verified-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useUser } from "@/lib/user-store/provider"
import { InstagramLogoIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { useCustomer } from "autumn-js/react"
import { AppInfoTrigger } from "./app-info/app-info-trigger"
import { FeedbackTrigger } from "./feedback/feedback-trigger"
import { SettingsTrigger } from "./settings/settings-trigger"

export function UserMenu() {
  const { user } = useUser()
  const { customer } = useCustomer()
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  if (!user) return null

  const handleSettingsOpenChange = (isOpen: boolean) => {
    setSettingsOpen(isOpen)
    if (!isOpen) {
      setMenuOpen(false)
    }
  }

  // Check if user has an active subscription (any paid plan)
  const hasActiveSubscription =
    customer?.products?.[0]?.status === "active"

  // Get the subscription tier
  const currentProductId = customer?.products?.[0]?.id
  const planType = currentProductId?.replace("-yearly", "")
  const isPremiumTier = planType === "max" || planType === "ultra"

  return (
    // fix shadcn/ui / radix bug when dialog into dropdown menu
    <DropdownMenu open={isMenuOpen} onOpenChange={setMenuOpen} modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger>
            <Avatar className="bg-background hover:bg-muted">
              <AvatarImage src={user?.profile_image ?? undefined} />
              <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Profile</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        className="w-56"
        align="end"
        forceMount
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (isSettingsOpen) {
            e.preventDefault()
            return
          }
          setMenuOpen(false)
        }}
      >
        <DropdownMenuItem className="flex flex-col items-start gap-0 no-underline hover:bg-transparent focus:bg-transparent">
          <div className="flex items-center gap-1.5">
            <span>{user?.display_name}</span>
            {hasActiveSubscription && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    {isPremiumTier ? (
                      <GoldVerifiedBadge className="h-4 w-4" />
                    ) : (
                      <img
                        src="/verified.png"
                        alt="Verified"
                        className="h-4 w-4"
                        width={16}
                        height={16}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">Verified Subscriber</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-muted-foreground max-w-full truncate">
            {user?.email}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SettingsTrigger onOpenChange={handleSettingsOpenChange} />
        <FeedbackTrigger />
        <AppInfoTrigger />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            href="https://x.com/RomyFindsMoney"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <XIcon className="size-4 p-0.5" />
            <span>@RomyFindsMoney</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href="https://www.instagram.com/getromy.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <InstagramLogoIcon className="size-4" />
            <span>@getromy.app</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
