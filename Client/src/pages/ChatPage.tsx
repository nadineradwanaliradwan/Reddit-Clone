import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Send, Loader2, MessageSquarePlus, Search, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { useSocket } from '@/context/socket-context'
import { chatService, type ChatConversation, type ChatMessage } from '@/api/chat-service'
import { redditService } from '@/api/reddit-service'
import { cn } from '@/lib/utils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the OTHER participant's username, regardless of whether the
 *  backend already provided a `partner` field. */
function partnerOf(conv: ChatConversation, meId: string) {
  if (conv.partner) return conv.partner
  return conv.participants.find((p) => p._id !== meId)
}

function senderId(msg: ChatMessage): string {
  return typeof msg.sender === 'string' ? msg.sender : msg.sender._id
}

function senderName(msg: ChatMessage): string {
  return typeof msg.sender === 'string' ? '' : msg.sender.username
}

// ─── New Conversation dialog (search a user → start chat) ───────────────────

function NewConversationDialog({ onStarted }: { onStarted: (conv: ChatConversation) => void }) {
  const { toast } = useToast()
  const { user: me } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; username: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)

  // Debounced search through the existing /reddit/search/users endpoint.
  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await redditService.searchPostsAndSubs(query.trim())
        // Filter out yourself — you can't start a conversation with yourself.
        setResults(data.users.filter((u) => u.username !== me?.username))
      } catch (err: any) {
        toast({ variant: 'destructive', title: err.message || 'Search failed' })
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open, me?.username, toast])

  const handleStart = async (userId: string) => {
    setStarting(userId)
    try {
      const conv = await chatService.startConversation(userId)
      onStarted(conv)
      setOpen(false)
      setQuery('')
      setResults([])
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Could not start conversation' })
    } finally {
      setStarting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <MessageSquarePlus className="h-4 w-4" /> New
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search users by username..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="min-h-[8rem] max-h-[16rem] overflow-y-auto space-y-2">
            {searching ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {query.trim() ? 'No users found.' : 'Start typing to find users.'}
              </p>
            ) : (
              results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-left"
                  onClick={() => handleStart(u.id)}
                  disabled={!!starting}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://picsum.photos/seed/${u.username}/100/100`} />
                      <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">u/{u.username}</span>
                  </div>
                  {starting === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="text-xs text-primary">Message</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Conversation list (left pane) ──────────────────────────────────────────

function ConversationList({
  activeId,
  conversations,
  isLoading,
  meId,
}: {
  activeId?: string
  conversations: ChatConversation[]
  isLoading: boolean
  meId: string
}) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 px-3">
        No conversations yet. Click <strong>New</strong> to start one.
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {conversations.map((conv) => {
        const partner = partnerOf(conv, meId)
        const last = conv.lastMessage
        const lastBody = last?.isDeleted ? '[deleted]' : last?.body || 'No messages yet'
        const lastTime = conv.lastMessageAt
          ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })
          : ''
        const isActive = conv._id === activeId

        return (
          <li key={conv._id}>
            <button
              type="button"
              className={cn(
                'w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors',
                isActive && 'bg-primary/5',
              )}
              onClick={() => navigate(`/chat/${conv._id}`)}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={`https://picsum.photos/seed/${partner?.username}/100/100`} />
                <AvatarFallback>{partner?.username[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold truncate">u/{partner?.username || 'unknown'}</p>
                  {!!conv.unreadCount && conv.unreadCount > 0 && (
                    <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5 shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{lastBody}</p>
                {lastTime && <p className="text-xs text-muted-foreground">{lastTime}</p>}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Message thread (right pane) ────────────────────────────────────────────

function MessageThread({
  conversation,
  meId,
}: {
  conversation: ChatConversation
  meId: string
}) {
  const { socket, isConnected } = useSocket()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [partnerTyping, setPartnerTyping] = useState(false)
  const typingTimeoutRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const partner = partnerOf(conversation, meId)

  // Initial message load — useQuery so React Query handles caching/invalidation.
  const { data: serverMessages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', conversation._id],
    queryFn: () => chatService.listMessages(conversation._id),
  })

  // Local queue of messages received via the socket on top of the server fetch.
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([])

  // Whenever the server fetch refreshes (e.g. opened conversation, refetch),
  // reset the live queue — those messages are already in `serverMessages`.
  useEffect(() => {
    setLiveMessages([])
  }, [conversation._id, serverMessages])

  // Combined, de-duped, sorted view.
  const messages = useMemo(() => {
    const seen = new Set<string>()
    const merged: ChatMessage[] = []
    for (const m of [...serverMessages, ...liveMessages]) {
      if (seen.has(m._id)) continue
      seen.add(m._id)
      merged.push(m)
    }
    merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return merged
  }, [serverMessages, liveMessages])

  // Scroll to bottom whenever messages change.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  // Wire socket: join room, listen for new messages, typing, deletes, mark read.
  useEffect(() => {
    if (!socket || !isConnected) return

    socket.emit('chat:join', { conversationId: conversation._id })
    socket.emit('chat:read', { conversationId: conversation._id })

    const onMessage = ({ message }: { message: ChatMessage }) => {
      if (message.conversation !== conversation._id) return
      setLiveMessages((prev) => [...prev, message])
      // Mark as read since the user is staring at the thread.
      socket.emit('chat:read', { conversationId: conversation._id })
      // Bump the conversation list so the preview/order updates.
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] })
    }
    const onTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      if (userId === meId) return
      setPartnerTyping(isTyping)
    }
    const onDelete = ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      if (conversationId !== conversation._id) return
      // Mark as deleted in both the server cache and the live buffer.
      const markDeleted = (msgs: ChatMessage[]) =>
        msgs.map((m) => (m._id === messageId ? { ...m, body: '[deleted]', isDeleted: true } : m))
      queryClient.setQueryData(['chat-messages', conversation._id], (old: ChatMessage[] = []) =>
        markDeleted(old),
      )
      setLiveMessages((prev) => markDeleted(prev))
    }

    socket.on('chat:message', onMessage)
    socket.on('chat:typing', onTyping)
    socket.on('chat:message:delete', onDelete)

    return () => {
      socket.off('chat:message', onMessage)
      socket.off('chat:typing', onTyping)
      socket.off('chat:message:delete', onDelete)
    }
  }, [socket, isConnected, conversation._id, meId, queryClient])

  const sendTyping = (isTyping: boolean) => {
    socket?.emit('chat:typing', { conversationId: conversation._id, isTyping })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value)
    sendTyping(true)
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = window.setTimeout(() => sendTyping(false), 1500)
  }

  const handleSend = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    if (!socket || !isConnected) {
      toast({
        variant: 'destructive',
        title: 'Not connected',
        description: 'Reconnect to chat and try again.',
      })
      return
    }
    socket.emit('chat:message', { conversationId: conversation._id, body: trimmed })
    setBody('')
    sendTyping(false)
  }

  const handleDelete = async (messageId: string) => {
    try {
      await chatService.deleteMessage(messageId)
      // The server will broadcast `chat:message:delete`, which the listener
      // above will handle. Nothing more to do here.
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Could not delete message' })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <Link to="/chat" className="md:hidden">
          <Button variant="ghost" size="icon" aria-label="Back to conversations">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Avatar className="h-9 w-9">
          <AvatarImage src={`https://picsum.photos/seed/${partner?.username}/100/100`} />
          <AvatarFallback>{partner?.username[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Link
            to={`/u/${partner?.username}`}
            className="font-semibold hover:text-primary transition-colors block truncate"
          >
            u/{partner?.username || 'unknown'}
          </Link>
          <p className="text-xs text-muted-foreground">
            {isConnected ? (partnerTyping ? 'typing…' : 'online') : 'connecting…'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        <div ref={scrollRef} className="py-4 space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Say hi 👋
            </p>
          ) : (
            messages.map((msg) => {
              const mine = senderId(msg) === meId
              const time = formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })
              return (
                <div
                  key={msg._id}
                  className={cn('flex gap-2 group', mine ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words',
                      mine
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted rounded-bl-sm',
                      msg.isDeleted && 'italic opacity-70',
                    )}
                  >
                    {!mine && senderName(msg) && (
                      <p className="text-xs font-semibold mb-0.5">{senderName(msg)}</p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.isDeleted ? '[deleted]' : msg.body}</p>
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        mine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {time}
                    </p>
                  </div>
                  {mine && !msg.isDeleted && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity self-center"
                      title="Delete message"
                      onClick={() => handleDelete(msg._id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Write a message…"
            value={body}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            className="resize-none min-h-[40px] max-h-32"
          />
          <Button onClick={handleSend} disabled={!body.trim() || !isConnected} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
          Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line.
        </p>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ChatPage() {
  const { user } = useAuth()
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: chatService.listConversations,
    enabled: !!user,
  })

  const active = useMemo(
    () => conversations.find((c) => c._id === conversationId),
    [conversations, conversationId],
  )

  const handleStarted = (conv: ChatConversation) => {
    // Refresh the list so the new conversation appears, and route to it.
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    navigate(`/chat/${conv._id}`)
  }

  if (!user) return <p className="text-muted-foreground">Sign in to use chat.</p>

  return (
    <div className="-my-6 h-[calc(100vh-3.5rem)] flex border rounded-xl overflow-hidden bg-card">
      {/* Left pane — conversations list. Hidden on mobile when a conversation is open. */}
      <aside
        className={cn(
          'w-full md:w-72 border-r flex flex-col',
          conversationId && 'hidden md:flex',
        )}
      >
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-bold">Chats</h2>
          <NewConversationDialog onStarted={handleStarted} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            activeId={conversationId}
            conversations={conversations}
            isLoading={isLoading}
            meId={user._id}
          />
        </div>
      </aside>

      {/* Right pane — message thread. Empty state on desktop, hidden on mobile if no conversation. */}
      <section className={cn('flex-1', !conversationId && 'hidden md:flex md:items-center md:justify-center')}>
        {active ? (
          <MessageThread conversation={active} meId={user._id} />
        ) : (
          <div className="text-center text-muted-foreground p-8">
            <p className="text-lg font-semibold">Select a conversation</p>
            <p className="text-sm">Or start a new one with the <strong>New</strong> button.</p>
          </div>
        )}
      </section>
    </div>
  )
}
