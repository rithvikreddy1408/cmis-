import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Users, Contact, Bus as BusIcon, Navigation, Ticket, ClipboardCheck } from 'lucide-react'
import StatTile from '../../components/ui/StatTile'
import { SkeletonCard, SkeletonChart } from '../../components/ui/Skeleton'
import FleetMap, { type FleetBus } from '../../components/maps/FleetMap'
import { SERVICE_AREA_CENTER, DEFAULT_MAP_ZOOM } from '../../utils/mapDefaults'
import { dashboardApi } from '../../services/dashboard.api'
import { busesApi } from '../../services/buses.api'
import { gpsApi } from '../../services/gps.api'
import type { Bus, GpsPosition } from '../../types'

// Chart color roles — validated dark-mode values from the dataviz skill's
// reference palette (sequential blue + fixed status scale), not eyeballed.
const SEQUENTIAL_BLUE = '#3987e5'
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' }
const GRID_COLOR = '#2c2c2a'
const AXIS_COLOR = '#898781'

function occupancyColor(ratio: number) {
  if (ratio >= 0.9) return STATUS.critical
  if (ratio >= 0.7) return STATUS.warning
  return STATUS.good
}

export default function AdminDashboard() {
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null)

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardApi.overview,
    refetchInterval: 15_000,
  })

  const { data: buses } = useQuery({
    queryKey: ['buses', 'fleet'],
    queryFn: () => busesApi.list({ pageSize: 200 }),
    refetchInterval: 10_000,
  })

  const { data: positions } = useQuery({
    queryKey: ['gps', 'all'],
    queryFn: gpsApi.all,
    refetchInterval: 10_000,
  })

  const { data: attendanceTrend, isLoading: attendanceTrendLoading } = useQuery({
    queryKey: ['dashboard', 'attendance-trend'],
    queryFn: () => dashboardApi.attendanceTrend(7),
  })

  const { data: busUsage, isLoading: busUsageLoading } = useQuery({
    queryKey: ['dashboard', 'bus-usage'],
    queryFn: dashboardApi.busUsage,
  })

  const { data: driverActivity, isLoading: driverActivityLoading } = useQuery({
    queryKey: ['dashboard', 'driver-activity'],
    queryFn: dashboardApi.driverActivity,
  })

  const positionByBusId = useMemo(() => {
    const map = new Map<string, GpsPosition>()
    for (const p of positions ?? []) map.set(p.busId, p)
    return map
  }, [positions])

  const trendData = useMemo(
    () =>
      (attendanceTrend ?? []).map((p) => ({
        ...p,
        label: new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' }),
      })),
    [attendanceTrend],
  )

  const activeBuses = (buses?.data ?? []).filter((b) => positionByBusId.has(b.busId))

  const fleetBuses: FleetBus[] = activeBuses.map((bus) => {
    const pos = positionByBusId.get(bus.busId)!
    return {
      busId: bus.busId,
      busNumber: bus.busNumber,
      lat: pos.latitude,
      lng: pos.longitude,
      status: bus.status,
      occupancy: bus.currentOccupancy,
      capacity: bus.capacity,
      updatedAt: pos.updatedAt,
    }
  })

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Admin Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {overviewLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatTile index={0} label="Students" value={overview?.totalStudents ?? '—'} icon={Users} />
            <StatTile index={1} label="Drivers" value={overview?.totalDrivers ?? '—'} icon={Contact} />
            <StatTile index={2} label="Buses" value={overview?.totalBuses ?? '—'} icon={BusIcon} />
            <StatTile index={3} label="Active Trips" value={overview?.activeTrips ?? '—'} icon={Navigation} />
            <StatTile index={4} label="Active Passes" value={overview?.activePasses ?? '—'} icon={Ticket} />
            <StatTile
              index={5}
              label="Today's Attendance"
              value={overview?.todayAttendance ?? '—'}
              icon={ClipboardCheck}
            />
          </>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-96 overflow-hidden rounded-2xl lg:col-span-2">
          <FleetMap
            buses={fleetBuses}
            center={SERVICE_AREA_CENTER}
            zoom={DEFAULT_MAP_ZOOM}
            onSelect={(busId) =>
              setSelectedBus((buses?.data ?? []).find((b) => b.busId === busId) ?? null)
            }
          />
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-medium text-slate-700">
            {selectedBus ? selectedBus.busNumber : 'Fleet'}
          </h2>
          {selectedBus ? (
            <div className="space-y-2 text-sm">
              <p className="text-slate-600">
                Status:{' '}
                <span
                  className={
                    selectedBus.status === 'offline'
                      ? 'text-red-600'
                      : selectedBus.status === 'on_trip'
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                  }
                >
                  {selectedBus.status}
                </span>
              </p>
              <p className="text-slate-600">
                Occupancy: {selectedBus.currentOccupancy} / {selectedBus.capacity}
              </p>
              <button
                onClick={() => setSelectedBus(null)}
                className="mt-2 text-xs text-indigo-600 hover:text-indigo-700"
              >
                Clear selection
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {activeBuses.length} bus{activeBuses.length === 1 ? '' : 'es'} reporting live.
              Click a marker for details.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {attendanceTrendLoading ? (
          <SkeletonChart title="Daily Attendance (7 days)" />
        ) : (
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-medium text-slate-700">Daily Attendance (7 days)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} />
                <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a19', border: '1px solid #2c2c2a', borderRadius: 8 }}
                  labelStyle={{ color: '#c3c2b7' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={SEQUENTIAL_BLUE}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SEQUENTIAL_BLUE }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {busUsageLoading ? (
          <SkeletonChart title="Bus Usage (all-time trips)" />
        ) : (
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-medium text-slate-700">Bus Usage (all-time trips)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={busUsage ?? []}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="busNumber" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a19', border: '1px solid #2c2c2a', borderRadius: 8 }}
                  labelStyle={{ color: '#c3c2b7' }}
                />
                <Bar dataKey="tripCount" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {driverActivityLoading ? (
          <SkeletonChart title="Driver Activity (all-time trips)" />
        ) : (
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-medium text-slate-700">Driver Activity (all-time trips)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={driverActivity ?? []}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="driverName" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 11 }} />
                <YAxis stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a19', border: '1px solid #2c2c2a', borderRadius: 8 }}
                  labelStyle={{ color: '#c3c2b7' }}
                />
                <Bar dataKey="tripCount" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {buses && buses.data.length > 0 && (
        <div className="mt-4 card p-5">
          <h2 className="mb-3 text-sm font-medium text-slate-700">Occupancy by Bus</h2>
          <ResponsiveContainer width="100%" height={Math.max(120, buses.data.length * 36)}>
            <BarChart data={buses.data} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" stroke={AXIS_COLOR} tick={{ fill: AXIS_COLOR, fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="busNumber"
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                width={100}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a19', border: '1px solid #2c2c2a', borderRadius: 8 }}
                labelStyle={{ color: '#c3c2b7' }}
              />
              <Bar dataKey="currentOccupancy" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {buses.data.map((bus) => (
                  <Cell
                    key={bus.busId}
                    fill={occupancyColor(bus.capacity > 0 ? bus.currentOccupancy / bus.capacity : 0)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
