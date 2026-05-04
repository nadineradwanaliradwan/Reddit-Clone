import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VoteControl } from '@/components/feed/VoteControl'
import { Comment } from '@/lib/mock-data'
import { MessageSquare, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useCreateCommentMutation, useCreateReplyMutation } from '@/hooks/use-reddit-query'

export function CommentSection({ comments, postId }: { comments: Comment[]; postId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [body, setBody] = useState('')
  const createComment = useCreateCommentMutation(postId)

  const handleSubmit = async () => {
    if (!user) { toast({ variant: 'destructive', title: 'Sign in to comment' }); return }
    if (!body.trim()) return
    try {
      await createComment.mutateAsync(body.trim())
      setBody('')
      toast({ title: 'Comment posted' })
    } catch (err: any) {
      const msg = err.message || 'Failed to post comment'
      const hint = msg.toLowerCase().includes('join') ? 'Join this community first, then try again.' : undefined
      toast({ variant: 'destructive', title: msg, description: hint })
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Textarea
          placeholder={user ? 'What are your thoughts?' : 'Sign in to comment'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!user || createComment.isPending}
          rows={3}
        />
        {body.trim() && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setBody('')}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={createComment.isPending}>
              {createComment.isPending ? 'Posting…' : 'Comment'}
            </Button>
          </div>
        )}
      </div>
      {comments.length === 0
        ? <div className="text-center py-12"><p className="text-muted-foreground italic">No comments yet. Be the first to share your thoughts!</p></div>
        : <div className="space-y-6">{comments.map((comment) => <CommentItem key={comment.id} comment={comment} postId={postId} />)}</div>
      }
    </div>
  )
}

function CommentItem({ comment, postId }: { comment: Comment; postId: string }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const { user } = useAuth()
  const { toast } = useToast()
  const createReply = useCreateReplyMutation(postId)

  const handleReply = async () => {
    if (!user) { toast({ variant: 'destructive', title: 'Sign in to reply' }); return }
    if (!replyBody.trim()) return
    try {
      await createReply.mutateAsync({ commentId: comment.id, body: replyBody.trim() })
      setReplyBody('')
      setShowReplyBox(false)
      toast({ title: 'Reply posted' })
    } catch (err: any) {
      const msg = err.message || 'Failed to post reply'
      const hint = msg.toLowerCase().includes('join') ? 'Join this community first, then try again.' : undefined
      toast({ variant: 'destructive', title: msg, description: hint })
    }
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <Link to={`/u/${comment.author}`}>
          <Avatar className="h-8 w-8 hover:opacity-80 transition-opacity">
            <AvatarImage src={`https://picsum.photos/seed/${comment.author}/100/100`} />
            <AvatarFallback>{comment.author[0].toUpperCase()}</AvatarFallback>
          </Avatar>
        </Link>
        <button
          className="flex-1 w-px bg-border my-2 hover:bg-primary/50 transition-colors"
          onClick={() => setIsExpanded((v) => !v)}
          aria-label="Collapse thread"
        />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Link to={`/u/${comment.author}`} className="font-bold hover:underline">{comment.author}</Link>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{comment.timestamp}</span>
        </div>
        {isExpanded ? (
          <>
            <p className="text-sm leading-relaxed">{comment.content}</p>
            <div className="flex items-center gap-2">
              <VoteControl
                initialVotes={comment.votes}
                vertical={false}
                className="bg-transparent px-0"
                commentId={comment.id}
                initialUserVote={comment.userVote}
              />
              <Button
                variant="ghost" size="sm"
                className="h-8 px-2 gap-2 text-muted-foreground hover:bg-muted"
                onClick={() => { if (!user) { toast({ variant: 'destructive', title: 'Sign in to reply' }); return }; setShowReplyBox(v => !v) }}
              >
                <MessageSquare className="h-3 w-3" />
                <span className="text-xs font-bold">Reply</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:bg-muted">
                <span className="text-xs font-bold">Share</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-1 text-muted-foreground" aria-label="Open comment menu">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            {showReplyBox && (
              <div className="space-y-2 pl-2">
                <Textarea
                  placeholder="Write a reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  disabled={createReply.isPending}
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setShowReplyBox(false); setReplyBody('') }}>Cancel</Button>
                  <Button size="sm" onClick={handleReply} disabled={createReply.isPending || !replyBody.trim()}>
                    {createReply.isPending ? 'Posting…' : 'Reply'}
                  </Button>
                </div>
              </div>
            )}
            {comment.replies?.length ? (
              <div className="pt-2">
                {comment.replies.map((reply) => <CommentItem key={reply.id} comment={reply} postId={postId} />)}
              </div>
            ) : null}
          </>
        ) : (
          <button onClick={() => setIsExpanded(true)} className="text-xs text-primary font-bold hover:underline">
            Show comment
          </button>
        )}
      </div>
    </div>
  )
}
