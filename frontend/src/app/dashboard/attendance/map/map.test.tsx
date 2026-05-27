import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AttendanceMapPage from './page'

// Mock the AttendanceMap component because it uses dynamic import and Leaflet
jest.mock('@/components/AttendanceMap', () => ({
  __esModule: true,
  default: () => <div data-testid="attendance-map">Mocked Attendance Map</div>
}))
vi.mock('@/components/AttendanceMap', () => ({
  __esModule: true,
  default: () => <div data-testid="attendance-map">Mocked Attendance Map</div>
}))

describe('AttendanceMapPage', () => {
  it('renders page title and description', () => {
    render(<AttendanceMapPage />)
    expect(screen.getByText(/Peta Kehadiran Karyawan/i)).toBeInTheDocument()
    expect(screen.getByText(/Visualisasi real-time lokasi absensi hari ini/i)).toBeInTheDocument()
  })

  it('renders heatmap container card', () => {
    render(<AttendanceMapPage />)
    expect(screen.getByText(/Real-time Heatmap/i)).toBeInTheDocument()
    expect(screen.getByTestId('attendance-map')).toBeInTheDocument()
  })

  it('renders tips for admin section', () => {
    render(<AttendanceMapPage />)
    expect(screen.getByText(/Tips untuk Admin:/i)).toBeInTheDocument()
    expect(screen.getByText(/Peta ini hanya menampilkan data absensi hari ini/i)).toBeInTheDocument()
  })
})
