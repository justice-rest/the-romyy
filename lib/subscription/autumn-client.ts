import { Autumn } from "autumn-js"

/**
 * Autumn Client Utility
 *
 * Provides a server-side Autumn client for:
 * - Checking feature access
 * - Tracking usage
 * - Managing subscriptions
 *
 * This is used in API routes to enforce subscription limits.
 */

/**
 * Circuit Breaker for Autumn API
 * Tracks failures and switches to degraded mode after threshold
 */
class AutumnCircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private readonly FAILURE_THRESHOLD = 5 // Number of consecutive failures before circuit opens
  private readonly RESET_TIMEOUT = 60000 // 1 minute - time to reset failure count
  private readonly DEGRADED_LIMIT = 10 // Limit in degraded mode (10 messages)

  recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
  }

  recordSuccess() {
    this.failureCount = 0
  }

  isCircuitOpen(): boolean {
    // Reset if enough time has passed
    if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
      this.failureCount = 0
      return false
    }
    return this.failureCount >= this.FAILURE_THRESHOLD
  }

  getDegradedLimit(): number {
    return this.DEGRADED_LIMIT
  }
}

const circuitBreaker = new AutumnCircuitBreaker()

/**
 * Normalize plan ID by removing billing cycle suffixes
 * Handles variations like "-yearly", "-annual", "-monthly", etc.
 *
 * Examples:
 * - "pro-yearly" → "pro"
 * - "max-annual" → "max"
 * - "ultra" → "ultra"
 */
export function normalizePlanId(productId?: string): string | null {
  if (!productId) return null

  // Remove common billing cycle suffixes
  return productId
    .replace(/-yearly$/i, "")
    .replace(/-annual$/i, "")
    .replace(/-monthly$/i, "")
    .toLowerCase()
}

/**
 * Check if Autumn is enabled
 */
export function isAutumnEnabled(): boolean {
  return !!process.env.AUTUMN_SECRET_KEY
}

/**
 * Get the Autumn client instance
 */
export function getAutumnClient(): Autumn | null {
  if (!isAutumnEnabled()) {
    return null
  }

  return new Autumn({
    secretKey: process.env.AUTUMN_SECRET_KEY!,
  })
}

/**
 * Check if a user has access to send messages
 * Returns the allowed status and current balance
 *
 * Implements circuit breaker pattern:
 * - On repeated failures, switches to degraded mode with limited access
 * - Prevents abuse by malicious users blocking Autumn API
 */
export async function checkMessageAccess(
  userId: string,
  dailyMessageCount?: number // Optional Supabase message count for degraded mode
): Promise<{ allowed: boolean; balance?: number; limit?: number }> {
  const autumn = getAutumnClient()

  if (!autumn) {
    // If Autumn is not enabled, allow access (fallback to existing rate limits)
    return { allowed: true }
  }

  // Check circuit breaker state
  if (circuitBreaker.isCircuitOpen()) {
    console.warn("[Autumn Circuit Breaker] Circuit OPEN - using degraded mode", {
      userId,
      degradedLimit: circuitBreaker.getDegradedLimit(),
    })

    // Degraded mode: allow limited access based on daily message count
    const currentCount = dailyMessageCount ?? 0
    const degradedLimit = circuitBreaker.getDegradedLimit()

    return {
      allowed: currentCount < degradedLimit,
      balance: currentCount,
      limit: degradedLimit,
    }
  }

  try {
    // First check if customer has any past_due subscriptions
    const customerData = await getCustomerData(userId)
    const hasPastDueSubscription = customerData?.products?.some(
      (product) => product.status === "past_due"
    )

    // Block access if payment is past due
    if (hasPastDueSubscription) {
      console.log("[Autumn] Blocking access due to past_due payment", { userId })
      circuitBreaker.recordSuccess() // This is a successful API call even if denied
      return { allowed: false, balance: 0, limit: 0 }
    }

    const { data, error } = await autumn.check({
      customer_id: userId,
      feature_id: "messages",
    })

    if (error) {
      console.error("[Autumn] Check error:", error)
      circuitBreaker.recordFailure()

      // If circuit just opened, use degraded mode
      if (circuitBreaker.isCircuitOpen()) {
        const currentCount = dailyMessageCount ?? 0
        const degradedLimit = circuitBreaker.getDegradedLimit()
        return {
          allowed: currentCount < degradedLimit,
          balance: currentCount,
          limit: degradedLimit,
        }
      }

      // Still within failure threshold, fail open but record failure
      return { allowed: true }
    }

    // Success - reset circuit breaker
    circuitBreaker.recordSuccess()

    return {
      allowed: data.allowed,
      balance: data.balance ?? undefined,
      limit: undefined, // Autumn doesn't return limit in check response
    }
  } catch (error) {
    console.error("[Autumn] Exception checking message access:", error)
    circuitBreaker.recordFailure()

    // If circuit opened, use degraded mode
    if (circuitBreaker.isCircuitOpen()) {
      const currentCount = dailyMessageCount ?? 0
      const degradedLimit = circuitBreaker.getDegradedLimit()
      return {
        allowed: currentCount < degradedLimit,
        balance: currentCount,
        limit: degradedLimit,
      }
    }

    // Still within failure threshold, fail open but record failure
    return { allowed: true }
  }
}

/**
 * Track a message usage event
 *
 * IMPORTANT: This tracks usage for ALL authenticated users, including unlimited plans.
 * This ensures accurate balance when users downgrade from unlimited (Max/Ultra) to
 * limited (Pro) plans mid-billing period, preventing sudden lockout.
 */
export async function trackMessageUsage(userId: string): Promise<void> {
  const autumn = getAutumnClient()

  if (!autumn) {
    return
  }

  try {
    await autumn.track({
      customer_id: userId,
      feature_id: "messages",
      value: 1,
    })
  } catch (error) {
    console.error("Error tracking message usage:", error)
    // Don't throw - we don't want to block the user if tracking fails
  }
}

/**
 * Get customer subscription data
 */
export async function getCustomerData(userId: string) {
  const autumn = getAutumnClient()

  if (!autumn) {
    return null
  }

  try {
    const { data, error } = await autumn.customers.get(userId)

    if (error) {
      console.error("Error fetching customer data:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error fetching customer data:", error)
    return null
  }
}
