import {
  LayoutDashboard,
  Users,
  Contact,
  Bus,
  Route,
  CreditCard,
  Ticket,
  FileBarChart,
  Settings,
  Bell,
  ShieldPlus,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import AppShell, { type NavItem } from './AppShell'
import { notificationsApi } from '../../services/notifications.api'
import { useAuth } from '../../context/AuthContext'

export default function AdminLayout() {
  const { user, role } = useAuth()
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })
  const unread = notifications?.filter((n) => !n.readBy.includes(user?.uid ?? '')).length ?? 0

  const navItems: NavItem[] = [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Students', to: '/admin/students', icon: Users },
    { label: 'Drivers', to: '/admin/drivers', icon: Contact },
    { label: 'Buses', to: '/admin/buses', icon: Bus },
    { label: 'Routes', to: '/admin/routes', icon: Route },
    { label: 'RFID', to: '/admin/rfid', icon: CreditCard },
    { label: 'Bus Passes', to: '/admin/passes', icon: Ticket },
    { label: 'Notifications', to: '/admin/notifications', icon: Bell, badge: unread },
    { label: 'Reports', to: '/admin/reports', icon: FileBarChart },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
  ]
  if (role === 'super_admin') navItems.splice(2, 0, { label: 'Admin Accounts', to: '/admin/admins', icon: ShieldPlus })

  return <AppShell roleLabel="Admin" navItems={navItems} />
}
