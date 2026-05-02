import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">The route you visited does not exist in this frontend clone.</p>
      <Link to="/" className="text-primary hover:underline">Return home</Link>
    </div>
  )
}
