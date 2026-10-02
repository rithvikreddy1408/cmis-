import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, User } from 'lucide-react'
import { studentsApi } from '../../services/students.api'
import type { Student } from '../../types'

export default function StudentPicker({
  onSelect,
  selected,
}: {
  onSelect: (student: Student) => void
  selected: Student | null
}) {
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['students', 'picker', search],
    queryFn: () => studentsApi.list({ search, page: 1, pageSize: 8 }),
    enabled: search.trim().length > 0,
  })

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student by name, roll number, or email..."
          className="w-full rounded-lg input py-2 pl-9 pr-3 text-sm text-slate-900"
        />
      </div>

      {search.trim() && (data?.data.length ?? 0) > 0 && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
          {data!.data.map((s) => (
            <button
              key={s.studentId}
              onClick={() => {
                onSelect(s)
                setSearch('')
              }}
              className="flex w-full items-center gap-2 border-b border-slate-200/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-200/40"
            >
              <User className="h-4 w-4 text-slate-600" />
              <span className="text-slate-800">{s.name}</span>
              <span className="text-slate-600">{s.rollNumber}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">
          <User className="h-4 w-4 text-indigo-600" />
          <span className="text-slate-800">{selected.name}</span>
          <span className="text-slate-600">{selected.rollNumber}</span>
        </div>
      )}
    </div>
  )
}
