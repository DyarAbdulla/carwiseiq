'use client'

import dynamic from 'next/dynamic'

/** Recharts + next/dynamic: `any` avoids strict prop typing on lazy-loaded chart primitives. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional for Recharts dynamic imports
const d = (loader: any): any => dynamic(loader, { ssr: false })

export const LineChart = d(() => import('recharts').then((m) => ({ default: m.LineChart })))
export const Line = d(() => import('recharts').then((m) => ({ default: m.Line })))
export const BarChart = d(() => import('recharts').then((m) => ({ default: m.BarChart })))
export const Bar = d(() => import('recharts').then((m) => ({ default: m.Bar })))
export const XAxis = d(() => import('recharts').then((m) => ({ default: m.XAxis })))
export const YAxis = d(() => import('recharts').then((m) => ({ default: m.YAxis })))
export const CartesianGrid = d(() => import('recharts').then((m) => ({ default: m.CartesianGrid })))
export const Tooltip = d(() => import('recharts').then((m) => ({ default: m.Tooltip })))
export const Legend = d(() => import('recharts').then((m) => ({ default: m.Legend })))
export const ResponsiveContainer = d(() => import('recharts').then((m) => ({ default: m.ResponsiveContainer })))
