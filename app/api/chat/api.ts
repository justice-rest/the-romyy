import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from "@/app/types/api.types"
import {
  ProLimitReachedError,
  SubscriptionRequiredError,
} from "@/lib/api"
import { FREE_MODELS_IDS, NON_AUTH_ALLOWED_MODELS } from "@/lib/config"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import { sanitizeUserInput } from "@/lib/sanitize"
import { validateUserIdentity } from "@/lib/server/api"
import {
  checkMessageAccess,
  getCustomerData,
  normalizePlanId,
  trackMessageUsage,
} from "@/lib/subscription/autumn-client"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import {
  getEffectiveApiKey,
  type ProviderWithoutOllama,
} from "@/lib/user-keys"

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<SupabaseClientType | null> {
  const supabase = await validateUserIdentity(userId, isAuthenticated)
  if (!supabase) return null

  // Check if user is authenticated
  if (!isAuthenticated) {
    // For unauthenticated users, only allow specific models
    if (!NON_AUTH_ALLOWED_MODELS.includes(model)) {
      throw new Error(
        "This model requires authentication. Please sign in to access more models."
      )
    }
  } else {
    // For authenticated users, check API key requirements
    const provider = getProviderForModel(model)

    // OpenRouter is the only provider we support
    const effectiveApiKey = await getEffectiveApiKey(
      userId,
      provider as ProviderWithoutOllama
    )

    // If no API key and model is not in free list, deny access
    if (!effectiveApiKey && !FREE_MODELS_IDS.includes(model)) {
      throw new Error(
        `This model requires an API key for ${provider}. Please add your API key in settings or use a free model.`
      )
    }
  }

  // Check usage limits for the model
  await checkUsageByModel(supabase, userId, model, isAuthenticated)

  // If authenticated, check Autumn subscription limits
  if (isAuthenticated) {
    // Fetch user's daily message count for circuit breaker degraded mode
    const { data: userData } = await supabase
      .from("users")
      .select("daily_message_count")
      .eq("id", userId)
      .single()

    const dailyMessageCount = userData?.daily_message_count || 0

    // Check message access through Autumn (with circuit breaker support)
    const autumnCheck = await checkMessageAccess(userId, dailyMessageCount)

    // If not allowed, determine the specific reason
    if (!autumnCheck.allowed) {
      // Get customer data to determine plan type
      const customerData = await getCustomerData(userId)

      // Debug logging for subscription issues
      console.log("[Subscription Check] User blocked:", {
        userId,
        autumnAllowed: autumnCheck.allowed,
        autumnBalance: autumnCheck.balance,
        hasCustomerData: !!customerData,
        productsCount: customerData?.products?.length || 0,
        products: customerData?.products?.map((p) => ({
          id: p.id,
          status: p.status,
        })),
      })

      // Check if payment is past due
      const hasPastDueSubscription = customerData?.products?.some(
        (product) => product.status === "past_due"
      )

      if (hasPastDueSubscription) {
        console.log(
          "[Subscription Check] Payment past due - blocking access"
        )
        throw new SubscriptionRequiredError(
          "Your payment is past due. Please update your payment method to continue using Rōmy."
        )
      }

      // Check if user has any active subscription
      const hasActiveSubscription = customerData?.products?.some(
        (product) => product.status === "active"
      )

      // If no active subscription at all, show upgrade modal
      if (!hasActiveSubscription) {
        console.log(
          "[Subscription Check] No active subscription found - showing upgrade modal"
        )
        throw new SubscriptionRequiredError(
          "You need an active subscription to use Rōmy. Please subscribe to continue."
        )
      }

      // If they have a subscription but reached limit, check which tier
      const currentProductId = customerData?.products?.[0]?.id
      const planType = normalizePlanId(currentProductId)
      const isProTier = planType === "pro"

      console.log("[Subscription Check] Limit reached:", {
        planType,
        isProTier,
        productId: currentProductId,
      })

      if (isProTier) {
        throw new ProLimitReachedError(
          "You've reached your monthly message limit. Wait until next month or upgrade to continue."
        )
      } else {
        // For other plans that somehow hit a limit
        throw new Error(
          `You've reached your message limit${autumnCheck.limit ? ` of ${autumnCheck.limit} messages` : ""}. Please upgrade your subscription to continue.`
        )
      }
    }
  }

  return supabase
}

export async function incrementMessageCount({
  supabase,
  userId,
  isAuthenticated,
}: {
  supabase: SupabaseClientType
  userId: string
  isAuthenticated: boolean
}): Promise<void> {
  if (!supabase) return

  try {
    await incrementUsage(supabase, userId)

    // Track usage in Autumn for authenticated users
    if (isAuthenticated) {
      await trackMessageUsage(userId)
    }
  } catch (err) {
    console.error("Failed to increment message count:", err)
    // Don't throw error as this shouldn't block the chat
  }
}

export async function logUserMessage({
  supabase,
  userId,
  chatId,
  content,
  attachments,
  model,
  isAuthenticated,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: sanitizeUserInput(content),
    experimental_attachments: attachments,
    user_id: userId,
    message_group_id,
  })

  if (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  supabase,
  chatId,
  messages,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<void> {
  if (!supabase) return
  try {
    await saveFinalAssistantMessage(
      supabase,
      chatId,
      messages,
      message_group_id,
      model
    )
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
  }
}
