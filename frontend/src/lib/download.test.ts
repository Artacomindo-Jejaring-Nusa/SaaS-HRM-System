import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadFile } from './download'
import axiosInstance from '@/lib/axios'
import { toast } from 'sonner'

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe('downloadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock global objects
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('successfully downloads a pdf file', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: new Blob(['test']) })
    
    const mockClick = vi.fn()
    const mockRemove = vi.fn()
    const mockLink = {
      href: '',
      setAttribute: vi.fn(),
      click: mockClick,
      remove: mockRemove,
    }
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any)

    const result = await downloadFile('/test/url', 'TestFile', 'pdf')

    expect(result).toBe(true)
    expect(axiosInstance.get).toHaveBeenCalledWith('/test/url', { responseType: 'blob' })
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'TestFile.pdf')
    expect(mockClick).toHaveBeenCalled()
    expect(mockRemove).toHaveBeenCalled()
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url')
  })

  it('successfully downloads an excel file', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: new Blob(['test']) })
    
    const mockClick = vi.fn()
    const mockRemove = vi.fn()
    const mockLink = {
      href: '',
      setAttribute: vi.fn(),
      click: mockClick,
      remove: mockRemove,
    }
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any)

    const result = await downloadFile('/test/url', 'TestFile.xlsx', 'excel')

    expect(result).toBe(true)
    expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'TestFile.xlsx')
  })

  it('handles error during download', async () => {
    (axiosInstance.get as any).mockRejectedValueOnce(new Error('Network Error'))
    
    const result = await downloadFile('/test/url', 'TestFile', 'pdf')

    expect(result).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Gagal mendownload file PDF.')
  })
})
