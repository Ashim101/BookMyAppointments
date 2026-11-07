import { useEffect } from 'react'
import { BRAND } from '../lib/config'

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${BRAND}` : BRAND
  }, [title])
}
