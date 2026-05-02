import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSubredditsQuery } from '@/hooks/use-reddit-query'
import { Link } from 'react-router-dom'

export function ExplorePage() {
  const { data = [] } = useSubredditsQuery()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.map((sub) => (
        <Card key={sub.name}><CardContent className="p-4"><div className="flex justify-between"><Link to={`/r/${sub.name}`} className="font-bold">r/{sub.name}</Link><Button size="sm" variant="outline">Join</Button></div><p className="text-sm text-muted-foreground mt-2">{sub.description}</p></CardContent></Card>
      ))}
    </div>
  )
}
