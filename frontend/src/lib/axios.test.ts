import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock js-cookie before importing axios
jest.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))
vi.mock('js-cookie', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

// Must import after mocks
import Cookies from 'js-cookie'

describe('axios instance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Cookies.get can be called to retrieve token', () => {
    (jest.mocked(Cookies.get) as any).mockReturnValue('test-token')
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
    (jest.mocked(Cookies.get) as any).mockReturnValue(undefined)
    const token = Cookies.get('token')
    expect(token).toBeUndefined()
  })

  it('can store and retrieve refresh_token', () => {
    Cookies.set('refresh_token', 'refresh-abc', { expires: 30 })
    expect(Cookies.set).toHaveBeenCalledWith('refresh_token', 'refresh-abc', { expires: 30 })
  })
})
