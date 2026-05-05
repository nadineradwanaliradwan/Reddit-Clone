import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useSubredditsQuery,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
} from '@/hooks/use-reddit-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { redditService } from '@/api/reddit-service'
import { useQueryClient } from '@tanstack/react-query'
import { type SubredditInfo } from '@/lib/mock-data'
import { Hash, Loader2 } from 'lucide-react'

// ─── Card for an individual community in the list ────────────────────────────
function CommunityCard({ sub }: { sub: SubredditInfo }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const joinMutation = useJoinCommunityMutation()
  const leaveMutation = useLeaveCommunityMutation()
  const [override, setOverride] = useState<boolean | null>(null)
  const isMember = override !== null ? override : !!sub.isMember
  const isPending = joinMutation.isPending || leaveMutation.isPending

  const handleJoin = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in to join communities' })
      return
    }
    setOverride(true)
    try {
      await joinMutation.mutateAsync(sub.name)
      toast({ title: `Joined r/${sub.name}` })
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('already a member')) return
      setOverride(false)
      toast({ variant: 'destructive', title: err.message || 'Failed to join' })
    }
  }

  const handleLeave = async () => {
    setOverride(false)
    try {
      await leaveMutation.mutateAsync(sub.name)
      toast({ title: `Left r/${sub.name}` })
    } catch (err: any) {
      setOverride(true)
      toast({ variant: 'destructive', title: err.message || 'Failed to leave' })
    }
  }

  return (
    <div className="border rounded-xl p-4 flex items-center justify-between gap-3 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Hash className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <Link to={`/r/${sub.name}`} className="font-bold hover:text-primary transition-colors">
            r/{sub.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">
            {sub.subscribers} members{sub.description ? ` · ${sub.description}` : ''}
          </p>
        </div>
      </div>
      {isMember ? (
        <Button variant="outline" size="sm" onClick={handleLeave} disabled={isPending}>
          {leaveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Joined'}
        </Button>
      ) : (
        <Button size="sm" onClick={handleJoin} disabled={isPending}>
          {joinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Join'}
        </Button>
      )}
    </div>
  )
}

// ─── Create Community dialog ────────────────────────────────────────────────
const createSchema = z.object({
  name: z
    .string()
    .min(3, 'Community name must be at least 3 characters')
    .max(21, 'Community name cannot exceed 21 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  type: z.enum(['public', 'restricted', 'private']),
})

function CreateCommunityDialog() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', type: 'public' },
  })

  const onSubmit = async (values: z.infer<typeof createSchema>) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in to create a community' })
      return
    }
    setSubmitting(true)
    try {
      // Trim description so an empty value isn't sent over the wire.
      const payload: Record<string, string> = { name: values.name, type: values.type }
      const desc = values.description?.trim()
      if (desc) payload.description = desc

      await redditService.createCommunity(payload)
      toast({ title: 'Community created', description: `r/${values.name} is live.` })
      setOpen(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['subreddits'] })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to create', description: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Community</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a community</DialogTitle>
          <DialogDescription>
            Pick a name and a privacy level. You can edit description and rules later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground">
                        r/
                      </span>
                      <Input
                        className="rounded-l-none"
                        placeholder="awesome_community"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>3-21 characters, letters/numbers/underscores. Cannot be changed later.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this community about?" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Community type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="space-y-2"
                    >
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="public" className="mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Public</p>
                          <p className="text-muted-foreground text-xs">Anyone can view, post, and comment.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="restricted" className="mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Restricted</p>
                          <p className="text-muted-foreground text-xs">Anyone can view, only members can post.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30">
                        <RadioGroupItem value="private" className="mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Private</p>
                          <p className="text-muted-foreground text-xs">Only members can view and post.</p>
                        </div>
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function CommunitiesPage() {
  const { data = [], isLoading } = useSubredditsQuery()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Communities</h1>
        <CreateCommunityDialog />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed">
          <p className="text-muted-foreground italic">No communities yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((sub) => (
            <CommunityCard key={sub.name} sub={sub} />
          ))}
        </div>
      )}
    </div>
  )
}
