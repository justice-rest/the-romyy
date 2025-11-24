"use client"

import { useCustomer } from "autumn-js/react"
import { TrendingUp, Mail, RefreshCcw } from "lucide-react"
import { DiamondsFour } from "@phosphor-icons/react"
import NumberFlow from "@number-flow/react"
import Link from "next/link"
import { useState, useEffect } from "react"

/**
 * Subscription Section Component
 *
 * Displays current subscription status and billing management options.
 * Shown in the settings sidebar or a dedicated subscription settings page.
 */
export function SubscriptionSection() {
  const { customer, openBillingPortal, refetch } = useCustomer()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [dataLoadedAt, setDataLoadedAt] = useState<number>(Date.now())

  // Auto-refresh subscription data on mount to ensure fresh data
  useEffect(() => {
    const refreshData = async () => {
      try {
        await refetch()
        setDataLoadedAt(Date.now())
      } catch (error) {
        console.error("Auto-refresh failed:", error)
      }
    }
    refreshData()
  }, [refetch])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetch()
      setDataLoadedAt(Date.now())
    } catch (error) {
      console.error("Error refreshing subscription data:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleOpenBillingPortal = async () => {
    try {
      await openBillingPortal({
        returnUrl: window.location.href,
      })
    } catch (error) {
      console.error("Error opening billing portal:", error)
    }
  }

  // Get current product - ensure we handle undefined customer
  const currentProduct = customer?.products?.[0]
  const scheduledProducts = customer?.products?.filter(
    (p) => p.status === "scheduled"
  ) || []

  // Get the most recent scheduled product (last in array)
  // If multiple scheduled changes exist, show the final one
  const scheduledProduct = scheduledProducts.length > 0
    ? scheduledProducts[scheduledProducts.length - 1]
    : undefined

  const features = customer?.features

  // Get plan icon and color based on product ID
  const getPlanIcon = (productId?: string) => {
    switch (productId) {
      case "growth":
        return { iconSrc: "/lock.svg", bgColor: "bg-transparent", isMailIcon: false }
      case "pro":
        return { iconSrc: "/zap.svg", bgColor: "bg-transparent", isMailIcon: false }
      case "scale":
        return { iconSrc: "/mail-pixel.svg", bgColor: "bg-transparent", isMailIcon: true }
      default:
        return { iconSrc: "/lock.svg", bgColor: "bg-transparent", isMailIcon: false }
    }
  }

  const { iconSrc, bgColor, isMailIcon } = getPlanIcon(currentProduct?.id)

  // Determine if plan has unlimited messages (Pro or Scale)
  const planType = currentProduct?.id
  const hasUnlimitedMessages = planType === "pro" || planType === "scale"

  // Get scheduled plan info for notification
  const scheduledPlanName = scheduledProduct?.name
  const scheduledPlanType = scheduledProduct?.id
  const hasMultipleScheduled = scheduledProducts.length > 1

  // For security: Always check product status directly from the customer object
  // This prevents manipulation by checking server-side data
  const isProductActive = currentProduct?.status === "active"

  // Validate subscription data integrity
  const hasValidProduct = currentProduct?.id && currentProduct?.name
  const hasValidFeatures = features !== undefined

  // Detect potential data staleness or sync issues
  // Only show warning after 5 minutes to avoid false positives after checkout
  const SYNC_WARNING_DELAY = 5 * 60 * 1000 // 5 minutes in milliseconds
  const timeSinceLoad = Date.now() - dataLoadedAt
  const hasPotentialSyncIssue =
    isProductActive &&
    hasValidProduct &&
    !hasValidFeatures &&
    timeSinceLoad > SYNC_WARNING_DELAY

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

  // Check if user has an active subscription - using the secure check
  const hasActiveSubscription = isProductActive && currentProduct !== undefined

  return (
    <div className="space-y-4">
      {/* Scheduled Plan Notification */}
      {scheduledProduct && scheduledPlanName && (
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-full bg-blue-100 p-1 dark:bg-blue-800">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">Plan Change Scheduled</p>
              <p className="mt-1 opacity-90">
                Your subscription will switch to <strong>{scheduledPlanName}</strong> at
                the end of your current billing period.
                {hasMultipleScheduled && (
                  <span className="ml-1">
                    ({scheduledProducts.length} plan changes pending)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sync Issue Warning */}
      {hasPotentialSyncIssue && (
        <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <div className="flex items-center justify-between">
            <span>
              Subscription data may be out of sync. Click the refresh button to
              update.
            </span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-2 rounded bg-yellow-100 px-2 py-1 text-xs font-medium hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="rounded-lg border bg-card p-6 text-card-foreground">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${bgColor}`}>
              {isMailIcon ? (
                <Mail className="h-6 w-6 text-blue-500" />
              ) : (
                <img
                  src={iconSrc}
                  alt="plan icon"
                  className="h-6 w-6"
                  height={24}
                  width={24}
                />
              )}
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
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Refresh subscription data"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Usage Stats */}
        {hasActiveSubscription && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Messages</span>
              <div className="flex items-center gap-1">
                <DiamondsFour size={14} weight="fill" className="text-primary" />
                <span className="text-muted-foreground font-semibold">
                  {hasUnlimitedMessages ? (
                    "∞ Unlimited"
                  ) : features?.messages?.balance !== undefined ? (
                    <>
                      <NumberFlow
                        value={features.messages.balance ?? 0}
                        className="inline"
                      />
                      /100
                    </>
                  ) : (
                    "0/100"
                  )}
                </span>
              </div>
            </div>
            {!hasUnlimitedMessages && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(((features?.messages?.balance ?? 0) / 100) * 100, 100)}%`,
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

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 rounded-lg bg-muted/30 p-3 text-xs">
            <div className="font-semibold mb-1">Debug Info:</div>
            <div>Product ID: {currentProduct?.id || "none"}</div>
            <div>Status: {currentProduct?.status || "none"}</div>
            <div>Plan Type: {planType || "none"}</div>
            <div>Has Active Sub: {hasActiveSubscription ? "yes" : "no"}</div>
            <div>Message Balance: {features?.messages?.balance ?? "undefined"}</div>
            <div>Unlimited: {hasUnlimitedMessages ? "yes" : "no"}</div>
            {scheduledProduct && (
              <>
                <div className="mt-2 font-semibold">Scheduled Product:</div>
                <div>Scheduled ID: {scheduledProduct?.id || "none"}</div>
                <div>Scheduled Name: {scheduledPlanName || "none"}</div>
                <div>Scheduled Status: {scheduledProduct?.status || "none"}</div>
              </>
            )}
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
