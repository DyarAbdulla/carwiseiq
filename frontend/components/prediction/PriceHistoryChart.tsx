"use client"

import { Suspense, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { MarketTrend } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'


// Separate component for lazy-loaded chart
function ChartRenderer({ data }: { data: any[] }) {
  const [components, setComponents] = useState<any>(null)

  useEffect(() => {
    import('recharts').then((mod: any) => {
      setComponents({
        ResponsiveContainer: mod.ResponsiveContainer,
        LineChart: mod.LineChart,
        Line: mod.Line,
        XAxis: mod.XAxis,
        YAxis: mod.YAxis,
        CartesianGrid: mod.CartesianGrid,
        Tooltip: mod.Tooltip,
      })
    })
  }, [])

  if (!components) {
    return <Skeleton className="h-full w-full" />
  }

  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } = components

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis 
          dataKey="month" 
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
        />
        <YAxis 
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(value: number) => `$${value.toLocaleString()}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1d29',
            border: '1px solid #2a2d3a',
            borderRadius: '8px',
            color: '#fff',
          }}
          formatter={(value: number) => formatCurrency(value)}
        />
        <Line 
          type="monotone" 
          dataKey="price" 
          stroke="#5B7FFF" 
          strokeWidth={2}
          dot={{ fill: '#5B7FFF', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface PriceHistoryChartProps {
  trends: MarketTrend[]
}

export function PriceHistoryChart({ trends }: PriceHistoryChartProps) {
  if (!trends || trends.length === 0) {
    return null
  }

  const chartData = trends.map(trend => ({
    month: trend.month,
    price: Math.round(trend.average_price),
  }))

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white text-lg">📈 Price History Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <ChartRenderer data={chartData} />
          </Suspense>
        </div>
        <p className="text-xs text-[#94a3b8] mt-4 text-center">
          Price trends over the last {trends.length} months
        </p>
      </CardContent>
    </Card>
  )
}


