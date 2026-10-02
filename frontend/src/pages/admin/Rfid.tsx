import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Cpu, TriangleAlert, Copy, Check, KeyRound } from 'lucide-react'
import Banner from '../../components/ui/Banner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StudentPicker from '../../components/ui/StudentPicker'
import { SelectField, TextField } from '../../components/ui/FormField'
import { devicesApi } from '../../services/devices.api'
import { rfidApi } from '../../services/rfid.api'
import { studentsApi } from '../../services/students.api'
import { busesApi } from '../../services/buses.api'
import type { Student } from '../../types'

type Tab = 'devices' | 'cards' | 'rejections'

export default function Rfid() {
  const [tab, setTab] = useState<Tab>('devices')

  const tabs: { id: Tab; label: string; icon: typeof Cpu }[] = [
    { id: 'devices', label: 'Devices', icon: Cpu },
    { id: 'cards', label: 'Card Management', icon: CreditCard },
    { id: 'rejections', label: 'Rejections Log', icon: TriangleAlert },
  ]

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-900">RFID Management</h1>

      <div className="mb-5 flex gap-2 border-b border-slate-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition ${
              tab === id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'devices' && <DevicesTab />}
      {tab === 'cards' && <CardsTab />}
      {tab === 'rejections' && <RejectionsTab />}
    </div>
  )
}

function DevicesTab() {
  const queryClient = useQueryClient()
  const [provisioning, setProvisioning] = useState(false)
  const [newKey, setNewKey] = useState<{ deviceId: string; rawKey: string } | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [busId, setBusId] = useState('')

  const { data: devices, isLoading } = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list })
  const { data: buses } = useQuery({
    queryKey: ['buses', 'all-for-devices'],
    queryFn: () => busesApi.list({ pageSize: 200 }),
  })

  const provisionMutation = useMutation({
    mutationFn: () => devicesApi.provision(busId),
    onSuccess: ({ device, rawKey }) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setProvisioning(false)
      setNewKey({ deviceId: device.deviceId, rawKey })
      setBusId('')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: devicesApi.revoke,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setRevoking(null)
    },
  })

  const busNumber = (id: string) => buses?.data.find((b) => b.busId === id)?.busNumber ?? id

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setProvisioning(true)}
          className="rounded-lg btn-primary px-3 py-2 text-sm font-medium text-white"
        >
          Provision Device
        </button>
      </div>

      <div className="overflow-hidden card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
              <th className="px-4 py-3">Device ID</th>
              <th className="px-4 py-3">Bus</th>
              <th className="px-4 py-3">Last Seen</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                  Loading…
                </td>
              </tr>
            ) : !devices?.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                  No devices provisioned yet.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.deviceId} className="border-b border-slate-200/60 text-slate-700 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{d.deviceId}</td>
                  <td className="px-4 py-3">{busNumber(d.busId)}</td>
                  <td className="px-4 py-3">
                    {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setRevoking(d.deviceId)}
                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-slate-200"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {provisioning && (
        <Modal title="Provision RFID Reader" onClose={() => setProvisioning(false)}>
          <div className="space-y-4">
            <SelectField label="Assign to Bus" value={busId} onChange={(e) => setBusId(e.target.value)}>
              <option value="">Select a bus…</option>
              {(buses?.data ?? []).map((b) => (
                <option key={b.busId} value={b.busId}>
                  {b.busNumber}
                </option>
              ))}
            </SelectField>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProvisioning(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => provisionMutation.mutate()}
                disabled={!busId || provisionMutation.isPending}
                className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Provision
              </button>
            </div>
          </div>
        </Modal>
      )}

      {newKey && <DeviceKeyModal deviceId={newKey.deviceId} rawKey={newKey.rawKey} onClose={() => setNewKey(null)} />}

      {revoking && (
        <ConfirmDialog
          title="Revoke device"
          message="This reader will immediately stop being able to record attendance taps."
          confirmLabel="Revoke"
          pending={revokeMutation.isPending}
          onConfirm={() => revokeMutation.mutate(revoking)}
          onCancel={() => setRevoking(null)}
        />
      )}
    </div>
  )
}

function DeviceKeyModal({
  deviceId,
  rawKey,
  onClose,
}: {
  deviceId: string
  rawKey: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal title="Device provisioned" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-600">
          <KeyRound className="h-4 w-4 shrink-0" />
          This key is shown once. Copy it into the reader's firmware config now.
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-600">Device ID</p>
          <code className="block rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{deviceId}</code>
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-600">Device Key</p>
          <div className="flex gap-2">
            <code className="flex-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{rawKey}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(rawKey)
                setCopied(true)
              }}
              className="rounded-lg border border-slate-300 px-3 text-slate-700 hover:bg-slate-200"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full rounded-lg btn-primary py-2 text-sm font-medium text-white"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

function CardsTab() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Student | null>(null)
  const [newUid, setNewUid] = useState('')
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  // Live data for the selected student — `selected` is a snapshot from the
  // picker at click time and goes stale after any mutation below.
  const { data: current } = useQuery({
    queryKey: ['student', selected?.studentId],
    queryFn: () => studentsApi.get(selected!.studentId),
    enabled: Boolean(selected),
  })

  const { data: history } = useQuery({
    queryKey: ['rfid-history', selected?.studentId],
    queryFn: () => rfidApi.history(selected!.studentId),
    enabled: Boolean(selected),
  })

  const invalidateStudent = () => {
    queryClient.invalidateQueries({ queryKey: ['rfid-history'] })
    queryClient.invalidateQueries({ queryKey: ['students'] })
    queryClient.invalidateQueries({ queryKey: ['student', selected?.studentId] })
  }

  const assignMutation = useMutation({
    mutationFn: () => rfidApi.assign(selected!.studentId, newUid),
    onSuccess: () => {
      invalidateStudent()
      setNewUid('')
      notify('success', 'Card assigned.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const lostMutation = useMutation({
    mutationFn: () => rfidApi.reportLost(selected!.studentId),
    onSuccess: () => {
      invalidateStudent()
      notify('success', 'Card marked lost. Student can no longer board until reassigned.')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: () => rfidApi.deactivate(selected!.studentId),
    onSuccess: () => {
      invalidateStudent()
      notify('success', 'Card deactivated.')
    },
  })

  return (
    <div className="max-w-xl space-y-4">
      {banner && <Banner kind={banner.kind} message={banner.message} />}
      <StudentPicker selected={selected} onSelect={setSelected} />

      {selected && (
        <div className="space-y-4 card p-5">
          <div>
            <p className="mb-1 text-sm text-slate-600">Current card</p>
            <p className="font-mono text-sm text-slate-800">
              {(current?.rfidUID ?? selected.rfidUID) ?? 'None assigned'}
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="Assign / Replace Card (RFID UID)"
                value={newUid}
                onChange={(e) => setNewUid(e.target.value)}
                placeholder="Scan or type UID"
              />
            </div>
            <button
              onClick={() => assignMutation.mutate()}
              disabled={!newUid.trim() || assignMutation.isPending}
              className="mb-0.5 rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Assign
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => lostMutation.mutate()}
              disabled={!(current?.rfidUID ?? selected.rfidUID) || lostMutation.isPending}
              className="flex-1 rounded-lg border border-amber-300 py-2 text-sm text-amber-600 hover:bg-amber-100 disabled:opacity-40"
            >
              Report Lost
            </button>
            <button
              onClick={() => deactivateMutation.mutate()}
              disabled={!(current?.rfidUID ?? selected.rfidUID) || deactivateMutation.isPending}
              className="flex-1 rounded-lg border border-red-300 py-2 text-sm text-red-600 hover:bg-red-100 disabled:opacity-40"
            >
              Deactivate
            </button>
          </div>

          {history && history.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-slate-700">Card history</p>
              <div className="space-y-1.5">
                {history.map((card) => (
                  <div key={card.rfidUID} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span className="font-mono">{card.rfidUID}</span>
                      <span
                        className={
                          card.status === 'active'
                            ? 'text-emerald-600'
                            : card.status === 'lost'
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }
                      >
                        {card.status}
                      </span>
                    </div>
                    {card.history.map((h, i) => (
                      <div key={i} className="mt-1 text-slate-600">
                        {h.event} — {new Date(h.at).toLocaleString()}
                        {h.note ? ` (${h.note})` : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RejectionsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['rfid-rejections'],
    queryFn: rfidApi.rejections,
    refetchInterval: 15_000,
  })

  return (
    <div className="overflow-hidden card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">RFID UID</th>
            <th className="px-4 py-3">Reason</th>
            <th className="px-4 py-3">Device</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                Loading…
              </td>
            </tr>
          ) : !data?.length ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-slate-600">
                No rejected taps.
              </td>
            </tr>
          ) : (
            data.map((r) => (
              <tr key={r.rejectionId} className="border-b border-slate-200/60 text-slate-700 last:border-0">
                <td className="px-4 py-3">{new Date(r.at).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.rfidUID}</td>
                <td className="px-4 py-3 text-red-600">{r.reason}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.deviceId}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
