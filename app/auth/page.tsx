import { isSupabaseEnabled } from "@/lib/supabase/config"
import { notFound } from "next/navigation"
import LoginPage from "./login-page"

export const dynamic = "force-dynamic"

export default function AuthPage() {
  if (!isSupabaseEnabled) {
    return notFound()
  }

  return <LoginPage />
}
