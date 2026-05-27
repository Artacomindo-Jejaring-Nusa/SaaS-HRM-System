import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ErrorModal } from './ErrorModal'

describe('ErrorModal', () => {
  const defaultProps = {
    isOpen: true,
    message: 'Terjadi kesalahan pada server',
    onClose: jest.fn(),
  }

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ErrorModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders error modal with message', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Terjadi Kesalahan')
    expect(screen.getByText('Terjadi kesalahan pada server')).toBeInTheDocument()
  })

  it('renders success variant when type is success', () => {
    render(<ErrorModal {...defaultProps} type="success" />)
    expect(screen.getByText(/Berhasil!/i)).toBeInTheDocument()
  })

  it('renders custom title when provided', () => {
    render(<ErrorModal {...defaultProps} title="Custom Title" />)
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(<ErrorModal {...defaultProps} onClose={onClose} />)
    const closeBtn = screen.getByText('Mengerti, Tutup')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders the "Mengerti, Tutup" button', () => {
    render(<ErrorModal {...defaultProps} />)
    expect(screen.getByText('Mengerti, Tutup')).toBeInTheDocument()
  })

  it('renders both close button and footer button', () => {
    render(<ErrorModal {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(2) // "Mengerti, Tutup" + X button
  })
})
