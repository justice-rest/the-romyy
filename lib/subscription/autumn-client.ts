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
 */
export async function checkMessageAccess(
  userId: string
): Promise<{ allowed: boolean; balance?: number; limit?: number }> {
  const autumn = getAutumnClient()

  if (!autumn) {
    // If Autumn is not enabled, allow access (fallback to existing rate limits)
    return { allowed: true }
  }

  try {
    const { data, error } = await autumn.check({
      customer_id: userId,
      feature_id: "messages",
    })

    if (error) {
      console.error("Autumn check error:", error)
      return { allowed: true } // Fail open
    }

    return {
      allowed: data.allowed,
      balance: data.balance ?? undefined,
      limit: undefined, // Autumn doesn't return limit in check response
    }
  } catch (error) {
    console.error("Error checking message access:", error)
    return { allowed: true } // Fail open
  }
}

/**
 * Track a message usage event
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
