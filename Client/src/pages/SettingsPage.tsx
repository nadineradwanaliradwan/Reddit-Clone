import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { redditService } from '@/api/reddit-service'

const schema = z.object({ displayName: z.string().min(2), about: z.string().max(280), messages: z.boolean(), replies: z.boolean() })

export function SettingsPage() {
  const { toast } = useToast()
  const form = useForm<z.infer<typeof schema>>({ 
    resolver: zodResolver(schema), 
    defaultValues: { displayName: '', about: '', messages: true, replies: true } 
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    try {
      await redditService.updateProfile({ username: values.displayName })
      toast({ title: 'Settings saved', description: 'Your profile has been updated.' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message })
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">User Settings</h1>
      <Form {...form}>
        <form className="space-y-4 border rounded-xl p-4 bg-card" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField control={form.control} name="displayName" render={({ field }) => <FormItem><FormLabel>Display name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="about" render={({ field }) => <FormItem><FormLabel>About</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="messages" render={({ field }) => <FormItem className="flex justify-between items-center"><FormLabel>Message notifications</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
          <FormField control={form.control} name="replies" render={({ field }) => <FormItem className="flex justify-between items-center"><FormLabel>Reply notifications</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
          <Button type="submit">Save changes</Button>
        </form>
      </Form>
    </div>
  )
}
