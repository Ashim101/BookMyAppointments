import { getSchedule, saveSchedule } from '../../api/doctorSelf'
import Card from '../../components/Card'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import ScheduleEditor from '../../components/schedule/ScheduleEditor'
import { useFetch, useMutation } from '../../hooks/useFetch'

export default function Schedule() {
  const { data, loading, error, reload, setData } = useFetch(getSchedule)
  const save = useMutation(saveSchedule, { success: 'Schedule saved' })

  const onSave = async (schedule) => {
    const result = await save.run(schedule)
    if (result.ok) setData(result.data)
  }

  return (
    <>
      <PageHeader title="Weekly schedule" subtitle="Working hours, breaks and slot length. Existing appointments are kept when you change these." />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" aria-label="Loading schedule" />
      ) : (
        <Card className="max-w-3xl">
          <ScheduleEditor schedule={data} onSave={onSave} saving={save.pending} />
        </Card>
      )}
    </>
  )
}
