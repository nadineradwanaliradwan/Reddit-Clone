import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSubredditsQuery, useJoinCommunityMutation, useLeaveCommunityMutation } from '@/hooks/use-reddit-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { redditService } from '@/api/reddit-service'
import { useQueryClient } from '@tanstack/react-query'
import { SubredditInfo } from '@/lib/mock-data'

function CommunityCard({ sub }: { sub: SubredditInfo }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const joinMutation = useJoinCommunityMutation()
  const leaveMutation = useLeaveCommunityMutation()
  const [override, setOverride] = useState<boolean | null>(null)
  const isMember = override !== null ? override : (sub.isMember || false)
  const isPending = joinMutation.isPending || leaveMutation.isPending

  const handleJoin = async () => {
    if (!user) { toast({ variant: 'destructive', title: 'Sign in to join communities' }); return }
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
    <div className="border rounded-xl p-4 flex items-center justify-between">
      <div>
        <Link to={`/r/${sub.name}`} className="font-bold hover:underline">r/{sub.name}</Link>
        <p className="text-xs text-muted-foreground">{sub.subscribers} members</p>
      </div>
      {isMember ? (
        <Button variant="outline" size="sm" onClick={handleLeave} disabled={isPending}>
          {leaveMutation.isPending ? 'Leaving…' : 'Joined'}
        </Button>
      ) : (
        <Button size="sm" onClick={handleJoin} disabled={isPending}>
          {joinMutation.isPending ? 'Joining…' : 'Join'}
        </Button>
      )}
    </div>
  )
}

export function CommunitiesPage() {
  const { data = [] } = useSubredditsQuery()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()

  const handleCreate = async () => {
    try {
      await redditService.createCommunity({ name, type: 'public' })
      toast({ title: 'Community created', description: `r/${name} has been created.` })
      setIsOpen(false)
      setName('')
      queryClient.invalidateQueries({ queryKey: ['subreddits'] })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to create', description: err.message })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Communities</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Create Community</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Community</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Input placeholder="Community name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={handleCreate} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {data.map((sub) => <CommunityCard key={sub.name} sub={sub} />)}
    </div>
  )
}
