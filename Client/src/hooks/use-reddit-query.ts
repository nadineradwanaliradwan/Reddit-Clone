import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { redditService } from '@/api/reddit-service'
import { useAuth } from '@/context/auth-context'

export const useFeedQuery = () => {
  const { user, isLoading: authLoading } = useAuth()
  const scope = user ? 'home' : 'popular'
  return useQuery({
    queryKey: ['feed', scope],
    queryFn: () => redditService.getFeed(scope),
    enabled: !authLoading,
  })
}
export const usePopularQuery = () => useQuery({ queryKey: ['popular'], queryFn: redditService.getPopular })
export const usePostQuery = (id: string) => useQuery({ queryKey: ['post', id], queryFn: () => redditService.getPostById(id) })
export const useSubredditsQuery = () => useQuery({ queryKey: ['subreddits'], queryFn: redditService.getSubreddits })
export const useSubredditQuery = (name: string) => useQuery({ queryKey: ['subreddit', name], queryFn: () => redditService.getSubreddit(name) })
export const useSubredditPostsQuery = (name: string) => useQuery({ queryKey: ['subreddit-posts', name], queryFn: () => redditService.getPostsBySubreddit(name) })
export const useUserPostsQuery = (username: string) => useQuery({ queryKey: ['user-posts', username], queryFn: () => redditService.getPostsByUser(username) })
export const useSearchQuery = (query: string) => useQuery({ queryKey: ['search', query], queryFn: () => redditService.searchPostsAndSubs(query) })
export const useSavedPostsQuery = (enabled = true) => useQuery({ queryKey: ['saved-posts'], queryFn: redditService.getSavedPosts, enabled })
export const useUserProfileQuery = (username: string) => useQuery({ queryKey: ['user-profile', username], queryFn: () => redditService.getUserProfile(username) })

export const useNotificationsQuery = () => useQuery({ 
  queryKey: ['notifications'], 
  queryFn: redditService.getNotifications 
})

export const useUnreadCountQuery = () => useQuery({ 
  queryKey: ['notifications-unread'], 
  queryFn: redditService.getUnreadCount 
})

export const useMarkNotificationReadMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redditService.markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}

export const useMarkAllReadMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redditService.markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}

export const useDeleteNotificationMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redditService.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })
}

export const useJoinCommunityMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redditService.joinCommunity,
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['subreddit', name] })
      queryClient.invalidateQueries({ queryKey: ['subreddits'] })
    },
  })
}

export const useLeaveCommunityMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redditService.leaveCommunity,
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['subreddit', name] })
      queryClient.invalidateQueries({ queryKey: ['subreddits'] })
    },
  })
}

export const useCreateCommentMutation = (postId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => redditService.createComment(postId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
    },
  })
}

export const useCreateReplyMutation = (postId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      redditService.createReply(commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
    },
  })
}

export const useDeletePostMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: redditService.deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['popular'] })
    },
  })
}

export const useFollowUserMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => redditService.followUser(username),
    onSuccess: (_data, username) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', username] })
    },
  })
}

export const useUnfollowUserMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => redditService.unfollowUser(username),
    onSuccess: (_data, username) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', username] })
    },
  })
}

export const useSavePostMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => redditService.savePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

export const useUnsavePostMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => redditService.unsavePost(postId),
    onSuccess: (_data, postId) => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}
