"use client"

import { RomyIcon } from "@/components/icons/romy"
import { APP_NAME } from "@/lib/config"
import { useUser } from "@/lib/user-store/provider"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, Suspense, lazy } from "react"
import { PixelatedBackground } from "@/components/ui/pixelated-bg"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "@phosphor-icons/react"

// OPTIMIZATION: Lazy load pricing cards to reduce initial bundle size and improve TTI
const MMPricingCards = lazy(() =>
  import("@/components/subscription/mm-pricing-cards").then((mod) => ({
    default: mod.MMPricingCards,
  }))
)

// Loading skeleton for pricing cards
function PricingCardsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="w-full overflow-hidden rounded-xl">
        <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex w-full flex-col px-8 py-12 animate-pulse">
              <div className="mb-6 h-10 w-32 bg-muted rounded"></div>
              <div className="mb-10 h-8 w-24 bg-muted rounded"></div>
              <div className="mb-12 space-y-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-4 bg-muted rounded w-full"></div>
                ))}
              </div>
              <div className="mt-auto h-12 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Subscription Page
 *
 * Displays pricing tiers using MM components and allows authenticated users to subscribe.
 * Guest users are prompted to sign in.
 * Supports both light and dark modes.
 */
export default function SubscriptionPage() {
  const { user } = useUser()
  const router = useRouter()

  // Redirect guests to login
  useEffect(() => {
    if (user && user.anonymous) {
      router.push("/auth")
    }
  }, [user, router])

  // Show loading while checking user
  if (!user) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Don't render content for anonymous users (will redirect)
  if (user.anonymous) {
    return null
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-background">
      {/* Pixelated Background */}
      <PixelatedBackground
        className="z-1 absolute left-1/2 top-[-40px] h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover"
        style={{
          mixBlendMode: "screen",
          maskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />

      {/* Simple Header */}
      <header className="pointer-events-auto relative z-50 border-b border-border">
        <div className="mx-auto flex h-14 max-w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center text-xl font-medium tracking-tight text-foreground"
          >
            <RomyIcon className="mr-1 size-4" />
            {APP_NAME}
          </Link>
          <Link
            href="/"
            className="text-sm text-foreground/70 transition-colors hover:text-foreground"
          >
            Back to Chat
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-y-auto bg-transparent scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex h-full w-full flex-col items-center">
          {/* Content Container */}
          <div className="container mx-auto mt-12 px-4 py-1 md:mt-40">
            {/* Title Section */}
            <div className="mb-12 text-center">
              <h1 className="mb-4 text-4xl font-medium tracking-tight text-foreground md:text-5xl">
                Simple, Transparent Pricing
              </h1>
              <p className="text-foreground mx-auto max-w-2xl text-lg">
                Unlock the full potential of AI with Rōmy. Select the plan that
                fits your needs.
              </p>
            </div>

            {/* Pricing Cards - Centered with Suspense for faster initial render */}
            <div className="flex justify-center">
              <Suspense fallback={<PricingCardsSkeleton />}>
                <MMPricingCards />
              </Suspense>
            </div>

            {/* Contact Us Button - with padding */}
            <div className="mt-16 flex justify-center pb-16">
              <a href="mailto:howard@getromy.app">
                <Button
                  variant="outline"
                  className="group flex h-12 items-center justify-between rounded-full border-foreground bg-foreground py-2 pr-2 pl-6 text-background shadow-sm transition-all hover:scale-[1.02] hover:bg-background hover:text-foreground active:scale-[0.98]"
                >
                  Contact Us{" "}
                  <div className="ml-2 rounded-full bg-background/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-foreground">
                    <ArrowUpRight className="h-4 w-4 text-background transition-transform duration-300 group-hover:rotate-45 group-hover:text-background" weight="bold" />
                  </div>
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
