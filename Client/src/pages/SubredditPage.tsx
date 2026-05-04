import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSubredditPostsQuery, useSubredditQuery, useJoinCommunityMutation, useLeaveCommunityMutation } from '@/hooks/use-reddit-query'
import { PostCard } from '@/components/feed/PostCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'

export function SubredditPage() {
  const { subreddit = '' } = useParams()
  const { data: info } = useSubredditQuery(subreddit)
  const { data: posts = [] } = useSubredditPostsQuery(subreddit)
  const { user } = useAuth()
  const { toast } = useToast()

  // localOverride: null = not yet acted on (use server value), true/false = user acted
  const [localOverride, setLocalOverride] = useState<boolean | null>(null)
  const isMember = localOverride !== null ? localOverride : (info?.isMember ?? null)

  const joinMutation = useJoinCommunityMutation()
  const leaveMutation = useLeaveCommunityMutation()

  const handleJoin = async () => {
    if (!user) { toast({ variant: 'destructive', title: 'Sign in to join communities' }); return }
    setLocalOverride(true)
    try {
      await joinMutation.mutateAsync(subreddit)
      toast({ title: `Joined r/${subreddit}` })
    } catch (err: any) {
      // If backend says "already a member" the join state is still true
      if (err.message?.toLowerCase().includes('already a member')) return
      setLocalOverride(false)
      toast({ variant: 'destructive', title: err.message || 'Failed to join' })
    }
  }

  const handleLeave = async () => {
    setLocalOverride(false)
    try {
      await leaveMutation.mutateAsync(subreddit)
      toast({ title: `Left r/${subreddit}` })
    } catch (err: any) {
      setLocalOverride(true)
      toast({ variant: 'destructive', title: err.message || 'Failed to leave' })
    }
  }

  if (!info) return <p className="text-muted-foreground">Community not found.</p>

  const isPending = joinMutation.isPending || leaveMutation.isPending

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">r/{info.name}</h1>
          <p className="text-sm text-muted-foreground">{info.description}</p>
          <p className="text-xs text-muted-foreground mt-1">{info.subscribers} members</p>
        </div>
        {isMember === true ? (
          <Button variant="outline" size="sm" onClick={handleLeave} disabled={isPending}>
            {leaveMutation.isPending ? 'Leaving…' : 'Joined'}
          </Button>
        ) : (
          <Button size="sm" onClick={handleJoin} disabled={isPending}>
            {joinMutation.isPending ? 'Joining…' : 'Join'}
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {posts.length
          ? posts.map((post) => <PostCard key={post.id} post={post} />)
          : <p className="text-muted-foreground">No posts yet.</p>}
      </div>
    </div>
  )
}
