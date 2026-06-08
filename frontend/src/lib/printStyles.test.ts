import { describe, it, expect } from 'vitest'
import { commonPrintStyles } from './printStyles'

describe('printStyles', () => {
  it('exports commonPrintStyles string', () => {
    expect(typeof commonPrintStyles).toBe('string')
    expect(commonPrintStyles).toContain('@media print')
    expect(commonPrintStyles).toContain('.dash-sidebar')
  })
})
