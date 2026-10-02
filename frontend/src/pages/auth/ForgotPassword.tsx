import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Bus, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface ForgotPasswordForm {
  email: string
}

export default function ForgotPassword() {
  const { forgotPassword } = useAuth()
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>()

  async function onSubmit(data: ForgotPasswordForm) {
    setServerError(null)
    try {
      await forgotPassword(data.email)
      setSent(true)
    } catch {
      // Don't reveal whether the email exists — same message either way.
      setSent(true)
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
            <h1 className="text-lg font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-slate-600">We'll email you a reset link</p>
          </div>
        </div>

        {sent ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              If an account exists for that email, a reset link is on its way.
            </span>
          </div>
        ) : (
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
              Send reset link
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 block text-center text-sm text-indigo-600 hover:text-indigo-700"
        >
          Back to sign in
        </Link>
      </motion.div>
    </main>
  )
}
