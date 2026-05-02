"use client"

import { useState } from "react"
import { ArrowBigUp, ArrowBigDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { apiRequest } from "@/api/client"
import { useToast } from "@/hooks/use-toast"

interface VoteControlProps {
  initialVotes: number
  vertical?: boolean
  className?: string
  postId?: string
  initialUserVote?: number
}

export function VoteControl({ initialVotes, vertical = true, className, postId, initialUserVote = 0 }: VoteControlProps) {
  const [voteStatus, setVoteStatus] = useState<number>(initialUserVote)
  const [count, setCount] = useState(initialVotes)
  const { toast } = useToast()

  const handleVote = async (type: 1 | -1) => {
    const oldStatus = voteStatus
    const oldCount = count
    
    // Optimistic UI update
    let nextStatus: number = type
    let nextCount = initialVotes
    
    if (oldStatus === type) {
      nextStatus = 0
      nextCount = initialVotes
    } else {
      nextStatus = type
      nextCount = initialVotes + type
    }
    
    setVoteStatus(nextStatus)
    setCount(nextCount)

    if (postId) {
      try {
        const endpoint = type === 1 ? `/reddit/posts/${postId}/upvote` : `/reddit/posts/${postId}/downvote`
        const data = await apiRequest<{ success: boolean; score: number; userVote: number }>(endpoint, {
          method: 'POST'
        })
        if (data.success) {
          setCount(data.score)
          setVoteStatus(data.userVote)
        }
      } catch (err: any) {
        // Rollback on error
        setVoteStatus(oldStatus)
        setCount(oldCount)
        toast({
          variant: 'destructive',
          title: 'Voting failed',
          description: err.message || 'You must be logged in to vote.'
        })
      }
    }
  }

  return (
    <div className={cn(
      "flex items-center gap-1",
      vertical ? "flex-col" : "flex-row bg-muted/50 rounded-full px-1",
      className
    )}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "hover:bg-primary/10 hover:text-primary rounded-full transition-transform active:scale-125",
          voteStatus === 1 && "text-primary bg-primary/10"
        )}
        onClick={() => handleVote(1)}
      >
        <ArrowBigUp className={cn("h-6 w-6", voteStatus === 1 && "fill-current")} />
      </Button>
      
      <span className={cn(
        "text-sm font-bold tabular-nums min-w-[2ch] text-center",
        voteStatus === 1 && "text-primary",
        voteStatus === -1 && "text-accent"
      )}>
        {count >= 1000 ? (count / 1000).toFixed(1) + "k" : count}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "hover:bg-accent/10 hover:text-accent rounded-full transition-transform active:scale-125",
          voteStatus === -1 && "text-accent bg-accent/10"
        )}
        onClick={() => handleVote(-1)}
      >
        <ArrowBigDown className={cn("h-6 w-6", voteStatus === -1 && "fill-current")} />
      </Button>
    </div>
  )
}
