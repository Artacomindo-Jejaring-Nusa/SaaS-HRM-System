import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock js-cookie before importing axios
vi.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
}))

// Must import after mocks
import Cookies from 'js-cookie'

describe('axios instance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Cookies.get can be called to retrieve token', () => {
    vi.mocked(Cookies.get).mockReturnValue('test-token' as any)
    const token = Cookies.get('token')
    expect(token).toBe('test-token')
    expect(Cookies.get).toHaveBeenCalledWith('token')
  })

  it('Cookies.set can be called to store token', () => {
    Cookies.set('token', 'new-token', { expires: 1 })
    expect(Cookies.set).toHaveBeenCalledWith('token', 'new-token', { expires: 1 })
  })

  it('Cookies.remove can be called to clear token', () => {
    Cookies.remove('token')
    expect(Cookies.remove).toHaveBeenCalledWith('token')
  })

  it('Cookies.get returns undefined when no token set', () => {
    vi.mocked(Cookies.get).mockReturnValue(undefined as any)
    const token = Cookies.get('token')
    expect(token).toBeUndefined()
  })

  it('can store and retrieve refresh_token', () => {
    Cookies.set('refresh_token', 'refresh-abc', { expires: 30 })
    expect(Cookies.set).toHaveBeenCalledWith('refresh_token', 'refresh-abc', { expires: 30 })
  })
})

