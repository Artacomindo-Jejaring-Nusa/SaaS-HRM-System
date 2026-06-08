import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('renders approved status', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Disetujui')).toHaveClass('dash-badge-success')
  })

  it('renders success status', () => {
    render(<StatusBadge status="success" />)
    expect(screen.getByText('Disetujui')).toHaveClass('dash-badge-success')
  })

  it('renders active status', () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText('Disetujui')).toHaveClass('dash-badge-success')
  })

  it('renders rejected status', () => {
    render(<StatusBadge status="rejected" />)
    expect(screen.getByText('Ditolak')).toHaveClass('dash-badge-danger')
  })

  it('renders danger status', () => {
    render(<StatusBadge status="danger" />)
    expect(screen.getByText('Ditolak')).toHaveClass('dash-badge-danger')
  })

  it('renders error status', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText('Ditolak')).toHaveClass('dash-badge-danger')
  })

  it('renders pending status', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('Menunggu')).toHaveClass('dash-badge-warning')
  })

  it('renders pending_supervisor status', () => {
    render(<StatusBadge status="pending_supervisor" />)
    expect(screen.getByText('Menunggu Atasan')).toHaveClass('dash-badge-warning')
  })

  it('renders pending_hr status', () => {
    render(<StatusBadge status="pending_hr" />)
    expect(screen.getByText('Menunggu HRD')).toHaveClass('dash-badge-warning')
  })

  it('renders waiting status', () => {
    render(<StatusBadge status="waiting" />)
    expect(screen.getByText('Menunggu')).toHaveClass('dash-badge-warning')
  })

  it('renders draft status', () => {
    render(<StatusBadge status="draft" />)
    expect(screen.getByText('Draft')).toHaveClass('dash-badge-neutral')
  })

  it('renders unknown status as neutral', () => {
    render(<StatusBadge status="unknown_status" />)
    expect(screen.getByText('unknown_status')).toHaveClass('dash-badge-neutral')
  })
})
