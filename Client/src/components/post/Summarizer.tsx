import { useState } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Comment } from '@/lib/mock-data'
import { Card, CardContent } from '@/components/ui/card'
import { redditService } from '@/api/reddit-service'

export function Summarizer({ comments, postId }: { comments: Comment[]; postId?: string }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSummarize = async () => {
    setIsLoading(true)
    try {
      const result = await redditService.summarizeComments(comments, postId)
      setSummary(result)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mb-8">
      {!summary ? (
        <Button onClick={handleSummarize} disabled={isLoading} variant="outline" className="w-full bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 gap-2 h-12 rounded-xl">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 fill-primary/10" />}
          <span className="font-bold">Summarize Discussion with AI</span>
        </Button>
      ) : (
        <Card className="bg-primary/5 border-primary/20 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 rounded-full hover:bg-primary/10" onClick={() => setSummary(null)}><X className="h-4 w-4 text-primary" /></Button>
          <CardContent className="p-6"><div className="flex items-center gap-2 mb-3 text-primary"><Sparkles className="h-4 w-4" /><span className="text-sm font-bold uppercase tracking-wider">AI Insight</span></div><p className="text-sm leading-relaxed text-foreground/90 italic">"{summary}"</p></CardContent>
        </Card>
      )}
    </div>
  )
}
