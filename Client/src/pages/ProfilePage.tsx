import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUserPostsQuery, useSavedPostsQuery, useUserProfileQuery, useFollowUserMutation, useUnfollowUserMutation } from '@/hooks/use-reddit-query'
import { PostCard } from '@/components/feed/PostCard'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'

export function ProfilePage() {
  const { username = 'guest' } = useParams()
  const { user: me } = useAuth()
  const { toast } = useToast()
  const isOwnProfile = me?.username === username
  const [tab, setTab] = useState<'posts' | 'saved'>('posts')

  const { data: profile } = useUserProfileQuery(username)
  const { data: posts = [], isLoading: postsLoading } = useUserPostsQuery(username)
  const { data: saved = [], isLoading: savedLoading } = useSavedPostsQuery(isOwnProfile)

  const followMutation = useFollowUserMutation()
  const unfollowMutation = useUnfollowUserMutation()
  const [followOverride, setFollowOverride] = useState<boolean | null>(null)
  const isFollowing = followOverride !== null ? followOverride : (profile?.isFollowing || false)

  const handleFollow = async () => {
    if (!me) { toast({ variant: 'destructive', title: 'Sign in to follow users' }); return }
    const next = !isFollowing
    setFollowOverride(next)
    try {
      if (next) await followMutation.mutateAsync(username)
      else await unfollowMutation.mutateAsync(username)
      toast({ title: next ? `Following u/${username}` : `Unfollowed u/${username}` })
    } catch (err: any) {
      if (next && err.message?.toLowerCase().includes('already following')) return
      setFollowOverride(!next)
      toast({ variant: 'destructive', title: err.message || 'Failed to update follow' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={`https://picsum.photos/seed/${username}/100/100`} />
            <AvatarFallback className="text-xl">{username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">u/{username}</h1>
            {profile && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {profile.followerCount} followers · {profile.followingCount} following
              </p>
            )}
          </div>
        </div>
        {!isOwnProfile && (
          <Button
            variant={isFollowing ? 'outline' : 'default'}
            onClick={handleFollow}
            disabled={followMutation.isPending || unfollowMutation.isPending}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <Button
          variant={tab === 'posts' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-b-none"
          onClick={() => setTab('posts')}
        >
          Posts
        </Button>
        {isOwnProfile && (
          <Button
            variant={tab === 'saved' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-b-none"
            onClick={() => setTab('saved')}
          >
            Saved
          </Button>
        )}
      </div>

      {tab === 'posts' && (
        postsLoading
          ? <p className="text-muted-foreground">Loading posts…</p>
          : posts.length
            ? <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
            : <p className="text-muted-foreground">No posts yet.</p>
      )}

      {tab === 'saved' && isOwnProfile && (
        savedLoading
          ? <p className="text-muted-foreground">Loading saved posts…</p>
          : saved.length
            ? <div className="space-y-4">{saved.map((post) => <PostCard key={post.id} post={post} />)}</div>
            : <p className="text-muted-foreground">No saved posts.</p>
      )}
    </div>
  )
}
