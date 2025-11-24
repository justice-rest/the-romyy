"use client"

import { useState, useEffect, useMemo } from "react"
import { useMemory } from "@/lib/memory-store"
import { MemoryCard } from "./memory-card"
import { MemoryForm } from "./memory-form"
import { MemoryStats } from "./memory-stats"
import { Input } from "@/components/ui/input"
import { MagnifyingGlass, Plus } from "@phosphor-icons/react"
import { ShimmerButton } from "@/app/components/ui/shimmer-button"

export function MemoryList() {
  const { memories, stats, isLoading, searchMemories } = useMemory()
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-sm text-muted-foreground">Loading memories...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stats */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-500">
        {stats && <MemoryStats stats={stats} />}
      </div>

      {/* Search and Add */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-500 delay-100 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 transition-all focus-visible:ring-2"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </div>
        <ShimmerButton onClick={() => setShowForm(true)} className="h-10">
          <Plus className="h-5 w-5" weight="bold" />
          Add Memory
        </ShimmerButton>
      </div>

      {/* Memory List */}
      <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin pb-6">
        {displayedMemories.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MagnifyingGlass className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground">
                {searchQuery
                  ? "No memories found matching your search."
                  : "No memories yet. The AI will automatically save important facts as you chat."}
              </div>
            </div>
          </div>
        )}

        {displayedMemories.map((memory, index) => (
          <div
            key={memory.id}
            className="animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <MemoryCard memory={memory} />
          </div>
        ))}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && <MemoryForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
