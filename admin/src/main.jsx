import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import { bindSession, store } from './store'
import ErrorBoundary from './routes/ErrorBoundary'
import { routes } from './routes'

bindSession(store)
const router = createBrowserRouter(routes, { future: { v7_relativeSplatPath: true } })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
        <ToastContainer position="top-right" autoClose={4000} newestOnTop />
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
)
