import { getSources } from "@/app/components/chat/get-sources"
import { Reasoning } from "@/app/components/chat/reasoning"
import { SearchImages } from "@/app/components/chat/search-images"
import { SourcesList } from "@/app/components/chat/sources-list"
import { ToolInvocation } from "@/app/components/chat/tool-invocation"
import type { Tables } from "@/app/types/database.types"
import { Message, MessageContent } from "@/components/prompt-kit/message"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Message as MessageAISDK } from "@ai-sdk/react"
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr"
import Link from "next/link"
import { Header } from "./header"

type MessageType = Tables<"messages">

type ArticleProps = {
  date: string
  title: string
  subtitle: string
  messages: MessageType[]
}

export default function Article({
  date,
  title,
  subtitle,
  messages,
}: ArticleProps) {
  return (
    <>
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-24">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <time
            dateTime={new Date(date).toISOString().split("T")[0]}
            className="text-foreground"
          >
            {new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </div>

        <h1 className="mb-4 text-center text-4xl font-medium tracking-tight md:text-5xl">
          {title}
        </h1>

        <p className="text-foreground mb-8 text-center text-lg">{subtitle}</p>

        <div className="fixed bottom-6 left-0 z-50 flex w-full justify-center">
          <Link href="/">
            <Button
              variant="outline"
              className="text-muted-foreground group flex h-12 w-full max-w-36 items-center justify-between rounded-full py-2 pr-2 pl-4 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Ask Rōmy{" "}
              <div className="rounded-full bg-black/20 p-2 backdrop-blur-sm transition-colors group-hover:bg-black/30">
                <ArrowUpRight className="h-4 w-4 text-white" />
              </div>
            </Button>
          </Link>
        </div>
        <div className="mt-20 w-full">
          {messages.map((message) => {
            const parts = message?.parts as MessageAISDK["parts"]
            const sources = getSources(parts)

            // Extract different types of parts for proper rendering
            const toolInvocationParts = parts?.filter(
              (part) => part.type === "tool-invocation"
            )
            const reasoningParts = parts?.find((part) => part.type === "reasoning")
            const searchImageResults =
              parts
                ?.filter(
                  (part) =>
                    part.type === "tool-invocation" &&
                    part.toolInvocation?.state === "result" &&
                    part.toolInvocation?.toolName === "imageSearch" &&
                    part.toolInvocation?.result?.content?.[0]?.type === "images"
                )
                .flatMap((part) =>
                  part.type === "tool-invocation" &&
                  part.toolInvocation?.state === "result" &&
                  part.toolInvocation?.toolName === "imageSearch" &&
                  part.toolInvocation?.result?.content?.[0]?.type === "images"
                    ? (part.toolInvocation?.result?.content?.[0]?.results ?? [])
                    : []
                ) ?? []

            const contentNullOrEmpty = !message.content || message.content === ""

            return (
              <div key={message.id} className="mb-8">
                <Message
                  className={cn(
                    "mb-4 flex flex-col gap-0",
                    message.role === "assistant" && "w-full items-start",
                    message.role === "user" && "w-full items-end"
                  )}
                >
                  <div className="flex min-w-full flex-col gap-2">
                    {/* Render reasoning for assistant messages */}
                    {message.role === "assistant" && reasoningParts && reasoningParts.reasoning && (
                      <Reasoning
                        reasoning={reasoningParts.reasoning}
                        isStreaming={false}
                      />
                    )}

                    {/* Render tool invocations for assistant messages - always show in share view */}
                    {message.role === "assistant" &&
                      toolInvocationParts &&
                      toolInvocationParts.length > 0 && (
                        <ToolInvocation toolInvocations={toolInvocationParts} />
                      )}

                    {/* Render search images for assistant messages */}
                    {message.role === "assistant" && searchImageResults.length > 0 && (
                      <SearchImages results={searchImageResults} />
                    )}

                    {/* Render message content if not empty */}
                    {!contentNullOrEmpty && (
                      <MessageContent
                        markdown={true}
                        className={cn(
                          message.role === "user" && "bg-blue-600 text-white",
                          message.role === "assistant" &&
                            "prose dark:prose-invert w-full min-w-full bg-transparent",
                          "prose-h1:scroll-m-20 prose-h1:text-2xl prose-h1:font-semibold prose-h2:mt-8 prose-h2:scroll-m-20 prose-h2:text-xl prose-h2:mb-3 prose-h2:font-medium prose-h3:scroll-m-20 prose-h3:text-base prose-h3:font-medium prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-strong:font-medium prose-table:block prose-table:overflow-y-auto"
                        )}
                      >
                        {message.content!}
                      </MessageContent>
                    )}

                    {/* Render sources for assistant messages */}
                    {message.role === "assistant" && sources && sources.length > 0 && (
                      <SourcesList sources={sources} />
                    )}
                  </div>
                </Message>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
