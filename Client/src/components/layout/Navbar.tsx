import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, Bell, Menu, Moon, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useTheme } from '@/context/theme-context'
import { useAuth } from '@/context/auth-context'
import { useState } from 'react'
import { useUnreadCountQuery } from '@/hooks/use-reddit-query'

export function Navbar() {
  const [term, setTerm] = useState('')
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const { data: unreadCount = 0 } = useUnreadCountQuery()

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault()
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <div className="mt-6 flex flex-col gap-2">
                <Link to="/" className="text-sm font-medium hover:text-primary">Home</Link>
                <Link to="/popular" className="text-sm font-medium hover:text-primary">Popular</Link>
                <Link to="/explore" className="text-sm font-medium hover:text-primary">Explore</Link>
                <Link to="/communities" className="text-sm font-medium hover:text-primary">Communities</Link>
                <Link to="/settings" className="text-sm font-medium hover:text-primary">Settings</Link>
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary rounded-md p-1"><div className="w-5 h-5 border-2 border-white rounded-sm flex items-center justify-center"><span className="text-white font-bold text-xs">E</span></div></div>
            <span className="font-bold text-xl tracking-tight text-primary hidden sm:block">EchoFeed</span>
          </Link>
        </div>

        <form onSubmit={onSearch} className="flex-1 max-w-xl mx-auto hidden md:block">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} type="search" placeholder="Search EchoFeed..." className="w-full bg-muted border-none pl-9 focus-visible:ring-1 focus-visible:ring-primary" />
          </div>
        </form>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
          <Link to="/submit"><Button variant="ghost" size="icon" aria-label="Create post"><Plus className="h-5 w-5" /></Button></Link>
          <Link to="/notifications">
            <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-background" />}
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all ml-2">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>{user?.username.slice(0, 2).toUpperCase() ?? 'GU'}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <Link to={`/u/${user?.username ?? 'guest'}`}><DropdownMenuItem className="cursor-pointer font-medium">My Profile</DropdownMenuItem></Link>
              <Link to="/settings"><DropdownMenuItem className="cursor-pointer font-medium">User Settings</DropdownMenuItem></Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive font-medium cursor-pointer">Log Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}
