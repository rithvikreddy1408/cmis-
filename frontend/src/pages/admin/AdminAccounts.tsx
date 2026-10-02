import { useState } from 'react'
import { KeyRound, ShieldPlus } from 'lucide-react'
import { api } from '../../services/api'
import Banner from '../../components/ui/Banner'
import { TextField } from '../../components/ui/FormField'

function temporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(15))
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 18) + 'a1!'
}

export default function AdminAccounts() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState(temporaryPassword)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function createAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setNotice(null)
    try {
      await api.post('/auth/register', {
        email: email.trim(),
        password,
        displayName: name.trim(),
        role: 'transport_admin',
      })
      setNotice({ kind: 'success', text: `Admin created. Login: ${email.trim()} · Temporary password: ${password}. Share it securely.` })
      setEmail('')
      setName('')
      setPassword(temporaryPassword())
    } catch (error) {
      const response = (error as { response?: { data?: { error?: string } } }).response
      setNotice({ kind: 'error', text: response?.data?.error ?? 'Could not create admin account.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Admin Accounts</h1>
      <p className="mb-5 text-sm text-slate-600">Create a transport admin login. This page is available only to the super admin.</p>
      {notice && <Banner kind={notice.kind} message={notice.text} />}
      <form onSubmit={createAdmin} className="card space-y-4 p-5">
        <TextField label="Admin name" value={name} onChange={(event) => setName(event.target.value)} required />
        <TextField label="Email / login ID" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <div>
          <label className="mb-1 block text-sm text-slate-700" htmlFor="temporary-password">Temporary password</label>
          <div className="flex gap-2">
            <input id="temporary-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required className="w-full rounded-lg input px-3 py-2 text-sm text-slate-900" />
            <button type="button" aria-label="Generate new temporary password" onClick={() => setPassword(temporaryPassword())} className="rounded-lg border border-slate-300 px-3 text-slate-700 hover:bg-slate-200"><KeyRound className="h-4 w-4" /></button>
          </div>
        </div>
        <button disabled={pending} className="flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          <ShieldPlus className="h-4 w-4" />{pending ? 'Creating…' : 'Create transport admin'}
        </button>
      </form>
    </div>
  )
}
