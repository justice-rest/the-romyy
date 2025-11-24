"use client"

import type { MemoryStats } from "@/lib/memory/types"
import { Brain, Sparkle, ChartBar } from "@phosphor-icons/react"

interface MemoryStatsProps {
  stats: MemoryStats
}

export function MemoryStats({ stats }: MemoryStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Brain className="h-4 w-4" />
          <span className="text-xs font-medium">Total Memories</span>
        </div>
        <div className="mt-2 text-2xl font-bold">{stats.total_memories}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {stats.auto_memories} auto • {stats.explicit_memories} explicit
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ChartBar className="h-4 w-4" />
          <span className="text-xs font-medium">Avg. Importance</span>
        </div>
        <div className="mt-2 text-2xl font-bold">
          {Math.round(stats.avg_importance * 100)}%
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Quality score</div>
      </div>

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
