import { Outlet } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="container mx-auto px-4 flex flex-1 gap-6">
        <Sidebar />
        <main className="flex-1 py-6 max-w-3xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
