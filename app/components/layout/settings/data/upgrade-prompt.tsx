"use client"

import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import { ArrowUpRight } from "@phosphor-icons/react"
import Image from "next/image"
import { useRouter } from "next/navigation"

export function UpgradePrompt() {
  const router = useRouter()

  return (
    <PopoverContent
      className="w-[300px] overflow-hidden rounded-xl p-0"
      side="top"
      align="start"
    >
      <Image
        src="/banner_forest.jpg"
        alt="upgrade to ultra"
        width={300}
        height={128}
        className="h-32 w-full object-cover"
      />
      <div className="p-3">
        <p className="text-primary mb-1 text-base font-medium">
          Scale Plan Required
        </p>
        <p className="text-muted-foreground mb-5 text-base">
          Upload and search your own documents with AI-powered RAG. Unlock
          unlimited potential with fundraising insights from your data.
        </p>
        <Button
          onClick={() => router.push("/subscription")}
          variant="secondary"
          className="group w-full text-base"
          size="lg"
        >
          <span>Upgrade to Scale</span>
          <ArrowUpRight className="ml-2 h-4 w-4 rotate-45 transition-transform duration-300 group-hover:rotate-90" weight="bold" />
        </Button>
      </div>
    </PopoverContent>
  )
}
