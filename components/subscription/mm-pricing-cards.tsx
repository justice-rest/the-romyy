"use client"

import React, { useState } from "react"
import { useCustomer, CheckoutDialog } from "autumn-js/react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { PricingSwitch } from "@/components/ui/pricing-switch"

/**
 * Theme-aware MM Pricing Cards Component
 *
 * Based on MM PricingComponent with:
 * - Transparent background (removed bg-[#1a1520])
 * - Light/dark mode support (text-foreground instead of hardcoded colors)
 * - Integrated autumn-js checkout
 */

interface PricingFeatureProps {
  children: React.ReactNode
  dataId?: string
}

const PricingFeature: React.FC<PricingFeatureProps> = ({
  children,
  dataId,
}) => {
  return (
    <li className="mb-4 flex items-center space-x-2" data-id={dataId}>
      <span className="text-xl text-foreground/60">•</span>
      <span className="text-foreground/80">{children}</span>
    </li>
  )
}

interface PricingCardProps {
  title: string
  price: string | number
  period?: string
  features: string[]
  ctaText: string
  ctaVariant: "outline" | "solid"
  badge?: string
  dataId?: string
  onCtaClick?: () => void
  disabled?: boolean
  isLoading?: boolean
}

const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  period,
  features,
  ctaText,
  ctaVariant,
  badge,
  dataId,
  onCtaClick,
  disabled,
  isLoading,
}) => {
  return (
    <div className="flex w-full flex-col px-8 py-12" data-id={dataId}>
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-4xl font-medium text-foreground">{title}</h2>
        {badge && (
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500">
            {badge}
          </span>
        )}
      </div>
      <div className="mb-10">
        <p className="mb-2 text-3xl text-foreground/90">
          ${price}
          {period && (
            <span className="text-lg text-foreground/60">{period}</span>
          )}
        </p>
      </div>
      <ul className="mb-12">
        {features.map((feature, index) => (
          <PricingFeature key={index}>{feature}</PricingFeature>
        ))}
      </ul>
      <div className="mt-auto">
        <button
          onClick={onCtaClick}
          disabled={disabled || isLoading}
          className={cn(
            "w-full rounded-md py-4 text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            ctaVariant === "outline"
              ? "border border-red-600 bg-transparent text-red-500 hover:border-red-700 hover:bg-red-700 hover:text-white"
              : "border border-red-700 bg-red-700 text-white hover:border-red-600 hover:bg-transparent hover:text-red-500"
          )}
        >
          {isLoading ? "Loading..." : ctaText}
        </button>
      </div>
    </div>
  )
}

const PRICING_CONSTANTS = {
  PRICING: {
    pro: { monthly: 29, yearly: 261 },
    max: { monthly: 89, yearly: 801 },
    ultra: { monthly: 200, yearly: 1800 },
  },
  ANNUAL_DISCOUNT: 0.25,
} as const

export function MMPricingCards() {
  const { customer, checkout } = useCustomer()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [isAnnual, setIsAnnual] = useState(false)

  const handleCheckout = async (productId: string) => {
    setIsLoading(productId)
    try {
      await checkout({
        productId: isAnnual ? `${productId}-yearly` : productId,
        dialog: CheckoutDialog,
        successUrl: window.location.origin + "/",
      })
    } catch (error) {
      console.error("Checkout error:", error)
    } finally {
      setIsLoading(null)
    }
  }

  const currentProduct = customer?.products?.[0]?.id

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Billing Period Toggle */}
      <div className="relative z-20 mb-8 flex items-center justify-center gap-2">
        <PricingSwitch checked={isAnnual} onCheckedChange={setIsAnnual} />
        <p className="text-sm text-muted-foreground">Billed Annually</p>
        <Badge className="border border-[#656565] bg-[#3F3F3F] text-white hover:bg-[#3F3F3F]">
          Save 25%
        </Badge>
      </div>

      {/* MM Pricing Component Container - Transparent background */}
      <div className="w-full overflow-hidden rounded-xl" data-id="mm-pricing">
        <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
          <PricingCard
            title="Pro"
            price={
              isAnnual
                ? PRICING_CONSTANTS.PRICING.pro.yearly
                : PRICING_CONSTANTS.PRICING.pro.monthly
            }
            period={isAnnual ? "/year" : "/month"}
            features={[
              "100 messages per month",
              "File uploads",
              "Email support",
            ]}
            ctaText={
              currentProduct === "pro" || currentProduct === "pro-yearly"
                ? "Current Plan"
                : "Get Started"
            }
            ctaVariant="outline"
            onCtaClick={() => handleCheckout("pro")}
            disabled={
              currentProduct === "pro" || currentProduct === "pro-yearly"
            }
            isLoading={isLoading === "pro"}
          />
          <PricingCard
            title="Max"
            price={
              isAnnual
                ? PRICING_CONSTANTS.PRICING.max.yearly
                : PRICING_CONSTANTS.PRICING.max.monthly
            }
            period={isAnnual ? "/year" : "/month"}
            features={[
              "Unlimited messages",
              "Dedicated support",
              "Everything in Pro",
            ]}
            ctaText={
              currentProduct === "max" || currentProduct === "max-yearly"
                ? "Current Plan"
                : "Get Started"
            }
            ctaVariant="solid"
            badge="Popular"
            onCtaClick={() => handleCheckout("max")}
            disabled={
              currentProduct === "max" || currentProduct === "max-yearly"
            }
            isLoading={isLoading === "max"}
          />
          <PricingCard
            title="Ultra"
            price={
              isAnnual
                ? PRICING_CONSTANTS.PRICING.ultra.yearly
                : PRICING_CONSTANTS.PRICING.ultra.monthly
            }
            period={isAnnual ? "/year" : "/month"}
            features={[
              "Everything in Max",
              "Fundraising consultation",
              "Access to all our AI models",
            ]}
            ctaText={
              currentProduct === "ultra" || currentProduct === "ultra-yearly"
                ? "Current Plan"
                : "Get Started"
            }
            ctaVariant="outline"
            onCtaClick={() => handleCheckout("ultra")}
            disabled={
              currentProduct === "ultra" || currentProduct === "ultra-yearly"
            }
            isLoading={isLoading === "ultra"}
          />
        </div>
      </div>
    </div>
  )
}
