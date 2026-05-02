import { PostCard } from '@/components/feed/PostCard'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Flame, Star, Clock, TrendingUp } from 'lucide-react'
import { useFeedQuery } from '@/hooks/use-reddit-query'

export function HomePage() {
  const { data = [], isLoading } = useFeedQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading feed...</p>
  return (
    <>
      <div className="mb-6"><Tabs defaultValue="hot"><TabsList className="bg-card border h-11 p-1 rounded-lg w-full sm:w-auto"><TabsTrigger value="hot" className="flex gap-2"><Flame className="h-4 w-4" />Hot</TabsTrigger><TabsTrigger value="new" className="flex gap-2"><Clock className="h-4 w-4" />New</TabsTrigger><TabsTrigger value="top" className="flex gap-2"><Star className="h-4 w-4" />Top</TabsTrigger><TabsTrigger value="rising" className="flex gap-2"><TrendingUp className="h-4 w-4" />Rising</TabsTrigger></TabsList></Tabs></div>
      <div className="space-y-4">{data.map((post) => <PostCard key={post.id} post={post} />)}</div>
    </>
  )
}
