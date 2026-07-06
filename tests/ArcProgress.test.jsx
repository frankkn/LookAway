import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ArcProgress from '../src/renderer/components/ArcProgress.jsx'

const CIRCUMFERENCE = 2 * Math.PI * 82

describe('ArcProgress', () => {
  it('renders an SVG with the given size', () => {
    const { container } = render(<ArcProgress progress={1} size={174} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '174')
    expect(svg).toHaveAttribute('height', '174')
  })

  it('renders progress arc at 100% with dashoffset 0', () => {
    const { container } = render(<ArcProgress progress={1} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0)
  })

  it('renders progress arc at 50% with correct dashoffset', () => {
    const { container } = render(<ArcProgress progress={0.5} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE * 0.5)
  })

  it('clamps progress below 0 to 0% (full offset = full track)', () => {
    const { container } = render(<ArcProgress progress={-1} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE)
  })

  it('clamps progress above 1 to 100% (offset = 0)', () => {
    const { container } = render(<ArcProgress progress={2} />)
    const arc = container.querySelectorAll('circle')[1]
    expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBeCloseTo(0)
  })

  it('applies the provided color to the arc', () => {
    const { container } = render(<ArcProgress progress={1} color="#4fc3f7" />)
    const arc = container.querySelectorAll('circle')[1]
    expect(arc).toHaveAttribute('stroke', '#4fc3f7')
  })

  it('renders children inside the arc container', () => {
    const { getByText } = render(
      <ArcProgress progress={1}>
        <span>inner content</span>
      </ArcProgress>
    )
    expect(getByText('inner content')).toBeInTheDocument()
  })
})
