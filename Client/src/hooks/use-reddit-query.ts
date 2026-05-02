import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { redditService } from '@/api/reddit-service'

export const useFeedQuery = () => useQuery({ queryKey: ['feed'], queryFn: redditService.getFeed })
export const usePopularQuery = () => useQuery({ queryKey: ['popular'], queryFn: redditService.getPopular })
export const usePostQuery = (id: string) => useQuery({ queryKey: ['post', id], queryFn: () => redditService.getPostById(id) })
export const useSubredditsQuery = () => useQuery({ queryKey: ['subreddits'], queryFn: redditService.getSubreddits })
export const useSubredditQuery = (name: string) => useQuery({ queryKey: ['subreddit', name], queryFn: () => redditService.getSubreddit(name) })
export const useSubredditPostsQuery = (name: string) => useQuery({ queryKey: ['subreddit-posts', name], queryFn: () => redditService.getPostsBySubreddit(name) })
export const useUserPostsQuery = (username: string) => useQuery({ queryKey: ['user-posts', username], queryFn: () => redditService.getPostsByUser(username) })
export const useSearchQuery = (query: string) => useQuery({ queryKey: ['search', query], queryFn: () => redditService.searchPostsAndSubs(query) })

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
