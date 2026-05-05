import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/api/client'
import { redditService } from '@/api/reddit-service'
import { useAuth } from '@/context/auth-context'
import { Loader2 } from 'lucide-react'

// ─── Profile (username + email) ─────────────────────────────────────────────
const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores are allowed'),
  email: z.string().email('Please enter a valid email address'),
})

// ─── Password change ────────────────────────────────────────────────────────
const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  })

export function SettingsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { username: '', email: '' },
  })

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  // Hydrate the profile form from the auth user once it's loaded.
  useEffect(() => {
    if (user) {
      profileForm.reset({ username: user.username, email: user.email })
    }
  }, [user, profileForm])

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return
    // Send only changed fields — keeps validation errors focused.
    const payload: { username?: string; email?: string } = {}
    if (values.username !== user.username) payload.username = values.username
    if (values.email !== user.email) payload.email = values.email

    if (!payload.username && !payload.email) {
      toast({ title: 'Nothing to save', description: 'Update at least one field first.' })
      return
    }

    setProfileSaving(true)
    try {
      await redditService.updateProfile(payload)
      toast({ title: 'Profile saved', description: 'Your profile has been updated.' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message })
    } finally {
      setProfileSaving(false)
    }
  }

  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setPasswordSaving(true)
    try {
      const data = await apiRequest<{ success: boolean; accessToken: string; refreshToken: string }>(
        '/reddit/users/me/password',
        {
          method: 'PATCH',
          body: JSON.stringify({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          }),
        },
      )
      // Backend issues new tokens on password change; persist them so the user
      // doesn't get logged out.
      if (data.success) {
        if (data.accessToken) localStorage.setItem('accessToken', data.accessToken)
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
      }
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast({ title: 'Password changed', description: 'Your password has been updated.' })
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Password change failed', description: err.message })
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!user) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">User Settings</h1>

      {/* ─── Profile ─────────────────────────────────────────────────────── */}
      <Form {...profileForm}>
        <form
          className="space-y-4 border rounded-xl p-6 bg-card"
          onSubmit={profileForm.handleSubmit(onProfileSubmit)}
        >
          <div>
            <h2 className="font-semibold">Profile</h2>
            <p className="text-sm text-muted-foreground">Edit your public username and email.</p>
          </div>

          <FormField
            control={profileForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="your_username" {...field} />
                </FormControl>
                <FormDescription>3-30 characters. Letters, numbers, and underscores only.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={profileForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={profileSaving}>
              {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </form>
      </Form>

      {/* ─── Change password ────────────────────────────────────────────── */}
      <Form {...passwordForm}>
        <form
          className="space-y-4 border rounded-xl p-6 bg-card"
          onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
        >
          <div>
            <h2 className="font-semibold">Change password</h2>
            <p className="text-sm text-muted-foreground">
              Changing your password will invalidate all existing sessions on this account.
            </p>
          </div>

          <FormField
            control={passwordForm.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={passwordForm.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription>At least 6 characters.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={passwordForm.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
