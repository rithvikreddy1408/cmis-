import { LayoutDashboard, Navigation, History, Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import AppShell, { type NavItem } from './AppShell'
import { notificationsApi } from '../../services/notifications.api'
import { useAuth } from '../../context/AuthContext'

export default function DriverLayout() {
  const { user } = useAuth()
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })
  const unread = notifications?.filter((n) => !n.readBy.includes(user?.uid ?? '')).length ?? 0

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/driver', icon: LayoutDashboard, end: true },
    { label: 'Trip & Navigation', to: '/driver/trip', icon: Navigation },
    { label: 'Trip History', to: '/driver/history', icon: History },
    { label: 'Notifications', to: '/driver/notifications', icon: Bell, badge: unread },
  ]

  return <AppShell roleLabel="Driver" navItems={navItems} />
}
