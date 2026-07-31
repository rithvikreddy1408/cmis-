import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bus as BusIcon,
  Contact,
  ClipboardCheck,
  Ticket,
  MapPin,
  TriangleAlert,
  Loader2,
} from 'lucide-react'
import { studentsApi } from '../../services/students.api'
import { busesApi } from '../../services/buses.api'
import { driversApi } from '../../services/drivers.api'
import { useBusChannel } from '../../hooks/useBusChannel'
import PullToRefresh from '../../components/ui/PullToRefresh'

export default function StudentDashboard() {
  const queryClient = useQueryClient()

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['students', 'me'],
    queryFn: studentsApi.me,
  })

  const { data: bus } = useQuery({
    queryKey: ['bus', student?.busAssigned],
    queryFn: () => busesApi.get(student!.busAssigned!),
    enabled: Boolean(student?.busAssigned),
  })

  const { data: driver } = useQuery({
    queryKey: ['driver-public', bus?.driverId],
    queryFn: () => driversApi.getPublic(bus!.driverId!),
    enabled: Boolean(bus?.driverId),
  })

  const { data: attendance } = useQuery({
    queryKey: ['students', 'me', 'attendance'],
    queryFn: () => studentsApi.myAttendance(),
    enabled: Boolean(student),
  })

  useBusChannel(student?.busAssigned)

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ['students'] })
    await queryClient.invalidateQueries({ queryKey: ['bus'] })
    await queryClient.invalidateQueries({ queryKey: ['driver-public'] })
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayRecord = attendance?.find((a) => a.date === today)

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Dashboard</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-100">
        Welcome, {student?.name.split(' ')[0]}
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-400">
            <BusIcon className="h-4 w-4" />
            <span className="text-sm">Assigned Bus</span>
          </div>
          {bus ? (
            <>
              <p className="text-lg font-semibold text-slate-100">{bus.busNumber}</p>
              <p className="text-sm text-slate-400">
                Status: <StatusPill status={bus.status} />
              </p>
              <Link
                to={`/student/track/${bus.busId}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300"
              >
                <MapPin className="h-3.5 w-3.5" /> Track live
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-400">No bus assigned yet.</p>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-400">
            <Contact className="h-4 w-4" />
            <span className="text-sm">Driver</span>
          </div>
          {driver ? (
            <>
              <p className="text-lg font-semibold text-slate-100">{driver.name}</p>
              <p className="text-sm text-slate-400">{driver.phone}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Not assigned yet.</p>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-400">
            <ClipboardCheck className="h-4 w-4" />
            <span className="text-sm">Today's Attendance</span>
          </div>
          {todayRecord ? (
            <>
              <p className="text-lg font-semibold text-emerald-400">Boarded</p>
              <p className="text-sm text-slate-400">
                {new Date(todayRecord.boardingTime).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Not boarded yet today.</p>
          )}
          <Link
            to="/student/attendance"
            className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300"
          >
            View history
          </Link>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-400">
            <Ticket className="h-4 w-4" />
            <span className="text-sm">Bus Pass</span>
          </div>
          {student?.passStatus && student.passStatus !== 'none' ? (
            <>
              <PassStatusPill status={student.passStatus} />
              {student.passExpiry && (
                <p className="mt-1 text-sm text-slate-400">
                  Expires {new Date(student.passExpiry).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">No pass issued</p>
            </div>
          )}
          <Link to="/student/pass" className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300">
            Manage pass
          </Link>
        </div>
      </div>
      </div>
    </PullToRefresh>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: 'text-slate-400',
    on_trip: 'text-emerald-400',
    offline: 'text-red-400',
    maintenance: 'text-amber-400',
  }
  return <span className={styles[status] ?? 'text-slate-400'}>{status}</span>
}

function PassStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'text-emerald-400',
    expired: 'text-amber-400',
    revoked: 'text-red-400',
  }
  return <p className={`text-lg font-semibold ${styles[status] ?? 'text-slate-400'}`}>{status}</p>
}
