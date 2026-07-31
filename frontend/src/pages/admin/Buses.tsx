import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import DataTable, { type Column } from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Banner from '../../components/ui/Banner'
import LiveDot from '../../components/ui/LiveDot'
import { TextField, SelectField } from '../../components/ui/FormField'
import { busesApi } from '../../services/buses.api'
import { driversApi } from '../../services/drivers.api'
import { routesApi } from '../../services/routes.api'
import type { Bus } from '../../types'

interface BusForm {
  busNumber: string
  capacity: number
  status: Bus['status']
}

export default function Buses() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Bus | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Bus | null>(null)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['buses', { search, page }],
    queryFn: () => busesApi.list({ search, page, pageSize: 10 }),
  })

  const { data: drivers } = useQuery({
    queryKey: ['drivers', 'all-for-assign'],
    queryFn: () => driversApi.list({ pageSize: 200 }),
  })

  const { data: routes } = useQuery({
    queryKey: ['routes', 'all-for-assign'],
    queryFn: () => routesApi.list({ pageSize: 200 }),
  })

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['buses'] })
    queryClient.invalidateQueries({ queryKey: ['drivers'] })
    queryClient.invalidateQueries({ queryKey: ['students'] })
  }

  const createMutation = useMutation({
    mutationFn: busesApi.create,
    onSuccess: (bus) => {
      invalidateAll()
      setCreating(false)
      notify('success', `Bus ${bus.busNumber} added.`)
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BusForm> }) => busesApi.update(id, data),
    onSuccess: () => {
      invalidateAll()
      setEditing(null)
      notify('success', 'Bus updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: busesApi.remove,
    onSuccess: () => {
      invalidateAll()
      setDeleting(null)
      notify('success', 'Bus removed.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const assignDriverMutation = useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string | null }) =>
      busesApi.assignDriver(id, driverId),
    onSuccess: () => {
      invalidateAll()
      notify('success', 'Driver assignment updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const assignRouteMutation = useMutation({
    mutationFn: ({ id, routeId }: { id: string; routeId: string | null }) =>
      busesApi.assignRoute(id, routeId),
    onSuccess: () => {
      invalidateAll()
      notify('success', 'Route assignment updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const columns: Column<Bus>[] = [
    { header: 'Bus Number', accessor: (b) => b.busNumber },
    { header: 'Capacity', accessor: (b) => `${b.currentOccupancy}/${b.capacity}` },
    { header: 'Status', accessor: (b) => <StatusBadge status={b.status} /> },
    {
      header: 'Driver',
      accessor: (b) => (
        <select
          aria-label={`Driver for ${b.busNumber}`}
          value={b.driverId ?? ''}
          onChange={(e) =>
            assignDriverMutation.mutate({ id: b.busId, driverId: e.target.value || null })
          }
          className="rounded-lg input px-2 py-1 text-xs text-slate-200"
        >
          <option value="">Unassigned</option>
          {(drivers?.data ?? []).map((d) => (
            <option key={d.driverId} value={d.driverId}>
              {d.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      header: 'Route',
      accessor: (b) => (
        <select
          aria-label={`Route for ${b.busNumber}`}
          value={b.routeId ?? ''}
          onChange={(e) =>
            assignRouteMutation.mutate({ id: b.busId, routeId: e.target.value || null })
          }
          className="rounded-lg input px-2 py-1 text-xs text-slate-200"
        >
          <option value="">Unassigned</option>
          {(routes?.data ?? []).map((r) => (
            <option key={r.routeId} value={r.routeId}>
              {r.routeName}
            </option>
          ))}
        </select>
      ),
    },
    {
      header: '',
      accessor: (b) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(b)} className="rounded-lg px-2 py-1 text-xs text-indigo-400 hover:bg-slate-800">
            Edit
          </button>
          <button onClick={() => setDeleting(b)} className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-slate-800">
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
        title="Buses"
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        onAdd={() => setCreating(true)}
        addLabel="Add Bus"
      />

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(b) => b.busId}
        loading={isLoading}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={
          search ? `No buses match "${search}".` : 'No buses yet — add your fleet to start tracking trips.'
        }
      />

      {creating && (
        <BusFormModal
          title="Add Bus"
          submitLabel="Create"
          pending={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <BusFormModal
          title={`Edit ${editing.busNumber}`}
          submitLabel="Save"
          defaultValues={editing}
          pending={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate({ id: editing.busId, data: values })}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete bus"
          message={`Remove bus ${deleting.busNumber}? This unassigns its driver and all students on it.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.busId)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Bus['status'] }) {
  const styles: Record<Bus['status'], string> = {
    idle: 'bg-slate-700/40 text-slate-400',
    on_trip: 'bg-indigo-500/15 text-indigo-400',
    offline: 'bg-red-500/15 text-red-400',
    maintenance: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {status === 'on_trip' && <LiveDot color="indigo" />}
      {status}
    </span>
  )
}

function BusFormModal({
  title,
  submitLabel,
  defaultValues,
  pending,
  onSubmit,
  onClose,
}: {
  title: string
  submitLabel: string
  defaultValues?: Partial<BusForm>
  pending: boolean
  onSubmit: (values: BusForm) => void
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BusForm>({ defaultValues: { status: 'idle', ...defaultValues } })

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField
          label="Bus Number"
          {...register('busNumber', { required: 'Required' })}
          error={errors.busNumber?.message}
        />
        <TextField
          label="Capacity"
          type="number"
          min={1}
          max={200}
          {...register('capacity', { required: 'Required', valueAsNumber: true })}
          error={errors.capacity?.message}
        />
        <SelectField label="Status" {...register('status')}>
          <option value="idle">Idle</option>
          <option value="on_trip">On Trip</option>
          <option value="offline">Offline</option>
          <option value="maintenance">Maintenance</option>
        </SelectField>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
