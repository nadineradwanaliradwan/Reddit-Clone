import { useParams } from 'react-router-dom'
import { useUserPostsQuery } from '@/hooks/use-reddit-query'
import { PostCard } from '@/components/feed/PostCard'

export function ProfilePage() {
  const { username = 'guest' } = useParams()
  const { data = [] } = useUserPostsQuery(username)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">u/{username}</h1>
      <p className="text-sm text-muted-foreground">Profile overview with posts, comments, and saved tabs.</p>
      {data.length ? data.map((post) => <PostCard key={post.id} post={post} />) : <p className="text-muted-foreground">No posts yet.</p>}
    </div>
  )
}
