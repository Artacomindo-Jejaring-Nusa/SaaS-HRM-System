import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import Pagination from './Pagination'

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    lastPage: 10,
    total: 100,
    onPageChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when lastPage is 1', () => {
    const { container } = render(
      <Pagination {...defaultProps} lastPage={1} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders total data count', () => {
    render(<Pagination {...defaultProps} />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('disables previous button on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />)
    const buttons = screen.getAllByRole('button')
    // First button is the "previous" button
    expect(buttons[0]).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination {...defaultProps} currentPage={10} />)
    const buttons = screen.getAllByRole('button')
    // Last button is the "next" button
    expect(buttons[buttons.length - 1]).toBeDisabled()
  })

  it('calls onPageChange when a page number is clicked', () => {
    const onPageChange = jest.fn()
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />)
    const page3Button = screen.getByText('3')
    fireEvent.click(page3Button)
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('calls onPageChange with previous page when prev button clicked', () => {
    const onPageChange = jest.fn()
    render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]) // prev button
    expect(onPageChange).toHaveBeenCalledWith(4)
  })

  it('calls onPageChange with next page when next button clicked', () => {
    const onPageChange = jest.fn()
    render(<Pagination {...defaultProps} currentPage={5} onPageChange={onPageChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]) // next button
    expect(onPageChange).toHaveBeenCalledWith(6)
  })

  it('shows ellipsis when start > 2', () => {
    render(<Pagination {...defaultProps} currentPage={7} />)
    const ellipsis = screen.getAllByText('...')
    expect(ellipsis.length).toBeGreaterThanOrEqual(1)
  })

  it('shows first page button when not in visible range', () => {
    render(<Pagination {...defaultProps} currentPage={7} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows last page button when not in visible range', () => {
    render(<Pagination {...defaultProps} currentPage={3} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('highlights the current page', () => {
    render(<Pagination {...defaultProps} currentPage={3} />)
    const pageButton = screen.getByText('3')
    expect(pageButton.className).toContain('bg-[#8B0000]')
  })
})
