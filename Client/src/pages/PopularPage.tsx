import { PostCard } from '@/components/feed/PostCard'
import { usePopularQuery } from '@/hooks/use-reddit-query'

export function PopularPage() {
  const { data = [], isLoading } = usePopularQuery()
  if (isLoading) return <p className="text-muted-foreground">Loading popular posts...</p>
  return <div className="space-y-4">{data.map((post) => <PostCard key={post.id} post={post} />)}</div>
}
