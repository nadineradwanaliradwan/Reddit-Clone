import { apiRequest } from '@/api/client'
import { type Post, type SubredditInfo, type Comment, type Notification } from '@/lib/mock-data'
import { formatDistanceToNow } from 'date-fns'

const mapBackendPost = (p: any): Post => ({
  id: p._id,
  title: p.title,
  content: p.body || p.url || p.imageUrl || '',
  author: p.author?.username || 'unknown',
  subreddit: p.community?.name || 'unknown',
  votes: p.score || 0,
  commentCount: 0, // Backend doesn't provide this yet
  timestamp: p.createdAt ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }) : 'unknown',
  imageUrl: p.imageUrl,
  comments: [],
})

const mapBackendComment = (c: any): Comment => ({
  id: c._id,
  author: c.author?.username || 'unknown',
  content: c.body,
  timestamp: c.createdAt ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true }) : 'unknown',
  votes: 0, // Backend doesn't have comment voting yet
  replies: [], // Replies need to be nested manually if returned flat
})

const nestComments = (flatComments: any[]): Comment[] => {
  const commentMap = new Map<string, Comment>()
  const roots: Comment[] = []

  flatComments.forEach((c) => {
    const mapped = mapBackendComment(c)
    commentMap.set(mapped.id, mapped)
  })

  flatComments.forEach((c) => {
    const mapped = commentMap.get(c._id)!
    if (c.parent && commentMap.has(c.parent)) {
      const parent = commentMap.get(c.parent)!
      parent.replies = parent.replies || []
      parent.replies.push(mapped)
    } else {
      roots.push(mapped)
    }
  })

  return roots
}

export const redditService = {
  getFeed: async () => {
    const data = await apiRequest<{ success: boolean; posts: any[] }>('/reddit/posts/feed?scope=popular')
    return data.posts.map(mapBackendPost)
  },
  getPopular: async () => {
    const data = await apiRequest<{ success: boolean; posts: any[] }>('/reddit/posts/feed?scope=popular')
    return data.posts.map(mapBackendPost)
  },
  getPostById: async (id: string) => {
    const [postData, commentData] = await Promise.all([
      apiRequest<{ success: boolean; post: any }>(`/reddit/posts/${id}`),
      apiRequest<{ success: boolean; comments: any[] }>(`/reddit/posts/${id}/comments`)
    ])
    
    const post = mapBackendPost(postData.post)
    post.comments = nestComments(commentData.comments)
    post.commentCount = commentData.comments.length
    return post
  },
  getSubreddits: async () => {
    // Backend searchCommunities requires a non-empty query. 
    // Using '_' as a common character to return a majority of communities as a workaround.
    const data = await apiRequest<{ success: boolean; communities: any[] }>('/reddit/search/communities?q=_')
    return data.communities.map((s: any) => ({
      name: s.name,
      description: s.description,
      subscribers: s.memberCount.toString(),
      online: 0,
      icon: s.icon || 'Hash',
      createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'unknown',
    }))
  },
  getSubreddit: async (name: string) => {
    const data = await apiRequest<{ success: boolean; community: any }>(`/reddit/communities/${name}`)
    const s = data.community
    return {
      name: s.name,
      description: s.description,
      subscribers: s.memberCount.toString(),
      online: 0,
      icon: s.icon || 'Hash',
      createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'unknown',
    } as SubredditInfo
  },
  createCommunity: async (data: any) => {
    return await apiRequest<{ success: boolean; community: any }>('/reddit/communities', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateProfile: async (data: { username?: string; email?: string }) => {
    return await apiRequest<{ success: boolean; user: any }>('/reddit/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
  getPostsBySubreddit: async (subreddit: string) => {
    const data = await apiRequest<{ success: boolean; posts: any[] }>(`/reddit/posts/community/${subreddit}`)
    return data.posts.map(mapBackendPost)
  },
  getPostsByUser: async (username: string): Promise<Post[]> => {
    // Backend doesn't have a direct "posts by user" route yet.
    // Recommended in backend-recommendations.md
    return []
  },
  searchPostsAndSubs: async (query: string): Promise<{ posts: Post[]; communities: any[]; users: any[] }> => {
    const [communityData, userData] = await Promise.all([
      apiRequest<{ success: boolean; communities: any[] }>(`/reddit/search/communities?q=${query}`),
      apiRequest<{ success: boolean; users: any[] }>(`/reddit/search/users?q=${query}`)
    ])
    
    return {
      posts: [], // Search only supports communities and users for now
      communities: communityData.communities.map((s: any) => ({
        name: s.name,
        description: s.description,
        subscribers: s.memberCount.toString(),
        icon: s.icon || 'Hash',
      })),
      users: userData.users.map((u: any) => ({
        id: u._id,
        username: u.username,
        avatar: `https://picsum.photos/seed/${u.username}/100/100`
      }))
    }
  },
  getNotifications: async () => {
    const data = await apiRequest<{ success: boolean; notifications: any[] }>('/reddit/notifications')
    return data.notifications.map((n) => ({
      ...n,
      createdAt: formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
    })) as Notification[]
  },
  getUnreadCount: async () => {
    const data = await apiRequest<{ success: boolean; count: number }>('/reddit/notifications/unread-count')
    return data.count
  },
  markNotificationRead: async (id: string) => {
    await apiRequest(`/reddit/notifications/${id}/read`, { method: 'PATCH' })
  },
  markAllNotificationsRead: async () => {
    await apiRequest('/reddit/notifications/read-all', { method: 'PATCH' })
  },
  deleteNotification: async (id: string) => {
    await apiRequest(`/reddit/notifications/${id}`, { method: 'DELETE' })
  },
  summarizeComments: async (comments: Post['comments'], postId?: string) => {
    if (!postId) return 'Cannot summarize without a post ID.'
    try {
      const data = await apiRequest<{ success: boolean; summary: string }>(`/reddit/posts/${postId}/summarize`, {
        method: 'POST'
      })
      return data.summary
    } catch (err: any) {
      return `AI Summarization failed: ${err.message}`
    }
  },
}
