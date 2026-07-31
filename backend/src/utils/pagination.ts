export interface PageResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  }
}

export function matchesSearch(haystack: (string | null | undefined)[], search?: string): boolean {
  if (!search) return true
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return haystack.some((value) => value?.toLowerCase().includes(needle))
}
