import { useState } from 'react'
import { Link } from 'react-router-dom'
import { VoteControl } from '@/components/feed/VoteControl'
import { Comment } from '@/lib/mock-data'
import { MessageSquare, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export function CommentSection({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) return <div className="text-center py-12"><p className="text-muted-foreground italic">No comments yet. Be the first to share your thoughts!</p></div>
  return <div className="space-y-6">{comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)}</div>
}

function CommentItem({ comment }: { comment: Comment }) {
  const [isExpanded, setIsExpanded] = useState(true)
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <Link to={`/u/${comment.author}`}><Avatar className="h-8 w-8 hover:opacity-80 transition-opacity"><AvatarImage src={`https://picsum.photos/seed/${comment.author}/100/100`} /><AvatarFallback>{comment.author[0].toUpperCase()}</AvatarFallback></Avatar></Link>
        <button className="flex-1 w-px bg-border my-2 hover:bg-primary/50 transition-colors" onClick={() => setIsExpanded((v) => !v)} aria-label="Collapse thread" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 text-xs"><Link to={`/u/${comment.author}`} className="font-bold hover:underline">{comment.author}</Link><span className="text-muted-foreground">•</span><span className="text-muted-foreground">{comment.timestamp}</span></div>
        {isExpanded ? <><p className="text-sm leading-relaxed">{comment.content}</p><div className="flex items-center gap-2"><VoteControl initialVotes={comment.votes} vertical={false} className="bg-transparent px-0" /><Button variant="ghost" size="sm" className="h-8 px-2 gap-2 text-muted-foreground hover:bg-muted"><MessageSquare className="h-3 w-3" /><span className="text-xs font-bold">Reply</span></Button><Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:bg-muted"><span className="text-xs font-bold">Share</span></Button><Button variant="ghost" size="sm" className="h-8 px-1 text-muted-foreground" aria-label="Open comment menu"><MoreHorizontal className="h-4 w-4" /></Button></div>{comment.replies?.length ? <div className="pt-2">{comment.replies.map((reply) => <CommentItem key={reply.id} comment={reply} />)}</div> : null}</> : <button onClick={() => setIsExpanded(true)} className="text-xs text-primary font-bold hover:underline">Show comment</button>}
      </div>
    </div>
  )
}
