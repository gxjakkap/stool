import { useChat } from '@/lib/ws'
import { ChatList } from '@/components/ChatList'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { Button } from '@/components/ui/button'
import { Trash2, MessageSquare } from 'lucide-react'

export default function Chat() {
  const { messages, connected, clearMessages } = useChat()

  return (
    <div className="flex h-screen flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h1 className="text-sm font-semibold">Chat</h1>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {messages.length} {messages.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionStatus connected={connected} />
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            title="Clear messages"
            aria-label="Clear all messages"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Chat content */}
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MessageSquare className="h-12 w-12 text-[hsl(var(--muted-foreground)/0.3)]" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
              No messages yet
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground)/0.6)]">
              Waiting for chat activity...
            </p>
          </div>
        </div>
      ) : (
        <ChatList messages={messages} className="flex-1 py-2" />
      )}
    </div>
  )
}
