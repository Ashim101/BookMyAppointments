import { FiInbox } from 'react-icons/fi'

export default function EmptyState({ message, icon: Icon = FiInbox, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-500">
      <Icon className="h-8 w-8 text-slate-300" aria-hidden="true" />
      <p className="text-sm">{message}</p>
      {action}
    </div>
  )
}
