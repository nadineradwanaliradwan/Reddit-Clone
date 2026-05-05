import { apiRequest } from '@/api/client'

// ─── Backend response shapes ────────────────────────────────────────────────
// All come back wrapped in `{ success: true, data: {...} }` per chatController.

export interface ChatUser {
  _id: string
  username: string
}

export interface ChatLastMessage {
  _id: string
  body: string
  sender: string
  createdAt: string
  isDeleted?: boolean
}

export interface ChatConversation {
  _id: string
  participants: ChatUser[]
  // Set client-side from `participants` minus the current user. Backend already
  // populates this on `GET /conversations`, but `POST /conversations` doesn't,
  // so we compute it where missing.
  partner?: ChatUser
  lastMessage?: ChatLastMessage | null
  lastMessageAt?: string
  unreadCount?: number
}

export interface ChatMessage {
  _id: string
  conversation: string
  sender: ChatUser | string
  body: string
  createdAt: string
  isDeleted?: boolean
  readBy?: string[]
}

// ─── REST API ────────────────────────────────────────────────────────────────

export const chatService = {
  /** List the current user's conversations, sorted by last activity. */
  listConversations: async (): Promise<ChatConversation[]> => {
    const data = await apiRequest<{
      success: boolean
      data: { conversations: ChatConversation[] }
    }>('/reddit/chat/conversations')
    return data.data.conversations
  },

  /** Open (or create) a 1:1 conversation with the given user id. */
  startConversation: async (userId: string): Promise<ChatConversation> => {
    const data = await apiRequest<{
      success: boolean
      data: { conversation: ChatConversation }
    }>('/reddit/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    return data.data.conversation
  },

  /** Page back through a conversation's messages (oldest → newest within the page). */
  listMessages: async (
    conversationId: string,
    page = 1,
    limit = 30,
  ): Promise<ChatMessage[]> => {
    const data = await apiRequest<{
      success: boolean
      data: { messages: ChatMessage[] }
    }>(`/reddit/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`)
    return data.data.messages
  },

  /** Soft-delete one of your own messages. */
  deleteMessage: async (messageId: string) => {
    return apiRequest(`/reddit/chat/messages/${messageId}`, { method: 'DELETE' })
  },

  /** Total unread messages across all conversations — for navbar badge. */
  unreadCount: async (): Promise<number> => {
    const data = await apiRequest<{
      success: boolean
      data: { unreadCount: number }
    }>('/reddit/chat/unread-count')
    return data.data.unreadCount
  },
}
