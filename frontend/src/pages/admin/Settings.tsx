import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2 } from 'lucide-react'
import Banner from '../../components/ui/Banner'
import { TextField } from '../../components/ui/FormField'
import { settingsApi } from '../../services/settings.api'

export default function Settings() {
  const queryClient = useQueryClient()
  const [geofenceRadiusKm, setGeofenceRadiusKm] = useState('')
  const [defaultPassDurationDays, setDefaultPassDurationDays] = useState('')
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })

  useEffect(() => {
    if (data) {
      setGeofenceRadiusKm(String(data.geofenceRadiusKm))
      setDefaultPassDurationDays(String(data.defaultPassDurationDays))
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: () =>
      settingsApi.update({
        geofenceRadiusKm: Number(geofenceRadiusKm),
        defaultPassDurationDays: Number(defaultPassDurationDays),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setBanner({ kind: 'success', message: 'Settings saved.' })
      setTimeout(() => setBanner(null), 6000)
    },
    onError: () => {
      setBanner({ kind: 'error', message: 'Could not save settings.' })
      setTimeout(() => setBanner(null), 6000)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Settings</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Settings</h1>

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <div className="space-y-4 card p-6">
        <div>
          <TextField
            label="Geofence Radius (km)"
            type="number"
            step="0.05"
            min="0.05"
            max="2"
            value={geofenceRadiusKm}
            onChange={(e) => setGeofenceRadiusKm(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-600">
            How close a bus must be to a stop before students get a "bus near your stop"
            notification.
          </p>
        </div>

        <div>
          <TextField
            label="Default Pass Duration (days)"
            type="number"
            min="1"
            max="730"
            value={defaultPassDurationDays}
            onChange={(e) => setDefaultPassDurationDays(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-600">
            Suggested expiry length when issuing a new bus pass.
          </p>
        </div>

        <button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  )
}
