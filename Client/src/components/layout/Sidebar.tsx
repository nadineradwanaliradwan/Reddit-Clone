import { Link, useLocation } from 'react-router-dom'
import { Home, TrendingUp, Users, Hash, Compass, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSubredditsQuery } from '@/hooks/use-reddit-query'
import * as LucideIcons from 'lucide-react'

export function Sidebar() {
  const location = useLocation()
  const pathname = location.pathname
  const { data: subreddits = [], isLoading } = useSubredditsQuery()

  return (
    <aside className="hidden lg:flex w-64 flex-col gap-6 py-6 overflow-y-auto">
      <div className="px-4 space-y-1">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">Feeds</p>
        <SidebarItem icon={Home} label="Home" active={pathname === '/'} href="/" />
        <SidebarItem icon={TrendingUp} label="Popular" active={pathname === '/popular'} href="/popular" />
        <SidebarItem icon={Compass} label="Explore" active={pathname === '/explore'} href="/explore" />
        <SidebarItem icon={Users} label="Communities" active={pathname === '/communities'} href="/communities" />
      </div>
      <div className="px-4 space-y-1">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">Communities</p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          subreddits.slice(0, 8).map((sub) => {
            const IconComp = (LucideIcons as any)[sub.icon] ?? Hash
            return <SidebarItem key={sub.name} icon={IconComp} label={`r/${sub.name}`} href={`/r/${sub.name}`} active={pathname === `/r/${sub.name}`} />
          })
        )}
        <Link to="/communities"><Button variant="ghost" className="w-full justify-start text-sm text-primary hover:text-primary hover:bg-primary/5 font-semibold">See All Communities</Button></Link>
      </div>
    </aside>
  )
}

function SidebarItem({ icon: Icon, label, active, href }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; href: string }) {
  return (
    <Link to={href}>
      <Button variant="ghost" className={`w-full justify-start gap-3 h-10 px-3 rounded-md transition-colors ${active ? 'bg-primary/10 text-primary font-bold hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
        <Icon className="h-5 w-5" />
        <span className="text-sm">{label}</span>
      </Button>
    </Link>
  )
}
