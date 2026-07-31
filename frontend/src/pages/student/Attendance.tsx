import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { studentsApi } from '../../services/students.api'

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function Attendance() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const { data, isLoading } = useQuery({
    queryKey: ['students', 'me', 'attendance', month],
    queryFn: () => studentsApi.myAttendance(month),
  })

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const grouped = useMemo(() => {
    const map = new Map<string, typeof data>()
    for (const record of data ?? []) {
      if (!map.has(record.date)) map.set(record.date, [])
      map.get(record.date)!.push(record)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [data])

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Attendance</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-40 text-center text-sm text-slate-300">{monthLabel(month)}</span>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-slate-400">No boarding records for this month.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map(([date, records]) => (
            <div
              key={date}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-slate-200">
                  {new Date(date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <span className="text-sm text-slate-400">
                {records?.[0] && new Date(records[0].boardingTime).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-slate-400">
        {grouped.length} day{grouped.length === 1 ? '' : 's'} boarded in {monthLabel(month)}.
      </p>
    </div>
  )
}
