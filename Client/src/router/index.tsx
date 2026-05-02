import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/pages/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { PopularPage } from '@/pages/PopularPage'
import { ExplorePage } from '@/pages/ExplorePage'
import { CommunitiesPage } from '@/pages/CommunitiesPage'
import { PostDetailPage } from '@/pages/PostDetailPage'
import { SubredditPage } from '@/pages/SubredditPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SearchPage } from '@/pages/SearchPage'
import { SubmitPostPage } from '@/pages/SubmitPostPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'popular', element: <PopularPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'communities', element: <CommunitiesPage /> },
      { path: 'post/:id', element: <PostDetailPage /> },
      { path: 'r/:subreddit', element: <SubredditPage /> },
      { path: 'u/:username', element: <ProfilePage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'submit', element: <SubmitPostPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
