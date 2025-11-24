"use client"

import { useState, useEffect, useMemo } from "react"
import { useMemory } from "@/lib/memory-store"
import { MemoryCard } from "./memory-card"
import { MemoryForm } from "./memory-form"
import { MemoryStats } from "./memory-stats"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, MagnifyingGlass, ArrowClockwise } from "@phosphor-icons/react"

export function MemoryList() {
  const { memories, stats, isLoading, searchMemories, refresh } = useMemory()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [semanticResults, setSemanticResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Immediate local filtering for instant feedback
  const localFilteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories

    const query = searchQuery.toLowerCase()
    return memories.filter((memory) =>
      memory.content.toLowerCase().includes(query)
    )
  }, [memories, searchQuery])

  // Debounced semantic search using API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSemanticResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchMemories(searchQuery, { limit: 20 })
        setSemanticResults(results)
      } catch (error) {
        console.error("Semantic search failed:", error)
        // Fall back to local results on error
        setSemanticResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchMemories])

  // Show semantic results if available, otherwise local filtered results
  const displayedMemories = semanticResults.length > 0 ? semanticResults : localFilteredMemories

  const handleClearSearch = () => {
    setSearchQuery("")
    setSemanticResults([])
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading memories...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stats */}
      {stats && <MemoryStats stats={stats} />}

      {/* Search and Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        {searchQuery && (
          <Button onClick={handleClearSearch} variant="ghost" size="sm">
            Clear
          </Button>
        )}
        <Button
          onClick={handleRefresh}
          variant="ghost"
          size="sm"
          disabled={isRefreshing}
          title="Refresh memories"
        >
          <ArrowClockwise className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Memory
        </Button>
      </div>

      {/* Memory List */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {displayedMemories.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="text-muted-foreground">
              {searchQuery
                ? "No memories found matching your search."
                : "No memories yet. The AI will automatically save important facts as you chat."}
            </div>
          </div>
        )}

        {displayedMemories.map((memory) => (
          <MemoryCard key={memory.id} memory={memory} />
        ))}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && <MemoryForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
