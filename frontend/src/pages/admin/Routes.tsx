import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import DataTable, { type Column } from '../../components/ui/DataTable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Banner from '../../components/ui/Banner'
import { routesApi } from '../../services/routes.api'
import type { BusRoute } from '../../types'

export default function Routes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<BusRoute | null>(null)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['routes', { search, page }],
    queryFn: () => routesApi.list({ search, page, pageSize: 10 }),
  })

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const deleteMutation = useMutation({
    mutationFn: routesApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      setDeleting(null)
      notify('success', 'Route removed.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const columns: Column<BusRoute>[] = [
    { header: 'Route Name', accessor: (r) => r.routeName },
    { header: 'Start', accessor: (r) => r.startPoint },
    { header: 'Destination', accessor: (r) => r.destination },
    { header: 'Stops', accessor: (r) => r.stops.length },
    {
      header: 'Distance (km)',
      accessor: (r) => r.distance ?? <span className="text-slate-600">—</span>,
    },
    {
      header: 'ETA (min)',
      accessor: (r) => r.expectedTime ?? <span className="text-slate-600">—</span>,
    },
    {
      header: '',
      accessor: (r) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => navigate(`/admin/routes/${r.routeId}/edit`)}
            className="rounded-lg px-2 py-1 text-xs text-indigo-600 hover:bg-slate-200"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleting(r)}
            className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-slate-200"
          >
            Delete
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Routes"
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        onAdd={() => navigate('/admin/routes/new')}
        addLabel="Build Route"
      />

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(r) => r.routeId}
        loading={isLoading}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={
          search ? `No routes match "${search}".` : 'No routes yet — draw your first one on the map.'
        }
      />

      {deleting && (
        <ConfirmDialog
          title="Delete route"
          message={`Remove "${deleting.routeName}"? Buses still assigned to this route will block deletion.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.routeId)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
