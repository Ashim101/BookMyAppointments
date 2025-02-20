import {
  FiActivity, FiCalendar, FiClipboard, FiClock, FiGrid, FiHeart, FiList, FiSettings, FiStar, FiUser, FiUserCheck, FiUsers, FiCoffee,
} from 'react-icons/fi'
import NotificationBell from '../components/NotificationBell'
import StaffLayout from './StaffLayout'

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/admin/doctors', label: 'Doctors', icon: FiUserCheck },
  { to: '/admin/specialities', label: 'Specialities', icon: FiHeart },
  { to: '/admin/appointments', label: 'Appointments', icon: FiCalendar },
  { to: '/admin/patients', label: 'Patients', icon: FiUsers },
  { to: '/admin/reviews', label: 'Reviews', icon: FiStar },
  { to: '/admin/audit', label: 'Audit log', icon: FiClipboard },
  { to: '/admin/settings', label: 'Settings', icon: FiSettings },
]

const DOCTOR_NAV = [
  { to: '/doctor', label: 'Dashboard', icon: FiActivity, end: true },
  { to: '/doctor/calendar', label: 'Calendar', icon: FiCalendar },
  { to: '/doctor/appointments', label: 'Appointments', icon: FiList },
  { to: '/doctor/schedule', label: 'Schedule', icon: FiClock },
  { to: '/doctor/leaves', label: 'Leaves', icon: FiCoffee },
  { to: '/doctor/profile', label: 'Profile', icon: FiUser },
]

export const AdminLayout = () => <StaffLayout nav={ADMIN_NAV} />

export const DoctorLayout = () => <StaffLayout nav={DOCTOR_NAV} topbarExtra={<NotificationBell />} />
