import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/ui/PageHeader'
import DataTable, { type Column } from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Banner from '../../components/ui/Banner'
import { TextField } from '../../components/ui/FormField'
import { driversApi } from '../../services/drivers.api'
import { busesApi } from '../../services/buses.api'
import type { Driver } from '../../types'

interface DriverForm {
  name: string
  phone: string
  email: string
  licenseNumber: string
  password?: string
}

export default function Drivers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Driver | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Driver | null>(null)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', { search, page }],
    queryFn: () => driversApi.list({ search, page, pageSize: 10 }),
  })

  const { data: buses } = useQuery({
    queryKey: ['buses', 'all-for-assign'],
    queryFn: () => busesApi.list({ pageSize: 200 }),
  })

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const createMutation = useMutation({
    mutationFn: driversApi.create,
    onSuccess: ({ driver, tempPassword }, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      setCreating(false)
      // Only warn about losing it when the admin did not choose it themselves.
      notify(
        'success',
        `${driver.name} added. Login: ${driver.email} · Password: ${tempPassword}` +
          ((variables as { password?: string }).password?.trim()
            ? ''
            : ' (generated, shown once — copy it now)'),
      )
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DriverForm> }) =>
      driversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      setEditing(null)
      notify('success', 'Driver updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: driversApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      queryClient.invalidateQueries({ queryKey: ['buses'] })
      setDeleting(null)
      notify('success', 'Driver removed.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const assignBusMutation = useMutation({
    mutationFn: ({ id, busId }: { id: string; busId: string | null }) =>
      driversApi.assignBus(id, busId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] })
      queryClient.invalidateQueries({ queryKey: ['buses'] })
      notify('success', 'Bus assignment updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const columns: Column<Driver>[] = [
    { header: 'Name', accessor: (d) => d.name },
    { header: 'Phone', accessor: (d) => d.phone },
    { header: 'Email', accessor: (d) => d.email },
    { header: 'License', accessor: (d) => d.licenseNumber },
    { header: 'Status', accessor: (d) => <StatusBadge status={d.status} /> },
    {
      header: 'Assigned Bus',
      accessor: (d) => (
        <select
          aria-label={`Bus for ${d.name}`}
          value={d.busAssigned ?? ''}
          onChange={(e) =>
            assignBusMutation.mutate({ id: d.driverId, busId: e.target.value || null })
          }
          className="rounded-lg input px-2 py-1 text-xs text-slate-800"
        >
          <option value="">Unassigned</option>
          {(buses?.data ?? []).map((b) => (
            <option key={b.busId} value={b.busId}>
              {b.busNumber}
            </option>
          ))}
        </select>
      ),
    },
    {
      header: '',
      accessor: (d) => (
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(d)} className="rounded-lg px-2 py-1 text-xs text-indigo-600 hover:bg-slate-200">
            Edit
          </button>
          <button onClick={() => setDeleting(d)} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-slate-200">
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
        title="Drivers"
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        onAdd={() => setCreating(true)}
        addLabel="Add Driver"
      />

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(d) => d.driverId}
        loading={isLoading}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={
          search ? `No drivers match "${search}".` : 'No drivers yet — add your first one to assign them to a bus.'
        }
      />

      {creating && (
        <DriverFormModal
          title="Add Driver"
          submitLabel="Create"
          pending={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <DriverFormModal
          title={`Edit ${editing.name}`}
          submitLabel="Save"
          defaultValues={editing}
          lockEmail
          pending={updateMutation.isPending}
          onSubmit={(values) => {
            const { email: _email, ...rest } = values
            updateMutation.mutate({ id: editing.driverId, data: rest })
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete driver"
          message={`Remove ${deleting.name}? This also deletes their login and unassigns their bus.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.driverId)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Driver['status'] }) {
  const styles: Record<Driver['status'], string> = {
    active: 'bg-emerald-500/15 text-emerald-600',
    inactive: 'bg-slate-300/40 text-slate-600',
    on_trip: 'bg-indigo-500/15 text-indigo-600',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>{status}</span>
}

function DriverFormModal({
  title,
  submitLabel,
  defaultValues,
  lockEmail,
  pending,
  onSubmit,
  onClose,
}: {
  title: string
  submitLabel: string
  defaultValues?: Partial<DriverForm>
  lockEmail?: boolean
  pending: boolean
  onSubmit: (values: DriverForm) => void
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DriverForm>({ defaultValues })

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <TextField label="Name" {...register('name', { required: 'Required' })} error={errors.name?.message} />
        <TextField label="Phone" {...register('phone', { required: 'Required' })} error={errors.phone?.message} />
        <TextField
          label="Email"
          type="email"
          disabled={lockEmail}
          className={lockEmail ? 'opacity-50' : ''}
          {...register('email', { required: 'Required' })}
          error={errors.email?.message}
        />
        <TextField
          label="License Number"
          {...register('licenseNumber', { required: 'Required' })}
          error={errors.licenseNumber?.message}
        />

        {!lockEmail && (
          <div>
            <TextField
              label="Password (optional)"
              type="text"
              autoComplete="new-password"
              placeholder="Leave blank to generate one automatically"
              {...register('password', {
                minLength: { value: 6, message: 'At least 6 characters' },
              })}
              error={errors.password?.message}
            />
            <p className="mt-1 text-xs text-slate-600">
              Set one here to hand it to the driver directly. Left blank, a random password is
              generated and shown once after saving — if that is missed, it cannot be recovered and
              the account needs a reset.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-200">
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
