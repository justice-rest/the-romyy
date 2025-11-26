"use client"

import { createContext, useContext, useState, useCallback, useMemo } from "react"

interface DragDropState {
  isDragging: boolean
  draggedChatId: string | null
  draggedChatTitle: string | null
}

interface DragDropContextType extends DragDropState {
  startDrag: (chatId: string, title: string) => void
  endDrag: () => void
}

const DragDropContext = createContext<DragDropContextType | null>(null)

export function useDragDrop() {
  const context = useContext(DragDropContext)
  if (!context) {
    throw new Error("useDragDrop must be used within DragDropProvider")
  }
  return context
}

export function DragDropProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    draggedChatId: null,
    draggedChatTitle: null,
  })

  const startDrag = useCallback((chatId: string, title: string) => {
    setState({
      isDragging: true,
      draggedChatId: chatId,
      draggedChatTitle: title,
    })
  }, [])

  const endDrag = useCallback(() => {
    setState({
      isDragging: false,
      draggedChatId: null,
      draggedChatTitle: null,
    })
  }, [])

  const value = useMemo<DragDropContextType>(
    () => ({
      ...state,
      startDrag,
      endDrag,
    }),
    [state, startDrag, endDrag]
  )

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  )
}
