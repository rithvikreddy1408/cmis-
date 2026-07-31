import { type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Skeleton } from './Skeleton'

export interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  page,
  totalPages,
  total,
  onPageChange,
  emptyMessage = 'No records found.',
}: {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  loading: boolean
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  emptyMessage?: string
}) {
  return (
    <div className="overflow-hidden card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
              {columns.map((col, i) => (
                <th key={col.header || `col-${i}`} className={`px-4 py-3 font-medium ${col.className ?? ''}`}>
                  {col.header || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r} className="border-b border-slate-800/60 last:border-0">
                  {columns.map((col) => (
                    <td key={col.header} className={`px-4 py-3 ${col.className ?? ''}`}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                  <Inbox className="mx-auto mb-2 h-5 w-5" />
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-slate-800/60 text-slate-300 last:border-0 hover:bg-slate-800/30"
                >
                  {columns.map((col) => (
                    <td key={col.header} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        <span>{total} total</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="rounded-lg p-1.5 hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="rounded-lg p-1.5 hover:bg-slate-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
