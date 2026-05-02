import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useSubredditsQuery } from '@/hooks/use-reddit-query'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/api/client'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const schema = z.object({ 
  title: z.string().min(3, 'Title must be at least 3 characters'), 
  subreddit: z.string().min(1, 'Please select a community'), 
  content: z.string().optional() 
})

export function SubmitPostPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: subreddits = [], isLoading: isLoadingSubs } = useSubredditsQuery()
  
  const form = useForm<z.infer<typeof schema>>({ 
    resolver: zodResolver(schema), 
    defaultValues: { title: '', subreddit: '', content: '' } 
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsSubmitting(true)
    try {
      const data = await apiRequest<{ success: boolean; post: any }>('/reddit/posts', {
        method: 'POST',
        body: JSON.stringify({
          community: values.subreddit,
          title: values.title,
          body: values.content,
          type: 'text', // Default to text for now
        }),
      })
      if (data.success) {
        toast({ title: 'Post created!', description: `Successfully posted to r/${values.subreddit}` })
        navigate(`/post/${data.post._id}`)
      }
    } catch (err: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to create post', 
        description: err.message || 'Something went wrong.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create a post</h1>
      <Form {...form}>
        <form className="space-y-4 border rounded-xl p-6 bg-card shadow-sm" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField 
            control={form.control} 
            name="subreddit" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Community</FormLabel>
                <Select onValueChange={field.onChange} disabled={isLoadingSubs}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingSubs ? "Loading communities..." : "Choose a community"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {subreddits.map((s) => (
                      <SelectItem value={s.name} key={s.name}>r/{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} 
          />
          <FormField 
            control={form.control} 
            name="title" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input placeholder="What's on your mind?" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} 
          />
          <FormField 
            control={form.control} 
            name="content" 
            render={({ field }) => (
              <FormItem>
                <FormLabel>Body (optional)</FormLabel>
                <FormControl><Textarea className="min-h-[160px]" placeholder="Text (optional)" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} 
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
