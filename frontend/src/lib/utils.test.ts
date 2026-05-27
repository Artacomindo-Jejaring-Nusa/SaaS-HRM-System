import { describe, it, expect } from 'vitest'
import { cn, getStorageUrl } from './utils'

describe('utils', () => {
  describe('cn (classname merge)', () => {
    it('merges class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500')
      expect(result).toContain('text-red-500')
      expect(result).toContain('bg-blue-500')
    })

    it('handles conditional classes', () => {
      const isActive = true
      const result = cn('base', isActive && 'active')
      expect(result).toContain('active')
    })

    it('handles false/undefined values', () => {
      const result = cn('base', false, undefined, null)
      expect(result).toBe('base')
    })

    it('deduplicates tailwind classes', () => {
      const result = cn('text-red-500', 'text-blue-500')
      // twMerge should keep only the last conflicting class
      expect(result).toContain('text-blue-500')
      expect(result).not.toContain('text-red-500')
    })
  })

  describe('getStorageUrl', () => {
    it('returns empty string for null path', () => {
      expect(getStorageUrl(null)).toBe('')
    })

    it('returns empty string for undefined path', () => {
      expect(getStorageUrl(undefined)).toBe('')
    })

    it('returns empty string for empty string path', () => {
      expect(getStorageUrl('')).toBe('')
    })

    it('returns the URL directly if it starts with http', () => {
      const url = 'https://example.com/image.jpg'
      expect(getStorageUrl(url)).toBe(url)
    })

    it('returns the URL directly if it starts with http (not https)', () => {
      const url = 'http://cdn.example.com/file.pdf'
      expect(getStorageUrl(url)).toBe(url)
    })

    it('prepends storage base URL for relative paths', () => {
      const result = getStorageUrl('uploads/photo.jpg')
      expect(result).toContain('uploads/photo.jpg')
      expect(result).toContain('/storage/')
    })
  })
})
