import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  Skeleton,
  DashboardSkeleton,
  TableSkeleton,
  EmployeeSkeleton,
  AttendanceSkeleton,
  ListPageSkeleton,
  CompanySkeleton,
  AnnouncementSkeleton,
  RolesSkeleton,
  ScheduleSkeleton,
  ActivityLogSkeleton,
  ReportSkeleton,
  PayrollSkeleton,
  PayrollCardSkeleton,
} from './Skeleton'

describe('Skeleton Components', () => {
  describe('Base Skeleton', () => {
    it('renders with default classes', () => {
      const { container } = render(<Skeleton />)
      const el = container.firstChild as HTMLElement
      expect(el).toBeInTheDocument()
      expect(el.className).toContain('animate-pulse')
    })

    it('renders with custom className', () => {
      const { container } = render(<Skeleton className="h-8 w-48" />)
      const el = container.firstChild as HTMLElement
      expect(el.className).toContain('h-8')
      expect(el.className).toContain('w-48')
    })
  })

  describe('DashboardSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<DashboardSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('TableSkeleton', () => {
    it('renders correct number of rows and columns', () => {
      const { container } = render(<TableSkeleton rows={3} cols={4} />)
      // 1 header row + 3 data rows = 4 total flex rows
      const rows = container.querySelectorAll('.flex.gap-4')
      expect(rows.length).toBe(4) // header + 3 rows
    })

    it('uses default rows and cols', () => {
      const { container } = render(<TableSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('EmployeeSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<EmployeeSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('AttendanceSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<AttendanceSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('ListPageSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<ListPageSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('CompanySkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<CompanySkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('AnnouncementSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<AnnouncementSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('RolesSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<RolesSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('ScheduleSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<ScheduleSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('ActivityLogSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<ActivityLogSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('ReportSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<ReportSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('PayrollSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<PayrollSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('PayrollCardSkeleton', () => {
    it('renders without crashing', () => {
      const { container } = render(<PayrollCardSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })
})
