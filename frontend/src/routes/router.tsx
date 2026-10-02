import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import AdminLayout from '../components/layout/AdminLayout'
import StudentLayout from '../components/layout/StudentLayout'
import DriverLayout from '../components/layout/DriverLayout'

const Login = lazy(() => import('../pages/auth/Login'))
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'))

const AdminDashboard = lazy(() => import('../pages/admin/Dashboard'))
const AdminAccounts = lazy(() => import('../pages/admin/AdminAccounts'))
const AdminStudents = lazy(() => import('../pages/admin/Students'))
const AdminDrivers = lazy(() => import('../pages/admin/Drivers'))
const AdminBuses = lazy(() => import('../pages/admin/Buses'))
const AdminRoutes = lazy(() => import('../pages/admin/Routes'))
const AdminRouteBuilder = lazy(() => import('../pages/admin/RouteBuilder'))
const AdminRfid = lazy(() => import('../pages/admin/Rfid'))
const AdminPasses = lazy(() => import('../pages/admin/Passes'))
const AdminNotifications = lazy(() => import('../pages/admin/Notifications'))
const AdminSettings = lazy(() => import('../pages/admin/Settings'))
const AdminReports = lazy(() => import('../pages/admin/Reports'))

const StudentDashboard = lazy(() => import('../pages/student/Dashboard'))
const StudentTrack = lazy(() => import('../pages/student/Track'))
const StudentAttendance = lazy(() => import('../pages/student/Attendance'))
const StudentPass = lazy(() => import('../pages/student/Pass'))
const StudentNotifications = lazy(() => import('../pages/student/Notifications'))

const DriverDashboard = lazy(() => import('../pages/driver/Dashboard'))
const DriverTrip = lazy(() => import('../pages/driver/Trip'))
const DriverHistory = lazy(() => import('../pages/driver/History'))
const DriverNotifications = lazy(() => import('../pages/driver/Notifications'))

const ADMIN_ROLES = ['super_admin', 'transport_admin'] as const

function RouteFallback() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
    </div>
  )
}

export default function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<RoleRoute allow={[...ADMIN_ROLES]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route element={<RoleRoute allow={['super_admin']} />}>
                <Route path="admins" element={<AdminAccounts />} />
              </Route>
              <Route path="students" element={<AdminStudents />} />
              <Route path="drivers" element={<AdminDrivers />} />
              <Route path="buses" element={<AdminBuses />} />
              <Route path="routes" element={<AdminRoutes />} />
              <Route path="routes/new" element={<AdminRouteBuilder />} />
              <Route path="routes/:id/edit" element={<AdminRouteBuilder />} />
              <Route path="rfid" element={<AdminRfid />} />
              <Route path="passes" element={<AdminPasses />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>
          </Route>

          <Route element={<RoleRoute allow={['student']} />}>
            <Route path="/student" element={<StudentLayout />}>
              <Route index element={<StudentDashboard />} />
              {/* No :busId variant — a student tracks only their assigned bus,
                  which Track resolves from their own record. */}
              <Route path="track" element={<StudentTrack />} />
              <Route path="attendance" element={<StudentAttendance />} />
              <Route path="pass" element={<StudentPass />} />
              <Route path="notifications" element={<StudentNotifications />} />
            </Route>
          </Route>

          <Route element={<RoleRoute allow={['driver']} />}>
            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<DriverDashboard />} />
              <Route path="trip" element={<DriverTrip />} />
              <Route path="history" element={<DriverHistory />} />
              <Route path="notifications" element={<DriverNotifications />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
