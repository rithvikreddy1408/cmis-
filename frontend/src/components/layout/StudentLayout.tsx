import {
  LayoutDashboard,
  Search,
  MapPin,
  ClipboardCheck,
  Ticket,
  Bell,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import AppShell, { type NavItem } from './AppShell'
import { notificationsApi } from '../../services/notifications.api'
import { useAuth } from '../../context/AuthContext'

export default function StudentLayout() {
  const { user } = useAuth()
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })
  const unread = notifications?.filter((n) => !n.readBy.includes(user?.uid ?? '')).length ?? 0

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Search Bus', to: '/student/search', icon: Search },
    { label: 'Track Bus', to: '/student/track', icon: MapPin },
    { label: 'Attendance', to: '/student/attendance', icon: ClipboardCheck },
    { label: 'Bus Pass', to: '/student/pass', icon: Ticket },
    { label: 'Notifications', to: '/student/notifications', icon: Bell, badge: unread },
  ]

  return <AppShell roleLabel="Student" navItems={navItems} />
}
