"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser } from "@/lib/user-store/provider"
import { User } from "@phosphor-icons/react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function UserProfile() {
  const { user } = useUser()
  const [onboardingFirstName, setOnboardingFirstName] = useState<string | null>(null)

  useEffect(() => {
    const fetchOnboardingName = async () => {
      if (!user?.id) return

      const supabase = createClient()
      const { data } = await supabase
        .from("onboarding_data")
        .select("first_name")
        .eq("user_id", user.id)
        .single()

      setOnboardingFirstName(data?.first_name || null)
    }

    fetchOnboardingName()
  }, [user?.id])

  if (!user) return null

  // Use onboarding first_name if available, fall back to display_name
  const displayName = onboardingFirstName || user?.display_name

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">Profile</h3>
      <div className="flex items-center space-x-4">
        <div className="bg-muted flex items-center justify-center overflow-hidden rounded-full">
          {user?.profile_image ? (
            <Avatar className="size-12">
              <AvatarImage src={user.profile_image} className="object-cover" />
              <AvatarFallback>{displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="text-muted-foreground size-12" />
          )}
        </div>
        <div>
          <h4 className="text-sm font-medium">{displayName}</h4>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>
      </div>
    </div>
  )
}
