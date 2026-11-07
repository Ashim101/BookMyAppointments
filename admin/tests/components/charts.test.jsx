import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LineChart from '../../src/components/charts/LineChart'
import BarChart from '../../src/components/charts/BarChart'
import DonutChart from '../../src/components/charts/DonutChart'
import { arcPath } from '../../src/lib/scale'

const data = [
  { period: '2026-01-01', appointments: 4, revenue: 2000 },
  { period: '2026-01-02', appointments: 8, revenue: 4500 },
  { period: '2026-01-03', appointments: 0, revenue: 0 },
]
const series = [
  { key: 'appointments', label: 'Appointments' },
  { key: 'revenue', label: 'Revenue', axis: 'right', format: (v) => `Rs ${v}` },
]

describe('LineChart', () => {
  it('shows the empty state without data', () => {
    render(<LineChart data={[]} xKey="period" series={series} label="x" />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('shows the empty state when every value is zero', () => {
    render(<LineChart data={[{ period: 'a', appointments: 0, revenue: 0 }]} xKey="period" series={series} label="x" />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('draws one polyline per series with axis ticks', () => {
    const { container } = render(<LineChart data={data} xKey="period" series={series} label="Trend" />)
    expect(container.querySelectorAll('polyline')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Trend' })).toBeInTheDocument()
    expect(container.textContent).toContain('Revenue')
  })

  it('reveals a tooltip on keyboard focus and moves with arrow keys', async () => {
    const user = userEvent.setup()
    render(<LineChart data={data} xKey="period" xFormat={(p) => `day ${p.slice(-2)}`} series={series} label="Trend" />)
    await user.tab()
    expect(screen.getByRole('status')).toHaveTextContent('day 01')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('day 02')
    expect(screen.getByRole('status')).toHaveTextContent('Revenue: Rs 4500')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('status')).toHaveTextContent('day 03')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a tooltip on pointer movement', () => {
    render(<LineChart data={data} xKey="period" series={series} label="Trend" />)
    const svg = screen.getByRole('img', { name: 'Trend' })
    svg.getBoundingClientRect = () => ({ left: 0, width: 640, top: 0, height: 260 })
    fireEvent.mouseMove(svg, { clientX: 600 })
    expect(screen.getByRole('status')).toHaveTextContent('2026-01-03')
    fireEvent.mouseLeave(svg)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('BarChart', () => {
  const bars = [
    { name: 'Jan', completed: 5, cancelled: 2 },
    { name: 'Feb', completed: 3, cancelled: 1 },
  ]
  const barSeries = [
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  it('renders the empty state', () => {
    render(<BarChart data={[]} xKey="name" series={barSeries} label="x" />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('describes each group for assistive tech and shows a tooltip on focus', async () => {
    const user = userEvent.setup()
    render(<BarChart data={bars} xKey="name" series={barSeries} stacked label="Status" />)
    expect(screen.getByRole('img', { name: 'Jan: Completed 5, Cancelled 2' })).toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled: 2')
  })

  it('stacks bars to the combined total on the axis', () => {
    const { container } = render(<BarChart data={bars} xKey="name" series={barSeries} stacked label="s" />)
    const labels = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(labels).toContain('8')
  })

  it('shows a tooltip on hover', async () => {
    const user = userEvent.setup()
    render(<BarChart data={bars} xKey="name" series={barSeries} valueFormat={(v) => `${v}!`} label="s" />)
    await user.hover(screen.getByRole('img', { name: /Feb/ }))
    expect(screen.getByRole('status')).toHaveTextContent('Completed: 3!')
  })
})

describe('DonutChart', () => {
  it('shows the empty state when the total is zero', () => {
    render(<DonutChart data={[{ label: 'A', value: 0 }]} label="x" />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('lists slices with percentages and highlights on hover', async () => {
    const user = userEvent.setup()
    render(<DonutChart data={[{ label: 'Cardiology', value: 30 }, { label: 'Skin', value: 10 }]} label="Mix" centerLabel="All" />)
    expect(screen.getByRole('img', { name: 'Cardiology: 30 (75%)' })).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    await user.hover(screen.getByRole('img', { name: /Skin/ }))
    expect(screen.getAllByText('Skin')).toHaveLength(2)
    expect(screen.getByText('10', { selector: 'text' })).toBeInTheDocument()
  })
})

describe('arcPath', () => {
  it('draws a closed path and clamps full circles', () => {
    expect(arcPath(100, 100, 60, 90, 0, Math.PI / 2)).toMatch(/^M100 10A90 90 0 0 1 190 100L160 100A60 60 0 0 0 100 40Z$/)
    expect(arcPath(100, 100, 60, 90, 0, Math.PI * 2)).toContain(' 0 1 1 ')
  })
})
