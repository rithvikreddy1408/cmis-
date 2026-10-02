import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bus, LogOut, Menu, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ConnectionBanner from '../ui/ConnectionBanner'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  badge?: number
}

function Logo({ roleLabel }: { roleLabel: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_20px_-4px_theme(colors.indigo.500)]">
        <Bus className="h-4.5 w-4.5 text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight tracking-tight">CMIS</p>
        <p className="text-xs leading-tight text-slate-600">{roleLabel}</p>
      </div>
    </div>
  )
}

export default function AppShell({
  roleLabel,
  navItems,
}: {
  roleLabel: string
  navItems: NavItem[]
}) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex min-h-full flex-col text-slate-900 md:flex-row">
      <div className="flex items-center justify-between border-b border-black/[0.07] bg-slate-50 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo roleLabel={roleLabel} />
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-700 hover:bg-black/5"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-black/[0.07] bg-slate-50 backdrop-blur-xl transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 md:bg-slate-50 ${
          navOpen ? 'translate-x-0' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-black/[0.07] px-5 py-4">
          <Logo roleLabel={roleLabel} />
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-slate-600 hover:bg-black/5 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ label, to, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/5 text-indigo-700'
                    : 'text-slate-600 hover:bg-black/5 hover:text-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-accent"
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500 shadow-[0_0_8px_theme(colors.indigo.500)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {Boolean(badge) && (
                    <span className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 px-1.5 py-0.5 text-xs font-medium text-white">
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-black/[0.07] p-3">
          <div className="mb-2 truncate px-2 text-xs text-slate-600">
            {user?.email}
          </div>
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-black/5 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <ConnectionBanner />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
