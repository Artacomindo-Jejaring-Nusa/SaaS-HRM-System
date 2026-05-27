import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionGuard } from './PermissionGuard'

// Mock the AuthContext
const mockHasPermission = jest.fn()
const mockLoading = false

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: mockHasPermission,
    loading: mockLoading,
  }),
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: mockHasPermission,
    loading: mockLoading,
  }),
}))

describe('PermissionGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders children when user has permission', () => {
    mockHasPermission.mockReturnValue(true)
    render(
      <PermissionGuard slug="manage-employees">
        <div>Protected Content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('renders fallback when user lacks permission', () => {
    mockHasPermission.mockReturnValue(false)
    render(
      <PermissionGuard slug="manage-employees" fallback={<div>Access Denied</div>}>
        <div>Protected Content</div>
      </PermissionGuard>
    )
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders nothing as default fallback when permission is denied', () => {
    mockHasPermission.mockReturnValue(false)
    const { container } = render(
      <PermissionGuard slug="manage-employees">
        <div>Protected Content</div>
      </PermissionGuard>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    // Should render empty fragment (no visible content)
    expect(container.textContent).toBe('')
  })

  it('calls hasPermission with the correct slug', () => {
    mockHasPermission.mockReturnValue(true)
    render(
      <PermissionGuard slug="view-reports">
        <div>Report</div>
      </PermissionGuard>
    )
    expect(mockHasPermission).toHaveBeenCalledWith('view-reports')
  })
})
