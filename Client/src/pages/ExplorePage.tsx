import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useSubredditsQuery,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
} from '@/hooks/use-reddit-query'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'
import { Hash, Users, Loader2 } from 'lucide-react'
import { type SubredditInfo } from '@/lib/mock-data'

function ExploreCard({ sub }: { sub: SubredditInfo }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const joinMutation = useJoinCommunityMutation()
  const leaveMutation = useLeaveCommunityMutation()

  const [override, setOverride] = useState<boolean | null>(null)
  const isMember = override !== null ? override : !!sub.isMember
  const isPending = joinMutation.isPending || leaveMutation.isPending

  const handleJoin = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in to join communities' })
      return
    }
    setOverride(true)
    try {
      await joinMutation.mutateAsync(sub.name)
      toast({ title: `Joined r/${sub.name}` })
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already a member')) return
      setOverride(false)
      toast({ variant: 'destructive', title: err.message || 'Failed to join' })
    }
  }

  const handleLeave = async () => {
    setOverride(false)
    try {
      await leaveMutation.mutateAsync(sub.name)
      toast({ title: `Left r/${sub.name}` })
    } catch (err: any) {
      setOverride(true)
      toast({ variant: 'destructive', title: err.message || 'Failed to leave' })
    }
  }

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <Link to={`/r/${sub.name}`} className="font-bold hover:text-primary transition-colors">
                r/{sub.name}
              </Link>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users className="h-3 w-3" />
                {sub.subscribers} members
              </p>
            </div>
          </div>
          {isMember ? (
            <Button variant="outline" size="sm" onClick={handleLeave} disabled={isPending}>
              {leaveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Joined'}
            </Button>
          ) : (
            <Button size="sm" onClick={handleJoin} disabled={isPending}>
              {joinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Join'}
            </Button>
          )}
        </div>
        {sub.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{sub.description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function ExplorePage() {
  const { data = [], isLoading } = useSubredditsQuery()

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Explore communities</h1>
        <p className="text-sm text-muted-foreground">Discover new communities to join.</p>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
          <p className="text-muted-foreground italic">
            No communities yet. Be the first to{' '}
            <Link to="/communities" className="text-primary hover:underline">
              create one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((sub) => (
            <ExploreCard key={sub.name} sub={sub} />
          ))}
        </div>
      )}
    </div>
  )
}
