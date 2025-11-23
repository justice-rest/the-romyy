"use client"

import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import { APP_NAME } from "@/lib/config"
import { ArrowUpRight } from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"

export function PopoverContentUpgradeRequired() {
  return (
    <PopoverContent
      className="w-[300px] overflow-hidden rounded-xl p-0"
      side="top"
      align="start"
    >
      <Image
        src="/banner_forest.jpg"
        alt={`calm paint generate by ${APP_NAME}`}
        width={300}
        height={128}
        className="h-32 w-full object-cover"
      />
      <div className="p-3">
        <p className="text-primary mb-1 text-base font-medium">
          Upgrade to use Rōmy
        </p>
        <p className="text-muted-foreground mb-5 text-base">
          Subscribe to start chatting with AI models and unlock all features.
        </p>
        <Link href="/subscription" className="block w-full">
          <Button
            variant="secondary"
            className="group w-full text-base"
            size="lg"
          >
            <span>View Plans</span>
            <ArrowUpRight className="ml-2 h-4 w-4 rotate-45 transition-transform duration-300 group-hover:rotate-90" weight="bold" />
          </Button>
        </Link>
      </div>
    </PopoverContent>
  )
}
