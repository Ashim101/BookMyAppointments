import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { FiCalendar, FiChevronDown, FiLogOut, FiUser } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { selectUser, signOut } from '../../features/auth/authSlice'
import { useDismiss } from '../../hooks/useDismiss'
import Avatar from '../ui/Avatar'

const itemClass = 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-slate-50'

export default function UserMenu() {
  const [open, setOpen] = useState(false)
  const user = useSelector(selectUser)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const ref = useDismiss(open, () => setOpen(false))

  const logout = async () => {
    setOpen(false)
    await dispatch(signOut())
    toast.success('You have been signed out.')
    navigate('/')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full p-1 hover:bg-slate-100"
      >
        <Avatar name={user.name} src={user.image} size="sm" />
        <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:inline">{user.name}</span>
        <FiChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-200">
          <p className="truncate border-b border-slate-100 px-4 py-2 text-xs text-ink-500">{user.email}</p>
          <Link to="/my-appointments" className={itemClass} onClick={() => setOpen(false)}>
            <FiCalendar aria-hidden="true" /> My appointments
          </Link>
          <Link to="/profile" className={itemClass} onClick={() => setOpen(false)}>
            <FiUser aria-hidden="true" /> My profile
          </Link>
          <button type="button" className={itemClass} onClick={logout}>
            <FiLogOut aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
