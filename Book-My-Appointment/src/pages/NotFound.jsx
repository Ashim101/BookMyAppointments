import { NotFoundIllustration } from '../components/illustrations/HeroIllustration'
import { ButtonLink } from '../components/ui/Button'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <NotFoundIllustration className="w-64" />
      <h1 className="mt-6 text-3xl font-bold text-ink-900">We could not find that page</h1>
      <p className="mt-2 max-w-md text-ink-500">The link may be broken or the page may have moved. Let us get you back on track.</p>
      <div className="mt-6 flex gap-3">
        <ButtonLink to="/">Go home</ButtonLink>
        <ButtonLink to="/doctors" variant="secondary">
          Find a doctor
        </ButtonLink>
      </div>
    </div>
  )
}
