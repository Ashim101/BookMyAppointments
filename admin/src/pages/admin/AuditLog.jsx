import { Fragment, useState } from 'react'
import { FiChevronDown, FiChevronRight } from 'react-icons/fi'
import { listAuditLogs } from '../../api/admin'
import ErrorState from '../../components/ErrorState'
import EmptyState from '../../components/EmptyState'
import PageHeader from '../../components/PageHeader'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DateRangePicker from '../../components/ui/DateRangePicker'
import Input from '../../components/ui/Input'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import { useFetch } from '../../hooks/useFetch'
import { useFilters } from '../../hooks/useFilters'
import { useDebounce } from '../../hooks/useTimers'
import { formatDateTime } from '../../lib/date'
import { humanize } from '../../lib/format'

const DEFAULTS = { action: '', actorRole: '', from: '', to: '', page: 1 }
const LIMIT = 20

export default function AuditLog() {
  const { filters, update, reset, dirty } = useFilters('admin.audit', DEFAULTS)
  const action = useDebounce(filters.action)
  const [open, setOpen] = useState(() => new Set())
  const list = useFetch(() => listAuditLogs({ ...filters, action, limit: LIMIT }), [
    action, filters.actorRole, filters.from, filters.to, filters.page,
  ])

  const toggle = (id) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rows = list.data?.items ?? []
  return (
    <>
      <PageHeader title="Audit log" subtitle="Administrative changes and appointment state transitions." />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Action" placeholder="e.g. doctor.create" value={filters.action} onChange={(e) => update({ action: e.target.value })} />
        <Select
          label="Actor role"
          placeholder="Any role"
          value={filters.actorRole}
          onChange={(e) => update({ actorRole: e.target.value })}
          options={[{ value: 'admin', label: 'Admin' }, { value: 'doctor', label: 'Doctor' }, { value: 'patient', label: 'Patient' }]}
        />
        <div className="sm:col-span-2 lg:col-span-2">
          <DateRangePicker presets from={filters.from} to={filters.to} onChange={(r) => update({ from: r.from, to: r.to })} />
        </div>
        <Button variant="ghost" onClick={reset} disabled={!dirty}>
          Clear filters
        </Button>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Audit log entries</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3"><span className="sr-only">Details</span></th>
                  <th scope="col" className="px-4 py-3">When</th>
                  <th scope="col" className="px-4 py-3">Actor</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Target</th>
                  <th scope="col" className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading...</td>
                  </tr>
                )}
                {!list.loading &&
                  rows.map((log) => {
                    const expanded = open.has(log.id)
                    return (
                      <Fragment key={log.id}>
                        <tr>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggle(log.id)}
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Hide' : 'Show'} details for ${log.action}`}
                              className="text-slate-500 hover:text-slate-900"
                            >
                              {expanded ? <FiChevronDown /> : <FiChevronRight />}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">{formatDateTime(log.createdAt)}</td>
                          <td className="px-4 py-3">
                            {log.actor.name} <Badge>{log.actor.role}</Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{humanize(log.action)}</td>
                          <td className="px-4 py-3">{log.target ? `${log.target.type} ${log.target.id}` : '-'}</td>
                          <td className="px-4 py-3 text-slate-500">{log.ip}</td>
                        </tr>
                        {expanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={6} className="px-4 py-3">
                              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(log.meta, null, 2)}</pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
              </tbody>
            </table>
            {!list.loading && rows.length === 0 && <EmptyState message="No audit entries match these filters." />}
          </div>
          {list.data && <Pagination {...list.data} onChange={(page) => update({ page })} />}
        </>
      )}
    </>
  )
}
