import type { Role } from '../types'

export function roleHome(role: Role | null): string {
  switch (role) {
    case 'super_admin':
    case 'transport_admin':
      return '/admin'
    case 'driver':
      return '/driver'
    case 'student':
      return '/student'
    default:
      return '/login'
  }
}
