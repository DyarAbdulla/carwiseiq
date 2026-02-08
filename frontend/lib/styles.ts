/**
 * Global style constants for consistent theming
 */

export const colors = {
  background: {
    primary: '#0f1117',
    secondary: '#1a1d29',
    tertiary: '#2a2d3a',
  },
  text: {
    primary: '#ffffff',
    secondary: '#94a3b8',
    muted: '#64748b',
  },
  accent: {
    primary: '#5B7FFF',
    hover: '#4a6fe6',
    light: 'rgba(91, 127, 255, 0.1)',
  },
  border: {
    default: '#2a2d3a',
    hover: '#3a3f4a',
    accent: '#5B7FFF',
  },
} as const

export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem',  // 8px
  md: '1rem',    // 16px
  lg: '1.5rem',  // 24px
  xl: '2rem',    // 32px
  '2xl': '3rem', // 48px
} as const

export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
} as const

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// Common class combinations for consistency
export const commonClasses = {
  card: 'border-[#2a2d3a] bg-[#1a1d29] rounded-lg',
  cardHover: 'hover:border-[#5B7FFF]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#5B7FFF]/20',
  input: 'border-[#2a2d3a] bg-[#0f1117] text-white',
  button: {
    primary: 'bg-[#5B7FFF] hover:bg-[#4a6fe6] text-white',
    secondary: 'border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]',
    ghost: 'hover:bg-[#2a2d3a]',
  },
  touchTarget: 'min-h-[48px] min-w-[48px]',
} as const










