import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { useToast } from '@/hooks/use-toast'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const schema = z.object({ 
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Please enter a valid email address'), 
  password: z.string().min(6, 'Password must be at least 6 characters') 
})

export function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ 
    resolver: zodResolver(schema), 
    defaultValues: { username: '', email: '', password: '' } 
  })
  const { register } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setIsSubmitting(true)
    try {
      await register(values.username, values.email, values.password)
      toast({ title: 'Account created!', description: 'You have successfully registered and signed in.' })
      navigate('/')
    } catch (err: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Registration failed', 
        description: err.message || 'Something went wrong during registration.' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md border rounded-xl p-8 bg-card shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join the EchoFeed community today</p>
        </div>
        
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField 
              control={form.control} 
              name="username" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl><Input placeholder="johndoe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
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
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </Form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
