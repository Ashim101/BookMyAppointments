import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import { PageSpinner } from '../components/ui/Spinner'
import ProtectedRoute from './ProtectedRoute'
import ScrollRestoration from './ScrollRestoration'

const Home = lazy(() => import('../pages/Home'))
const Doctors = lazy(() => import('../pages/Doctors'))
const DoctorProfile = lazy(() => import('../pages/DoctorProfile'))
const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'))
const ResetPassword = lazy(() => import('../pages/ResetPassword'))
const MyAppointments = lazy(() => import('../pages/MyAppointments'))
const AppointmentDetail = lazy(() => import('../pages/AppointmentDetail'))
const Profile = lazy(() => import('../pages/Profile'))
const Notifications = lazy(() => import('../pages/Notifications'))
const About = lazy(() => import('../pages/About'))
const Contact = lazy(() => import('../pages/Contact'))
const NotFound = lazy(() => import('../pages/NotFound'))

export default function AppRoutes() {
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="doctors" element={<Doctors />} />
            <Route path="doctors/:id" element={<DoctorProfile />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
            <Route element={<ProtectedRoute />}>
              <Route path="my-appointments" element={<MyAppointments />} />
              <Route path="my-appointments/:id" element={<AppointmentDetail />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
