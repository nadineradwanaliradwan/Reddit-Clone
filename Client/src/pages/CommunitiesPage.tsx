import { useSubredditsQuery } from '@/hooks/use-reddit-query'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { redditService } from '@/api/reddit-service'
import { useQueryClient } from '@tanstack/react-query'

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
      {data.map((sub) => (
        <div key={sub.name} className="border rounded-xl p-4 flex items-center justify-between"><div><Link to={`/r/${sub.name}`} className="font-bold">r/{sub.name}</Link><p className="text-xs text-muted-foreground">{sub.subscribers} members</p></div><Button variant="outline" onClick={() => toast({ title: `Joined r/${sub.name}` })}>Join</Button></div>
      ))}
    </div>
  )
}
