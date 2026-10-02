import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bus, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { roleHome } from '../../utils/roleHome'
import { auth } from '../../services/firebase'

interface LoginForm {
  email: string
  password: string
  rememberMe: boolean
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Incorrect email or password.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  return 'Something went wrong signing you in. Please try again.'
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ defaultValues: { rememberMe: true } })

  async function onSubmit(data: LoginForm) {
    setServerError(null)
    try {
      await login(data.email, data.password, data.rememberMe)
      const result = await auth.currentUser?.getIdTokenResult()
      const role = (result?.claims.role as string | undefined) ?? null
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? roleHome(role as never), { replace: true })
    } catch (err) {
      setServerError(friendlyAuthError(err))
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center px-4 text-slate-900">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm card p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_30px_-6px_theme(colors.indigo.500)]">
            <Bus className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Sign in to CMIS</h1>
            <p className="text-sm text-slate-600">Campus Mobility Intelligence</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg input px-3 py-2 text-sm"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg input px-3 py-2 text-sm"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                className="rounded border-slate-300 bg-slate-50 text-indigo-600 accent-indigo-500"
                {...register('rememberMe')}
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-700">
              Forgot password?
            </Link>
          </div>

          {serverError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-2 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>
        </form>
      </motion.div>
    </main>
  )
}
