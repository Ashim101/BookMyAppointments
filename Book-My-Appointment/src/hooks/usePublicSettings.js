import { getPublicSettings } from '../api/settings'
import { useQuery } from './useQuery'

/** Clinic policy (cancellation cutoff, booking window) from the API; `settings` is null until loaded or if it failed. */
export function usePublicSettings({ enabled = true } = {}) {
  const { data } = useQuery(['public-settings'], getPublicSettings, { enabled })
  return data
}
