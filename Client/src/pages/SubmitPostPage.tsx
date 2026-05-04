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
import { Loader2, AlignLeft, Link2, Image } from 'lucide-react'

type PostType = 'text' | 'link' | 'image'

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  subreddit: z.string().min(1, 'Please select a community'),
  body: z.string().optional(),
  url: z.string().optional(),
  imageUrl: z.string().optional(),
})

const TYPE_TABS: { type: PostType; label: string; icon: React.ReactNode }[] = [
  { type: 'text',  label: 'Text',  icon: <AlignLeft className="h-4 w-4" /> },
  { type: 'link',  label: 'Link',  icon: <Link2 className="h-4 w-4" /> },
  { type: 'image', label: 'Image', icon: <Image className="h-4 w-4" /> },
]

export function SubmitPostPage() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [postType, setPostType] = useState<PostType>('text')
  const { data: subreddits = [], isLoading: isLoadingSubs } = useSubredditsQuery()

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', subreddit: '', body: '', url: '', imageUrl: '' },
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (postType === 'link' && !values.url?.trim()) {
      form.setError('url', { message: 'URL is required for link posts' })
      return
    }
    if (postType === 'image' && !values.imageUrl?.trim()) {
      form.setError('imageUrl', { message: 'Image URL is required for image posts' })
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, string> = {
        community: values.subreddit,
        title: values.title,
        type: postType,
      }
      if (postType === 'text')  payload.body     = values.body     || ''
      if (postType === 'link')  payload.url      = values.url!.trim()
      if (postType === 'image') payload.imageUrl = values.imageUrl!.trim()

      const data = await apiRequest<{ success: boolean; post: any }>('/reddit/posts', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (data.success) {
        toast({ title: 'Post created!', description: `Successfully posted to r/${values.subreddit}` })
        navigate(`/post/${data.post._id}`)
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to create post',
        description: err.message || 'Something went wrong.',
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
                      <SelectValue placeholder={isLoadingSubs ? 'Loading communities…' : 'Choose a community'} />
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

          {/* Post type selector */}
          <div>
            <p className="text-sm font-medium mb-2">Post type</p>
            <div className="flex border rounded-lg overflow-hidden">
              {TYPE_TABS.map(({ type, label, icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPostType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
                    ${postType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground'}`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>
          </div>

          {/* Content field depends on type */}
          {postType === 'text' && (
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Textarea className="min-h-[140px]" placeholder="Text (optional)" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {postType === 'link' && (
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl><Input type="url" placeholder="https://example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {postType === 'image' && (
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl><Input type="url" placeholder="https://example.com/image.jpg" {...field} /></FormControl>
                  <FormMessage />
                  {field.value && (
                    <img
                      src={field.value}
                      alt="Preview"
                      className="mt-2 rounded-lg max-h-48 object-cover w-full"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </FormItem>
              )}
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting…</> : 'Post'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
