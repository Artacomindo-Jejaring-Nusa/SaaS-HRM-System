import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AttendanceMap from './AttendanceMap'
import axiosInstance from '@/lib/axios'

// Mock next/dynamic to return mocks synchronously based on loader source string
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: any) => {
    const str = loader.toString()
    if (str.includes('MapContainer')) {
      return ({ children }: any) => <div data-testid="map-container">{children}</div>
    }
    if (str.includes('TileLayer')) {
      return () => <div data-testid="tile-layer" />
    }
    if (str.includes('Marker')) {
      return ({ children, position }: any) => (
        <div data-testid="marker" data-position={JSON.stringify(position)}>
          {children}
        </div>
      )
    }
    if (str.includes('Popup')) {
      return ({ children }: any) => <div data-testid="popup">{children}</div>
    }
    return () => null
  }
}))
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: any) => {
    const str = loader.toString()
    if (str.includes('MapContainer')) {
      return ({ children }: any) => <div data-testid="map-container">{children}</div>
    }
    if (str.includes('TileLayer')) {
      return () => <div data-testid="tile-layer" />
    }
    if (str.includes('Marker')) {
      return ({ children, position }: any) => (
        <div data-testid="marker" data-position={JSON.stringify(position)}>
          {children}
        </div>
      )
    }
    if (str.includes('Popup')) {
      return ({ children }: any) => <div data-testid="popup">{children}</div>
    }
    return () => null
  }
}))

// Mock leaflet library
jest.mock('leaflet', () => ({
  divIcon: jest.fn().mockReturnValue({}),
  default: {
    divIcon: jest.fn().mockReturnValue({}),
  }
}))
vi.mock('leaflet', () => ({
  divIcon: jest.fn().mockReturnValue({}),
  default: {
    divIcon: jest.fn().mockReturnValue({}),
  }
}))

// Mock axiosInstance
jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  }
}))
vi.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  }
}))

describe('AttendanceMap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading skeleton initially', () => {
    jest.mocked(axiosInstance.get).mockReturnValue(new Promise(() => {}))
    render(<AttendanceMap />)
    expect(screen.getByText(/Memuat Peta/i)).toBeInTheDocument()
  })

  it('fetches and renders heatmap data with markers', async () => {
    const mockData = {
      status: 'success',
      data: [
        {
          id: 1,
          latitude_in: -6.2477,
          longitude_in: 106.9493,
          status: 'Present',
          check_in: '2026-05-27T08:00:00Z',
          user: {
            name: 'John Doe',
            nik: '12345',
            profile_photo_url: null,
          }
        }
      ]
    }
    jest.mocked(axiosInstance.get).mockResolvedValue({ data: mockData })

    render(<AttendanceMap />)

    await waitFor(() => {
      expect(screen.getByTestId('marker')).toBeInTheDocument()
    })
  })
})
