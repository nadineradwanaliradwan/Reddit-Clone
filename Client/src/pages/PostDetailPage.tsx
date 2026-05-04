import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { usePostQuery, useDeletePostMutation, useSavePostMutation, useUnsavePostMutation } from '@/hooks/use-reddit-query'
import { VoteControl } from '@/components/feed/VoteControl'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CommentSection } from '@/components/post/CommentSection'
import { Summarizer } from '@/components/post/Summarizer'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { Trash2, Bookmark, ExternalLink } from 'lucide-react'

export function PostDetailPage() {
  const { id = '' } = useParams()
  const { data: post, isLoading } = usePostQuery(id)
  const { toast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const deletePost = useDeletePostMutation()
  const savePost = useSavePostMutation()
  const unsavePost = useUnsavePostMutation()
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null)

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return
    try {
      await deletePost.mutateAsync(id)
      toast({ title: 'Post deleted' })
      navigate('/')
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Failed to delete' })
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading post...</p>
  if (!post) return <p className="text-muted-foreground">Post not found.</p>

  const isAuthor = user?.username === post.author
  const isSaved = savedOverride !== null ? savedOverride : (post.isSaved || false)

  const handleSave = async () => {
    if (!user) { toast({ variant: 'destructive', title: 'Sign in to save posts' }); return }
    const next = !isSaved
    setSavedOverride(next)
    try {
      if (next) await savePost.mutateAsync(post.id)
      else await unsavePost.mutateAsync(post.id)
      toast({ title: next ? 'Post saved' : 'Post unsaved' })
    } catch (err: any) {
      setSavedOverride(!next)
      toast({ variant: 'destructive', title: err.message || 'Failed to save post' })
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-primary hover:underline">Back to feed</Link>
      <article className="bg-card border rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Link to={`/r/${post.subreddit}`} className="font-bold text-foreground hover:underline">r/{post.subreddit}</Link>
          <span>•</span><span>Posted by u/{post.author}</span><span>•</span><span>{post.timestamp}</span>
        </div>
        <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
        {post.type === 'link' && post.url ? (
          <a href={post.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-4 break-all"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />{post.url}
          </a>
        ) : (
          post.content && <p className="text-sm mb-4 whitespace-pre-wrap">{post.content}</p>
        )}
        {post.imageUrl ? <img src={post.imageUrl} alt={post.title} className="rounded-lg w-full mb-4" /> : null}
        <div className="flex items-center gap-2">
          <VoteControl initialVotes={post.votes} vertical={false} postId={post.id} initialUserVote={post.userVote} />
          <Button variant="ghost" onClick={() => toast({ title: 'Share ready', description: 'Sharing is mocked in this frontend build.' })}>Share</Button>
          <Button
            variant="ghost" size="sm"
            className={`gap-2 ${isSaved ? 'text-primary' : 'text-muted-foreground'}`}
            onClick={handleSave}
            disabled={savePost.isPending || unsavePost.isPending}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
          {isAuthor && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={handleDelete} disabled={deletePost.isPending}>
              <Trash2 className="h-4 w-4 mr-1" />{deletePost.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </article>
      <div className="bg-card border rounded-xl p-6">
        <Summarizer comments={post.comments} postId={post.id} />
        <Separator className="mb-6" />
        <CommentSection comments={post.comments} postId={post.id} />
      </div>
    </div>
  )
}
