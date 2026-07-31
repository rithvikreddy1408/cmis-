import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, BellOff } from 'lucide-react'
import { notificationsApi } from '../../services/notifications.api'
import { useAuth } from '../../context/AuthContext'
import NotificationItem from '../../components/ui/NotificationItem'
import EmptyState from '../../components/ui/EmptyState'
import PushNotificationToggle from '../../components/ui/PushNotificationToggle'

export default function Notifications() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-xl font-semibold text-slate-100">Notifications</h1>

      <PushNotificationToggle />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          message="You'll see updates here when your bus starts a trip, your pass status changes, or the admin sends an announcement."
        />
      ) : (
        <div className="space-y-2">
          {data.map((n) => {
            const isRead = user ? n.readBy.includes(user.uid) : true
            return (
              <NotificationItem
                key={n.notificationId}
                title={n.title}
                message={n.message}
                createdAt={n.createdAt}
                isRead={isRead}
                onMarkRead={() => markReadMutation.mutate(n.notificationId)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
