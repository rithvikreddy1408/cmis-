import { type ReactNode } from 'react'
import { Plus, Search } from 'lucide-react'

export default function PageHeader({
  title,
  search,
  onSearchChange,
  onAdd,
  addLabel = 'Add',
  extra,
}: {
  title: string
  search: string
  onSearchChange: (value: string) => void
  onAdd?: () => void
  addLabel?: string
  extra?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-56 rounded-lg input py-2 pl-9 pr-3 text-sm text-slate-900"
          />
        </div>
        {extra}
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-lg btn-primary px-3 py-2 text-sm font-medium text-white transition"
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}
