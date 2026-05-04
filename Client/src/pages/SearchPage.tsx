import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useSearchQuery, useFollowUserMutation, useUnfollowUserMutation } from '@/hooks/use-reddit-query'
import { PostCard } from '@/components/feed/PostCard'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Loader2, Search, Hash, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'

function UserResult({ user }: { user: any }) {
  const { user: me } = useAuth()
  const { toast } = useToast()
  const followMutation = useFollowUserMutation()
  const unfollowMutation = useUnfollowUserMutation()
  const [followOverride, setFollowOverride] = useState<boolean | null>(null)
  const isFollowing = followOverride !== null ? followOverride : (user.isFollowing || false)
  const isOwnProfile = me?.username === user.username

  const handleFollow = async () => {
    if (!me) { toast({ variant: 'destructive', title: 'Sign in to follow users' }); return }
    const next = !isFollowing
    setFollowOverride(next)
    try {
      if (next) await followMutation.mutateAsync(user.username)
      else await unfollowMutation.mutateAsync(user.username)
      toast({ title: next ? `Following u/${user.username}` : `Unfollowed u/${user.username}` })
    } catch (err: any) {
      if (next && err.message?.toLowerCase().includes('already following')) return
      setFollowOverride(!next)
      toast({ variant: 'destructive', title: err.message || 'Failed to update follow' })
    }
  }

  return (
    <div className="border rounded-xl p-4 flex items-center justify-between bg-card hover:border-primary/20 transition-colors">
      <div className="flex items-center gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatar} />
          <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
        </Avatar>
        <div>
          <Link to={`/u/${user.username}`} className="font-bold hover:text-primary transition-colors">u/{user.username}</Link>
          <p className="text-xs text-muted-foreground">View profile</p>
        </div>
      </div>
      {!isOwnProfile && (
        <Button
          size="sm"
          variant={isFollowing ? 'outline' : 'default'}
          className="rounded-full px-6"
          onClick={handleFollow}
          disabled={followMutation.isPending || unfollowMutation.isPending}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Button>
      )}
    </div>
  )
}

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const { data, isLoading } = useSearchQuery(q)

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  const posts = data?.posts ?? []
  const communities = data?.communities ?? []
  const users = (data as any)?.users ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><Search className="h-5 w-5 text-primary" /></div>
        <h1 className="text-2xl font-bold">Results for "{q}"</h1>
      </div>

      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="posts" className="gap-2">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="communities" className="gap-2">Communities ({communities.length})</TabsTrigger>
          <TabsTrigger value="users" className="gap-2">Users ({users.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4 mt-6">
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
          {posts.length === 0 && (
            <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
              <p className="text-muted-foreground italic text-sm">No posts found matching "{q}".</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="communities" className="space-y-3 mt-6">
          {communities.map((sub: any) => (
            <div key={sub.name} className="border rounded-xl p-4 flex items-center justify-between bg-card hover:border-primary/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><Hash className="h-5 w-5 text-muted-foreground" /></div>
                <div>
                  <Link to={`/r/${sub.name}`} className="font-bold hover:text-primary transition-colors">r/{sub.name}</Link>
                  <p className="text-xs text-muted-foreground line-clamp-1">{sub.subscribers} members • {sub.description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-full px-6" asChild>
                <Link to={`/r/${sub.name}`}>View</Link>
              </Button>
            </div>
          ))}
          {communities.length === 0 && (
            <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
              <p className="text-muted-foreground italic text-sm">No communities found matching "{q}".</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-3 mt-6">
          {users.map((user: any) => <UserResult key={user.id} user={user} />)}
          {users.length === 0 && (
            <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
              <p className="text-muted-foreground italic text-sm">No users found matching "{q}".</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
