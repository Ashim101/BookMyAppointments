import { Suspense, lazy } from 'react'
import { FiLoader } from 'react-icons/fi'
import { AdminLayout, DoctorLayout } from '../layouts/RoleLayouts'
import NotFound from '../pages/NotFound'
import { GuestOnly, HomeRedirect, RequireRole } from './guards'

const page = (loader) => {
  const Page = lazy(loader)
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading page" className="flex justify-center py-20 text-slate-400">
          <FiLoader className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <Page />
    </Suspense>
  )
}

export const routes = [
  { path: '/', element: <HomeRedirect /> },
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: page(() => import('../pages/Login')) },
      { path: '/forgot-password', element: page(() => import('../pages/ForgotPassword')) },
    ],
  },
  { path: '/reset-password', element: page(() => import('../pages/ResetPassword')) },
  {
    path: '/admin',
    element: <RequireRole role="admin" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: page(() => import('../pages/admin/Dashboard')) },
          { path: 'doctors', element: page(() => import('../pages/admin/Doctors')) },
          { path: 'specialities', element: page(() => import('../pages/admin/Specialities')) },
          { path: 'appointments', element: page(() => import('../pages/admin/Appointments')) },
          { path: 'patients', element: page(() => import('../pages/admin/Patients')) },
          { path: 'reviews', element: page(() => import('../pages/admin/Reviews')) },
          { path: 'audit', element: page(() => import('../pages/admin/AuditLog')) },
          { path: 'settings', element: page(() => import('../pages/admin/Settings')) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
  {
    path: '/doctor',
    element: <RequireRole role="doctor" />,
    children: [
      {
        element: <DoctorLayout />,
        children: [
          { index: true, element: page(() => import('../pages/doctor/Dashboard')) },
          { path: 'calendar', element: page(() => import('../pages/doctor/Calendar')) },
          { path: 'appointments', element: page(() => import('../pages/doctor/Appointments')) },
          { path: 'schedule', element: page(() => import('../pages/doctor/Schedule')) },
          { path: 'leaves', element: page(() => import('../pages/doctor/Leaves')) },
          { path: 'profile', element: page(() => import('../pages/doctor/Profile')) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]
