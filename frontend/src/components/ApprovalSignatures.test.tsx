import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ApprovalSignatures from './ApprovalSignatures'

describe('ApprovalSignatures', () => {
  it('renders default manager name', () => {
    render(<ApprovalSignatures status="pending" />)
    expect(screen.getByText('Menyetujui (Manager)')).toBeInTheDocument()
  })

  it('renders custom manager name', () => {
    render(<ApprovalSignatures status="pending" managerName="HR Director" />)
    expect(screen.getByText('Menyetujui (HR Director)')).toBeInTheDocument()
  })

  it('renders waiting status', () => {
    render(<ApprovalSignatures status="pending" />)
    expect(screen.getByText('Menunggu...')).toBeInTheDocument()
  })

  it('renders approved status', () => {
    render(<ApprovalSignatures status="approved" />)
    expect(screen.getByText('APPROVED')).toBeInTheDocument()
  })

  it('renders without signature', () => {
    render(<ApprovalSignatures status="pending" userName="John Doe" />)
    expect(screen.getByText('Tanpa TTD')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('renders with signature', () => {
    render(<ApprovalSignatures status="pending" signature="data:image/png;base64,123" userName="Jane Doe" />)
    const img = screen.getByAltText('TTD')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,123')
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
  })
})
