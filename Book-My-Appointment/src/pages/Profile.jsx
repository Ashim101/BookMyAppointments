import { getProfile } from '../api/patient'
import ProfileForm from '../components/profile/ProfileForm'
import { ErrorState } from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'

export default function Profile() {
  usePageTitle('My profile')
  const { data, error, loading, refetch } = useQuery(['profile'], getProfile)

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-ink-900">My profile</h1>
      {loading ? <PageSpinner label="Loading profile" /> : error ? <ErrorState error={error} onRetry={refetch} /> : <ProfileForm patient={data} />}
    </div>
  )
}
