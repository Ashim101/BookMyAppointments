import { Component } from 'react'
import Button from '../components/ui/Button'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">An unexpected error occurred while rendering this page.</p>
        <Button className="mt-4" onClick={() => window.location.assign('/')}>
          Reload app
        </Button>
      </div>
    )
  }
}
