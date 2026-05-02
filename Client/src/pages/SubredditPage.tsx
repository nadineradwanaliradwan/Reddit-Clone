import { useParams } from 'react-router-dom'
import { useSubredditPostsQuery, useSubredditQuery } from '@/hooks/use-reddit-query'
import { PostCard } from '@/components/feed/PostCard'

export function SubredditPage() {
  const { subreddit = '' } = useParams()
  const { data: info } = useSubredditQuery(subreddit)
  const { data: posts = [] } = useSubredditPostsQuery(subreddit)

  if (!info) return <p className="text-muted-foreground">Community not found.</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">r/{info.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">{info.description}</p>
      <div className="space-y-4">{posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <p className="text-muted-foreground">No posts yet.</p>}</div>
    </div>
  )
}
