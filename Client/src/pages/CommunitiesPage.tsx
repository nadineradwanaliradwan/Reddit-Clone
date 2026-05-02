import { useSubredditsQuery } from '@/hooks/use-reddit-query'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'react-router-dom'

export function CommunitiesPage() {
  const { data = [] } = useSubredditsQuery()
  const { toast } = useToast()
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">Communities</h1><Button onClick={() => toast({ title: 'Coming soon', description: 'Create community flow is mocked for now.' })}>Create Community</Button></div>
      {data.map((sub) => (
        <div key={sub.name} className="border rounded-xl p-4 flex items-center justify-between"><div><Link to={`/r/${sub.name}`} className="font-bold">r/{sub.name}</Link><p className="text-xs text-muted-foreground">{sub.subscribers} members</p></div><Button variant="outline" onClick={() => toast({ title: `Joined r/${sub.name}` })}>Join</Button></div>
      ))}
    </div>
  )
}
