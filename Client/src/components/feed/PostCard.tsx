import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Share2, Bookmark, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VoteControl } from './VoteControl'
import { Post } from '@/lib/mock-data'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { useSavePostMutation, useUnsavePostMutation } from '@/hooks/use-reddit-query'

export function PostCard({ post }: { post: Post }) {
  const { toast } = useToast()
  const { user } = useAuth()
  const savePost = useSavePostMutation()
  const unsavePost = useUnsavePostMutation()
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null)
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
    <Card className="overflow-hidden hover:border-primary/30 transition-colors group">
      <div className="flex">
        <div className="hidden sm:flex bg-muted/20 px-2 py-4 flex-col items-center">
          <VoteControl initialVotes={post.votes} postId={post.id} initialUserVote={post.userVote} />
        </div>
        <div className="flex-1 flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Link to={`/r/${post.subreddit}`} className="font-bold text-foreground hover:underline">r/{post.subreddit}</Link><span>•</span>
              <Link to={`/u/${post.author}`} className="hover:underline">Posted by u/{post.author}</Link><span>•</span><span>{post.timestamp}</span>
            </div>
            <Link to={`/post/${post.id}`}><h3 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">{post.title}</h3></Link>
          </CardHeader>
          <CardContent className="p-4 pt-0 pb-2">
            {post.type === 'link' && post.url ? (
              <a href={post.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-3 break-all"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />{post.url}
              </a>
            ) : (
              post.content && <p className="text-sm text-muted-foreground line-clamp-3 mb-4 whitespace-pre-wrap">{post.content}</p>
            )}
            {post.imageUrl && <div className="rounded-lg overflow-hidden bg-muted aspect-video mb-4"><img src={post.imageUrl} alt={post.title} className="h-full w-full object-cover" /></div>}
          </CardContent>
          <CardFooter className="p-2 pt-0 flex items-center gap-2">
            <div className="sm:hidden mr-2">
              <VoteControl initialVotes={post.votes} vertical={false} postId={post.id} initialUserVote={post.userVote} />
            </div>
            <Link to={`/post/${post.id}`}><Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 px-2 hover:bg-muted"><MessageSquare className="h-4 w-4" /><span className="text-xs font-semibold">{post.commentCount} Comments</span></Button></Link>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground h-8 px-2 hover:bg-muted" onClick={() => toast({ title: 'Share link copied', description: `Shared ${post.title}` })}><Share2 className="h-4 w-4" /><span className="text-xs font-semibold">Share</span></Button>
            <Button
              variant="ghost" size="sm"
              className={`gap-2 h-8 px-2 hover:bg-muted ${isSaved ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={handleSave}
              disabled={savePost.isPending || unsavePost.isPending}
              aria-label={isSaved ? 'Unsave post' : 'Save post'}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              <span className="text-xs font-semibold">{isSaved ? 'Saved' : 'Save'}</span>
            </Button>
          </CardFooter>
        </div>
      </div>
    </Card>
  )
}
