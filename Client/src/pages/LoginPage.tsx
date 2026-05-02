import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'
import { useNavigate, Link } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const schema = z.object({ 
  email: z.string().email('Please enter a valid email address'), 
  password: z.string().min(6, 'Password must be at least 6 characters') 
})

export function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ 
    resolver: zodResolver(schema), 
    defaultValues: { email: '', password: '' } 
  })
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsSubmitting(true)
    try {
      await login(values.email, values.password)
      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' })
      navigate('/')
    } catch (err: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Sign in failed', 
        description: err.message || 'Invalid email or password.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md border rounded-xl p-8 bg-card shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Sign in to EchoFeed</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your details to continue</p>
        </div>
        
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField 
              control={form.control} 
              name="email" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
            <FormField 
              control={form.control} 
              name="password" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
            <Button className="w-full h-11" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? 'Signing in...' : 'Continue'}
            </Button>
          </form>
        </Form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            No account? <Link to="/register" className="text-primary font-semibold hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
