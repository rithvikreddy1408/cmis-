import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleHome } from '../utils/roleHome'
import type { Role } from '../types'

export default function RoleRoute({ allow }: { allow: Role[] }) {
  const { role } = useAuth()

  if (!role || !allow.includes(role)) {
    return <Navigate to={roleHome(role)} replace />
  }

  return <Outlet />
}
