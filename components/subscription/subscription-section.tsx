"use client"

import { useCustomer } from "autumn-js/react"
import { TrendingUp } from "lucide-react"
import Link from "next/link"

/**
 * Subscription Section Component
 *
 * Displays current subscription status and billing management options.
 * Shown in the settings sidebar or a dedicated subscription settings page.
 */
export function SubscriptionSection() {
  const { customer, openBillingPortal } = useCustomer()

  const handleOpenBillingPortal = async () => {
    try {
      await openBillingPortal({
        returnUrl: window.location.href,
      })
    } catch (error) {
      console.error("Error opening billing portal:", error)
    }
  }

  // Get current product
  const currentProduct = customer?.products?.[0]
  const features = customer?.features

  // Get plan icon and color based on product ID
  const getPlanIcon = (productId?: string) => {
    // Handle both monthly and yearly variants
    const planType = productId?.replace("-yearly", "")

    switch (planType) {
      case "pro":
        return { iconSrc: "/lock.svg", bgColor: "bg-transparent" }
      case "max":
        return { iconSrc: "/zap.svg", bgColor: "bg-transparent" }
      case "ultra":
        return { iconSrc: "/mail-pixel.svg", bgColor: "bg-transparent" }
      default:
        return { iconSrc: "/lock.svg", bgColor: "bg-transparent" }
    }
  }

  const { iconSrc, bgColor } = getPlanIcon(currentProduct?.id)

  if (!customer) {
    return (
      <div className="rounded-lg border bg-card p-6 text-card-foreground">
        <h3 className="mb-2 text-lg font-semibold">Subscription</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Loading subscription information...
        </p>
      </div>
    )
  }

  // Check if user has an active subscription
  const hasActiveSubscription = currentProduct && currentProduct.status === "active"

  return (
    <div className="space-y-4">
      {/* Current Plan Card */}
      <div className="rounded-lg border bg-card p-6 text-card-foreground">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${bgColor}`}>
              <img
                src={iconSrc}
                alt="plan icon"
                className="h-6 w-6"
                height={24}
                width={24}
              />
            </div>
            <div>
              <h3 className="font-semibold">
                {currentProduct?.name || "Free Plan"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentProduct?.status === "active"
                  ? "Active subscription"
                  : currentProduct?.status === "past_due"
                    ? "Payment past due"
                    : "No active subscription"}
              </p>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        {features?.messages && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Messages</span>
              <span className="text-muted-foreground">
                {features.messages.balance !== undefined &&
                features.messages.balance !== null
                  ? `${features.messages.balance} used`
                  : "Unlimited"}
              </span>
            </div>
            {features.messages.balance !== undefined &&
              features.messages.balance !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((features.messages.balance / 100) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!hasActiveSubscription ? (
            <Link
              href="/subscription"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <TrendingUp className="h-4 w-4" />
              Upgrade Plan
            </Link>
          ) : (
            <>
              <button
                onClick={handleOpenBillingPortal}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Manage Billing
              </button>
              <Link
                href="/subscription"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <TrendingUp className="h-4 w-4" />
                Change Plan
              </Link>
            </>
          )}
        </div>

        {/* Past Due Warning */}
        {currentProduct?.status === "past_due" && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
            Your payment is past due. Please update your payment method to
            continue using your subscription.
          </div>
        )}
      </div>

      {/* Quick Info */}
      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <p className="text-sm text-muted-foreground">
          Need help with your subscription?{" "}
          <a
            href="mailto:howard@getromy.app"
            className="text-primary hover:underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
