"use client"

import { useState } from "react"
import { useMemory } from "@/lib/memory-store"
import type { UserMemory } from "@/lib/memory/types"
import { Button } from "@/components/ui/button"
import { Trash, Sparkle, Brain } from "@phosphor-icons/react"
import { formatDistanceToNow } from "date-fns"

interface MemoryCardProps {
  memory: UserMemory
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const { deleteMemory } = useMemory()
  const [isDeleting, setIsDeleting] = useState(false)

  const metadata = memory.metadata as any
  const category = metadata?.category || "general"
  const tags = metadata?.tags || []
  const isExplicit = memory.memory_type === "explicit"

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this memory?")) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteMemory(memory.id)
    } catch (error) {
      console.error("Failed to delete memory:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const importanceColor =
    memory.importance_score >= 0.8
      ? "text-green-600 dark:text-green-400"
      : memory.importance_score >= 0.5
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-gray-600 dark:text-gray-400"

  return (
    <div className="group relative rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isExplicit ? (
            <Sparkle className="h-4 w-4 text-purple-500" weight="fill" />
          ) : (
            <Brain className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-xs font-medium text-muted-foreground capitalize">
            {category.replace("_", " ")}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Content */}
      <p className="mb-3 text-sm">{memory.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag: string) => (
            <span
              key={tag}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className={importanceColor}>
            {Math.round(memory.importance_score * 100)}% important
          </span>
          <span>
            {memory.last_accessed_at
              ? `Accessed ${formatDistanceToNow(new Date(memory.last_accessed_at), { addSuffix: true })}`
              : `Created ${formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })}`}
          </span>
        </div>
      </div>
    </div>
  )
}
