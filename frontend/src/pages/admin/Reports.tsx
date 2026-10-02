import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Loader2 } from 'lucide-react'
import { TextField, SelectField } from '../../components/ui/FormField'
import StudentPicker from '../../components/ui/StudentPicker'
import { reportsApi } from '../../services/reports.api'
import { busesApi } from '../../services/buses.api'
import { driversApi } from '../../services/drivers.api'
import type { Student } from '../../types'

type Tab = 'attendance' | 'student' | 'bus' | 'driver'

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

// jsPDF and SheetJS are ~400kB of the chunk this page would otherwise ship
// before rendering a single row. Loaded on click instead, so the report data
// paints immediately and the export toolchain only downloads if it is used.
async function exportPdf(title: string, head: string[], rows: (string | number)[][]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('CMIS — ' + title, 14, 16)
  doc.setFontSize(9)
  doc.text(new Date().toLocaleString(), 14, 22)
  autoTable(doc, { head: [head], body: rows, startY: 28, styles: { fontSize: 8 } })
  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}

async function exportExcel<T extends object>(title: string, rows: T[]) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, title.slice(0, 30))
  XLSX.writeFile(workbook, `${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`)
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>('attendance')
  const tabs: { id: Tab; label: string }[] = [
    { id: 'attendance', label: 'Attendance' },
    { id: 'student', label: 'Student' },
    { id: 'bus', label: 'Bus' },
    { id: 'driver', label: 'Driver' },
  ]

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Reports</h1>

      <div className="mb-5 flex gap-2 border-b border-slate-200">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`border-b-2 px-4 py-2 text-sm transition ${
              tab === id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'student' && <StudentTab />}
      {tab === 'bus' && <BusTab />}
      {tab === 'driver' && <DriverTab />}
    </div>
  )
}

function DateRangeInputs({
  range,
  setRange,
}: {
  range: { startDate: string; endDate: string }
  setRange: (r: { startDate: string; endDate: string }) => void
}) {
  return (
    <div className="flex gap-3">
      <TextField
        label="From"
        type="date"
        value={range.startDate}
        onChange={(e) => setRange({ ...range, startDate: e.target.value })}
      />
      <TextField
        label="To"
        type="date"
        value={range.endDate}
        onChange={(e) => setRange({ ...range, endDate: e.target.value })}
      />
    </div>
  )
}

function AttendanceTab() {
  const [range, setRange] = useState(defaultRange())
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['reports', 'attendance', range],
    queryFn: () => reportsApi.attendance(range),
  })

  return (
    <div>
      <div className="mb-4 flex items-end gap-3">
        <DateRangeInputs range={range} setRange={setRange} />
        <button
          onClick={() => refetch()}
          className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white"
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run'}
        </button>
        {data && data.length > 0 && (
          <>
            <button
              onClick={() =>
                exportPdf(
                  'Attendance Report',
                  ['Date', 'Time', 'Student', 'Roll No.', 'Bus', 'Stop'],
                  data.map((r) => [
                    r.date,
                    new Date(r.boardingTime).toLocaleTimeString(),
                    r.studentName,
                    r.rollNumber,
                    r.busNumber,
                    r.boardingStop ?? '—',
                  ]),
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
            <button
              onClick={() => exportExcel('Attendance Report', data)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              <Download className="h-4 w-4" /> Excel
            </button>
          </>
        )}
      </div>

      <div className="overflow-hidden card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Roll No.</th>
              <th className="px-4 py-3">Bus</th>
              <th className="px-4 py-3">Stop</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                  Loading…
                </td>
              </tr>
            ) : !data?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                  No records in this range.
                </td>
              </tr>
            ) : (
              data.map((r, i) => (
                <tr key={i} className="border-b border-slate-200/60 text-slate-700 last:border-0">
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">{new Date(r.boardingTime).toLocaleTimeString()}</td>
                  <td className="px-4 py-3">{r.studentName}</td>
                  <td className="px-4 py-3">{r.rollNumber}</td>
                  <td className="px-4 py-3">{r.busNumber}</td>
                  <td className="px-4 py-3">{r.boardingStop ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StudentTab() {
  const [range, setRange] = useState(defaultRange())
  const [student, setStudent] = useState<Student | null>(null)
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['reports', 'student', student?.studentId, range],
    queryFn: () => reportsApi.student(student!.studentId, range),
    enabled: false,
  })

  return (
    <div className="max-w-xl space-y-4">
      <StudentPicker selected={student} onSelect={setStudent} />
      <DateRangeInputs range={range} setRange={setRange} />
      <button
        onClick={() => refetch()}
        disabled={!student}
        className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Report'}
      </button>

      {data && (
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-slate-900">
            {data.studentName} ({data.rollNumber})
          </h3>
          <p className="text-sm text-slate-600">Days boarded: {data.daysBoarded}</p>
          <p className="text-sm text-slate-600">Bus active days: {data.busActiveDays}</p>
          <p className="text-sm text-slate-600">
            Attendance: {data.attendancePercent != null ? `${data.attendancePercent}%` : 'n/a'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() =>
                exportPdf(
                  `Student Report - ${data.rollNumber}`,
                  ['Date', 'Time', 'Bus', 'Stop'],
                  data.records.map((r) => [
                    r.date,
                    new Date(r.boardingTime).toLocaleTimeString(),
                    r.busNumber,
                    r.boardingStop ?? '—',
                  ]),
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
            <button
              onClick={() => exportExcel(`Student Report ${data.rollNumber}`, data.records)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              <Download className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BusTab() {
  const [range, setRange] = useState(defaultRange())
  const [busId, setBusId] = useState('')
  const { data: buses } = useQuery({ queryKey: ['buses', 'for-reports'], queryFn: () => busesApi.list({ pageSize: 200 }) })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['reports', 'bus', busId, range],
    queryFn: () => reportsApi.bus(busId, range),
    enabled: false,
  })

  return (
    <div className="max-w-xl space-y-4">
      <SelectField label="Bus" value={busId} onChange={(e) => setBusId(e.target.value)}>
        <option value="">Select a bus…</option>
        {(buses?.data ?? []).map((b) => (
          <option key={b.busId} value={b.busId}>
            {b.busNumber}
          </option>
        ))}
      </SelectField>
      <DateRangeInputs range={range} setRange={setRange} />
      <button
        onClick={() => refetch()}
        disabled={!busId}
        className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Report'}
      </button>

      {data && (
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-slate-900">{data.busNumber}</h3>
          <p className="text-sm text-slate-600">Trips: {data.tripCount}</p>
          <p className="text-sm text-slate-600">Total distance: {data.totalDistanceKm} km</p>
          <p className="text-sm text-slate-600">Avg peak occupancy: {data.avgPeakOccupancy}</p>
        </div>
      )}
    </div>
  )
}

function DriverTab() {
  const [range, setRange] = useState(defaultRange())
  const [driverId, setDriverId] = useState('')
  const { data: drivers } = useQuery({
    queryKey: ['drivers', 'for-reports'],
    queryFn: () => driversApi.list({ pageSize: 200 }),
  })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['reports', 'driver', driverId, range],
    queryFn: () => reportsApi.driver(driverId, range),
    enabled: false,
  })

  return (
    <div className="max-w-xl space-y-4">
      <SelectField label="Driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
        <option value="">Select a driver…</option>
        {(drivers?.data ?? []).map((d) => (
          <option key={d.driverId} value={d.driverId}>
            {d.name}
          </option>
        ))}
      </SelectField>
      <DateRangeInputs range={range} setRange={setRange} />
      <button
        onClick={() => refetch()}
        disabled={!driverId}
        className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Report'}
      </button>

      {data && (
        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-slate-900">{data.driverName}</h3>
          <p className="text-sm text-slate-600">Trips: {data.tripCount}</p>
          <p className="text-sm text-slate-600">Driving hours: {data.totalDrivingHours}</p>
          <p className="text-sm text-slate-600">Total distance: {data.totalDistanceKm} km</p>
        </div>
      )}
    </div>
  )
}
