import React from 'react'

const VBSIZE = 200
const CENTER = 100
const RADIUS = 82
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ArcProgress({
  progress,
  children,
  color = '#ff6b35',
  trackColor = 'rgba(255,255,255,0.07)',
  strokeWidth = 10,
  size = 200,
}) {
  const clamped = Math.max(0, Math.min(1, progress))
  const offset = CIRCUMFERENCE * (1 - clamped)

  return (
    <div className="arc-container" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${VBSIZE} ${VBSIZE}`}
        style={{ display: 'block' }}
      >
        {/* Track */}
        <circle
          cx={CENTER} cy={CENTER} r={RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={CENTER} cy={CENTER} r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{ transition: 'stroke-dashoffset 0.95s linear' }}
        />
      </svg>
      <div className="arc-center">
        {children}
      </div>
    </div>
  )
}
