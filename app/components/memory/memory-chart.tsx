"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { MemoryStats } from "@/lib/memory/types"

interface MemoryChartProps {
  stats: MemoryStats
}

const chartConfig = {
  auto: {
    label: "Auto Memories",
    color: "var(--chart-2)",
  },
  explicit: {
    label: "Explicit Memories",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function MemoryChart({ stats }: MemoryChartProps) {
  // Create mock time-series data for visualization
  const chartData = React.useMemo(() => {
    const data = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      data.push({
        date: date.toISOString().split("T")[0],
        auto: Math.floor(Math.random() * stats.auto_memories),
        explicit: Math.floor(Math.random() * stats.explicit_memories),
      })
    }
    return data
  }, [stats.auto_memories, stats.explicit_memories])

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col justify-center gap-1 px-6 py-5">
        <CardTitle>Memory Distribution</CardTitle>
        <CardDescription>
          Auto-extracted vs manually added memories
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: any) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  labelFormatter={(value: any) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                />
              }
            />
            <Bar dataKey="auto" fill="var(--color-auto)" />
            <Bar dataKey="explicit" fill="var(--color-explicit)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
