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
import { routesApi } from '../../services/routes.api'
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

  const { data: route } = useQuery({
    queryKey: ['route', bus?.routeId],
    queryFn: () => routesApi.get(bus!.routeId!),
    enabled: Boolean(bus?.routeId),
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
    await queryClient.invalidateQueries({ queryKey: ['route'] })
    await queryClient.invalidateQueries({ queryKey: ['driver-public'] })
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayRecord = attendance?.find((a) => a.date === today)

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Dashboard</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-900">
        Welcome, {student?.name.split(' ')[0]}
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-600">
            <BusIcon className="h-4 w-4" />
            <span className="text-sm">Assigned Bus</span>
          </div>
          {bus ? (
            <>
              <p className="text-lg font-semibold text-slate-900">{bus.busNumber}</p>
              <p className="text-sm text-slate-600">
                Status: <StatusPill status={bus.status} />
              </p>
              <Link
                to="/student/track"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
              >
                <MapPin className="h-3.5 w-3.5" /> Track live
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-600">No bus assigned yet.</p>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-600">
            <MapPin className="h-4 w-4" />
            <span className="text-sm">Your assigned route</span>
          </div>
          {route ? (
            <>
              <p className="text-lg font-semibold text-slate-900">{route.routeName}</p>
              <p className="text-sm text-slate-600">{route.startPoint} → {route.destination}</p>
              <Link to="/student/track" className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700">
                <MapPin className="h-3.5 w-3.5" /> View assigned route and live bus
              </Link>
            </>
          ) : <p className="text-sm text-slate-600">No route assigned to your bus yet.</p>}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-600">
            <Contact className="h-4 w-4" />
            <span className="text-sm">Driver</span>
          </div>
          {driver ? (
            <>
              <p className="text-lg font-semibold text-slate-900">{driver.name}</p>
              <p className="text-sm text-slate-600">{driver.phone}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Not assigned yet.</p>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-600">
            <ClipboardCheck className="h-4 w-4" />
            <span className="text-sm">Today's Attendance</span>
          </div>
          {todayRecord ? (
            <>
              <p className="text-lg font-semibold text-emerald-600">Boarded</p>
              <p className="text-sm text-slate-600">
                {new Date(todayRecord.boardingTime).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Not boarded yet today.</p>
          )}
          <Link
            to="/student/attendance"
            className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700"
          >
            View history
          </Link>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-slate-600">
            <Ticket className="h-4 w-4" />
            <span className="text-sm">Bus Pass</span>
          </div>
          {student?.passStatus && student.passStatus !== 'none' ? (
            <>
              <PassStatusPill status={student.passStatus} />
              {student.passExpiry && (
                <p className="mt-1 text-sm text-slate-600">
                  Expires {new Date(student.passExpiry).toLocaleDateString()}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600">
              <TriangleAlert className="h-4 w-4" />
              <p className="text-sm">No pass issued</p>
            </div>
          )}
          <Link to="/student/pass" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700">
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
    idle: 'text-slate-600',
    on_trip: 'text-emerald-600',
    offline: 'text-red-600',
    maintenance: 'text-amber-600',
  }
  return <span className={styles[status] ?? 'text-slate-600'}>{status}</span>
}

function PassStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'text-emerald-600',
    expired: 'text-amber-600',
    revoked: 'text-red-600',
  }
  return <p className={`text-lg font-semibold ${styles[status] ?? 'text-slate-600'}`}>{status}</p>
}
