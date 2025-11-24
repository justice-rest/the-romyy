"use client"

import type { MemoryStats } from "@/lib/memory/types"
import { Sparkle } from "@phosphor-icons/react"
import { MemoryChart } from "./memory-chart"

interface MemoryStatsProps {
  stats: MemoryStats
}

export function MemoryStats({ stats }: MemoryStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <MemoryChart stats={stats} />

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkle className="h-4 w-4" />
          <span className="text-xs font-medium">Most Recent</span>
        </div>
        <div className="mt-2 text-sm font-medium">
          {stats.most_recent_memory
            ? new Date(stats.most_recent_memory).toLocaleDateString()
            : "None yet"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Last saved</div>
      </div>
    </div>
  )
}
