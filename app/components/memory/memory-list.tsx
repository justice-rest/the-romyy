"use client"

import { useState } from "react"
import { useMemory } from "@/lib/memory-store"
import { MemoryCard } from "./memory-card"
import { MemoryForm } from "./memory-form"
import { MemoryStats } from "./memory-stats"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search } from "@phosphor-icons/react"

export function MemoryList() {
  const { memories, stats, isLoading, searchMemories } = useMemory()
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const displayedMemories = searchResults.length > 0 ? searchResults : memories

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchMemories(searchQuery, { limit: 20 })
      setSearchResults(results)
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery("")
    setSearchResults([])
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch()
              }
            }}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching} variant="outline">
          {isSearching ? "Searching..." : "Search"}
        </Button>
        {searchResults.length > 0 && (
          <Button onClick={handleClearSearch} variant="ghost">
            Clear
          </Button>
        )}
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
              {searchResults.length === 0 && searchQuery
                ? "No memories found matching your search."
                : "No memories yet. The AI will automatically save important facts as you chat."}
            </div>
            {!searchQuery && (
              <Button onClick={() => setShowForm(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Memory
              </Button>
            )}
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
