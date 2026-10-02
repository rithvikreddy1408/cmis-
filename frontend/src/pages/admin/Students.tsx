import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, Download, KeyRound } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import DataTable, { type Column } from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Banner from '../../components/ui/Banner'
import { TextField } from '../../components/ui/FormField'
import { studentsApi } from '../../services/students.api'
import { busesApi } from '../../services/buses.api'
import type { Student } from '../../types'

interface StudentForm {
  rollNumber: string
  name: string
  branch: string
  year: number
  section: string
  phone: string
  email: string
  rfidUID?: string
}

export default function Students() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Student | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [importSummary, setImportSummary] = useState<Awaited<
    ReturnType<typeof studentsApi.importExcel>
  > | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['students', { search, page }],
    queryFn: () => studentsApi.list({ search, page, pageSize: 10 }),
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
    mutationFn: studentsApi.create,
    onSuccess: ({ student, tempPassword }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setCreating(false)
      notify(
        'success',
        `${student.name} added. Login: ${student.email} · Temporary password: ${tempPassword} (shown once — share securely)`,
      )
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<StudentForm> }) =>
      studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setEditing(null)
      notify('success', 'Student updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: studentsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setDeleting(null)
      notify('success', 'Student removed.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const assignBusMutation = useMutation({
    mutationFn: ({ id, busId }: { id: string; busId: string | null }) =>
      studentsApi.assignBus(id, busId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      notify('success', 'Bus assignment updated.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const importMutation = useMutation({
    mutationFn: studentsApi.importExcel,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
      setImportSummary(result)
      notify(
        result.rejectedCount === 0 ? 'success' : 'error',
        `Import done: ${result.createdCount} created, ${result.rejectedCount} rejected.`,
      )
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) importMutation.mutate(file)
    e.target.value = ''
  }

  // SheetJS loads on click rather than with the page — the roster table should
  // not wait on an export library it may never need.
  async function handleExport() {
    const XLSX = await import('xlsx')
    const rows = (data?.data ?? []).map((s) => ({
      rollNumber: s.rollNumber,
      name: s.name,
      branch: s.branch,
      year: s.year,
      section: s.section,
      phone: s.phone,
      email: s.email,
      rfidUID: s.rfidUID ?? '',
      busAssigned: s.busAssigned ?? '',
      passStatus: s.passStatus,
    }))
    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students')
    XLSX.writeFile(workbook, `students-page${page}.xlsx`)
  }

  const columns: Column<Student>[] = [
    { header: 'Roll No.', accessor: (s) => s.rollNumber },
    { header: 'Name', accessor: (s) => s.name },
    { header: 'Branch', accessor: (s) => s.branch },
    { header: 'Year', accessor: (s) => s.year },
    { header: 'Section', accessor: (s) => s.section },
    { header: 'Email', accessor: (s) => s.email },
    {
      header: 'Bus',
      accessor: (s) => (
        <select
          aria-label={`Bus for ${s.name}`}
          value={s.busAssigned ?? ''}
          onChange={(e) =>
            assignBusMutation.mutate({ id: s.studentId, busId: e.target.value || null })
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
      header: 'Pass',
      accessor: (s) => <PassBadge status={s.passStatus} />,
    },
    {
      header: '',
      accessor: (s) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(s)}
            className="rounded-lg px-2 py-1 text-xs text-indigo-600 hover:bg-slate-200"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleting(s)}
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
        title="Students"
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        onAdd={() => setCreating(true)}
        addLabel="Add Student"
        extra={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleImportClick}
              disabled={importMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-200"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </>
        }
      />

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(s) => s.studentId}
        loading={isLoading}
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={
          search
            ? `No students match "${search}".`
            : 'No students yet — add one or import a class list from Excel.'
        }
      />

      {creating && (
        <StudentFormModal
          title="Add Student"
          submitLabel="Create"
          pending={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <StudentFormModal
          title={`Edit ${editing.name}`}
          submitLabel="Save"
          defaultValues={{ ...editing, rfidUID: editing.rfidUID ?? undefined }}
          lockEmail
          pending={updateMutation.isPending}
          onSubmit={(values) => {
            const { email: _email, ...rest } = values
            updateMutation.mutate({ id: editing.studentId, data: rest })
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete student"
          message={`Remove ${deleting.name} (${deleting.rollNumber})? This also deletes their login.`}
          pending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleting.studentId)}
          onCancel={() => setDeleting(null)}
        />
      )}

      {importSummary && (
        <ImportSummaryModal summary={importSummary} onClose={() => setImportSummary(null)} />
      )}
    </div>
  )
}

function PassBadge({ status }: { status: Student['passStatus'] }) {
  const styles: Record<Student['passStatus'], string> = {
    active: 'bg-emerald-500/15 text-emerald-600',
    expired: 'bg-amber-500/15 text-amber-600',
    revoked: 'bg-red-500/15 text-red-600',
    none: 'bg-slate-300/40 text-slate-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>{status}</span>
  )
}

function StudentFormModal({
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
  defaultValues?: Partial<StudentForm>
  lockEmail?: boolean
  pending: boolean
  onSubmit: (values: StudentForm) => void
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentForm>({ defaultValues })

  function normalizeAndSubmit(values: StudentForm) {
    onSubmit({ ...values, rfidUID: values.rfidUID?.trim() || undefined })
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(normalizeAndSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Roll Number"
            {...register('rollNumber', { required: 'Required' })}
            error={errors.rollNumber?.message}
          />
          <TextField label="Name" {...register('name', { required: 'Required' })} error={errors.name?.message} />
          <TextField label="Branch" {...register('branch', { required: 'Required' })} error={errors.branch?.message} />
          <TextField
            label="Year"
            type="number"
            min={1}
            max={6}
            {...register('year', { required: 'Required', valueAsNumber: true })}
            error={errors.year?.message}
          />
          <TextField label="Section" {...register('section', { required: 'Required' })} error={errors.section?.message} />
          <TextField label="Phone" {...register('phone', { required: 'Required' })} error={errors.phone?.message} />
          <TextField
            label="Email"
            type="email"
            disabled={lockEmail}
            className={lockEmail ? 'opacity-50' : ''}
            {...register('email', { required: 'Required' })}
            error={errors.email?.message}
          />
          <TextField label="RFID UID (optional)" {...register('rfidUID')} />
        </div>

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

function ImportSummaryModal({
  summary,
  onClose,
}: {
  summary: Awaited<ReturnType<typeof studentsApi.importExcel>>
  onClose: () => void
}) {
  return (
    <Modal title="Import results" onClose={onClose} width="max-w-2xl">
      <div className="mb-4 flex gap-4 text-sm">
        <span className="text-emerald-600">{summary.createdCount} created</span>
        <span className="text-red-600">{summary.rejectedCount} rejected</span>
      </div>

      {summary.created.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <KeyRound className="h-4 w-4" /> Temp passwords (shown once)
          </h3>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 text-xs">
            {summary.created.map((c) => (
              <div key={c.row} className="flex justify-between border-b border-slate-200/60 px-3 py-1.5 last:border-0">
                <span className="text-slate-600">{c.email}</span>
                <span className="font-mono text-slate-800">{c.tempPassword}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.rejected.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-700">Rejected rows</h3>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 text-xs">
            {summary.rejected.map((r) => (
              <div key={r.row} className="border-b border-slate-200/60 px-3 py-2 last:border-0">
                <span className="text-slate-600">Row {r.row}: </span>
                <span className="text-red-600">{r.errors}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button onClick={onClose} className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white">
          Close
        </button>
      </div>
    </Modal>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
