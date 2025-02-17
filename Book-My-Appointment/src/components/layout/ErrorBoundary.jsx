import { Component } from 'react'
import { SUPPORT_EMAIL } from '../../lib/config'
import Button from '../ui/Button'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-ink-500">
          An unexpected error stopped this page from loading. Reloading usually fixes it; if it keeps happening, write to {SUPPORT_EMAIL}.
        </p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    )
  }
}
