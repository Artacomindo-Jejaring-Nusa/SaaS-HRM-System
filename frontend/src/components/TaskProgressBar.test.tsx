import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TaskProgressBar from './TaskProgressBar'

describe('TaskProgressBar', () => {
  it('renders progress percentage text', () => {
    render(<TaskProgressBar progress={50} totalActivities={10} completedActivities={5} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders "Progress" label', () => {
    render(<TaskProgressBar progress={0} totalActivities={5} completedActivities={0} />)
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('renders completed activities count', () => {
    render(<TaskProgressBar progress={60} totalActivities={10} completedActivities={6} />)
    expect(screen.getByText('6 dari 10 kegiatan selesai')).toBeInTheDocument()
  })

  it('renders "✓ Selesai" badge when progress is 100%', () => {
    render(<TaskProgressBar progress={100} totalActivities={5} completedActivities={5} />)
    expect(screen.getByText('✓ Selesai')).toBeInTheDocument()
  })

  it('does not render "✓ Selesai" badge when progress is less than 100%', () => {
    render(<TaskProgressBar progress={75} totalActivities={8} completedActivities={6} />)
    expect(screen.queryByText('✓ Selesai')).not.toBeInTheDocument()
  })

  it('renders 0% progress correctly', () => {
    render(<TaskProgressBar progress={0} totalActivities={10} completedActivities={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0 dari 10 kegiatan selesai')).toBeInTheDocument()
  })

  it('renders 100% progress with correct bar color', () => {
    const { container } = render(
      <TaskProgressBar progress={100} totalActivities={5} completedActivities={5} />
    )
    const progressBar = container.querySelector('[style*="width: 100%"]')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar?.className).toContain('bg-emerald-500')
  })

  it('renders in-progress bar with blue color', () => {
    const { container } = render(
      <TaskProgressBar progress={50} totalActivities={10} completedActivities={5} />
    )
    const progressBar = container.querySelector('[style*="width: 50%"]')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar?.className).toContain('bg-blue-500')
  })

  it('renders zero-progress bar with gray color', () => {
    const { container } = render(
      <TaskProgressBar progress={0} totalActivities={10} completedActivities={0} />
    )
    const progressBar = container.querySelector('[style*="width: 0%"]')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar?.className).toContain('bg-gray-300')
  })
})
