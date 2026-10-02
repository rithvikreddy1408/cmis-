import { useEffect, useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Loader2, BellOff } from 'lucide-react'
import Banner from '../../components/ui/Banner'
import { SelectField, TextField } from '../../components/ui/FormField'
import StudentPicker from '../../components/ui/StudentPicker'
import NotificationItem from '../../components/ui/NotificationItem'
import EmptyState from '../../components/ui/EmptyState'
import PushNotificationToggle from '../../components/ui/PushNotificationToggle'
import { notificationsApi } from '../../services/notifications.api'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import type { Student } from '../../types'

type Target = 'all' | 'role' | 'student'

export default function AdminNotifications() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<Target>('all')
  const [role, setRole] = useState<'student' | 'driver'>('student')
  const [student, setStudent] = useState<Student | null>(null)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const messageId = useId()

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  })

  // Live push on top of the poll — admin-targeted and broadcast-all
  // notifications arrive over the socket the moment they're created.
  useEffect(() => {
    if (!socket) return
    const onNew = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
    socket.on('notification:new', onNew)
    return () => {
      socket.off('notification:new', onNew)
    }
  }, [socket, queryClient])

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const broadcastMutation = useMutation({
    mutationFn: () =>
      notificationsApi.broadcast({
        title,
        message,
        target,
        role: target === 'role' ? role : undefined,
        studentId: target === 'student' ? student?.studentId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setTitle('')
      setMessage('')
      setStudent(null)
      notify('success', 'Notification sent.')
    },
    onError: () => notify('error', 'Could not send notification.'),
  })

  const canSend =
    title.trim() && message.trim() && (target !== 'student' || Boolean(student))

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Notifications</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Send Notification</h2>
        <div className="space-y-3 card p-5">
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <label htmlFor={messageId} className="mb-1 block text-sm text-slate-700">
              Message
            </label>
            <textarea
              id={messageId}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg input px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <SelectField
            label="Send to"
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
          >
            <option value="all">Everyone</option>
            <option value="role">All students or drivers</option>
            <option value="student">One student</option>
          </SelectField>

          {target === 'role' && (
            <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as 'student' | 'driver')}>
              <option value="student">Students</option>
              <option value="driver">Drivers</option>
            </SelectField>
          )}

          {target === 'student' && <StudentPicker selected={student} onSelect={setStudent} />}

          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={!canSend || broadcastMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
          >
            {broadcastMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-medium text-slate-700">All Notifications</h2>
        <PushNotificationToggle />
        {banner && <Banner kind={banner.kind} message={banner.message} />}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={BellOff}
            title="No notifications yet"
            message="Rejected taps, capacity alerts, and anything you broadcast will show up here."
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
                  type={n.type}
                  onMarkRead={() => markReadMutation.mutate(n.notificationId)}
                />
              )
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
