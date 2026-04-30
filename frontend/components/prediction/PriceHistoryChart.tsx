"use client"

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { MarketTrend } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'

function trendSortKey(t: MarketTrend): number {
  const d = t.date?.trim()
  if (d) {
    const ts = Date.parse(d)
    if (!Number.isNaN(ts)) return ts
  }
  const m = t.month?.trim()
  if (m) {
    const ts = Date.parse(`${m}-01`)
    if (!Number.isNaN(ts)) return ts
    const ts2 = Date.parse(m)
    if (!Number.isNaN(ts2)) return ts2
  }
  return Number.NaN
}

function chartLabelForTrend(t: MarketTrend, fallbackIndex: number): string {
  const d = t.date?.trim()
  if (d) {
    const ts = Date.parse(d)
    if (!Number.isNaN(ts)) {
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    }
  }
  const m = t.month?.trim()
  if (m && m.length > 0) return m
  return `M${fallbackIndex + 1}`
}

/** Last 6 data points by time order, deduped by label (keeps last occurrence). */
function buildLastSixChartData(trends: MarketTrend[]) {
  const sorted = [...trends]
    .map((tr, idx) => ({ tr, idx, key: trendSortKey(tr) }))
    .sort((a, b) => {
      const ak = Number.isNaN(a.key) ? a.idx : a.key
      const bk = Number.isNaN(b.key) ? b.idx : b.key
      return ak - bk
    })
  const tail = sorted.slice(-6)
  const byLabel = new Map<string, { label: string; price: number; order: number }>()
  tail.forEach((row, order) => {
    const label = chartLabelForTrend(row.tr, row.idx)
    byLabel.set(label, {
      label,
      price: Math.round(row.tr.average_price),
      order,
    })
  })
  const data = Array.from(byLabel.values()).sort((a, b) => a.order - b.order)
  return data
}

function ChartRenderer({
  data,
  averagePrice,
}: {
  data: { label: string; price: number }[]
  averagePrice: number
}) {
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
        ReferenceLine: mod.ReferenceLine,
      })
    })
  }, [])

  if (!components) {
    return <Skeleton className="h-full w-full" />
  }

  const {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
  } = components

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis
          dataKey="label"
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={56}
        />
        <YAxis
          stroke="#94a3b8"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={(value: number) => `$${value.toLocaleString()}`}
          width={56}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1a1d29',
            border: '1px solid #2a2d3a',
            borderRadius: '8px',
            color: '#fff',
          }}
          formatter={(value: number) => [formatCurrency(value), 'Avg. price']}
          labelFormatter={(label: string) => label}
        />
        <ReferenceLine
          y={averagePrice}
          stroke="#a78bfa"
          strokeDasharray="4 4"
          label={{
            value: 'Avg',
            fill: '#c4b5fd',
            fontSize: 10,
          }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ fill: '#6366f1', r: 4 }}
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
  const t = useTranslations('predict.result')

  const { chartData, averagePrice, summaryKey } = useMemo(() => {
    if (!trends?.length) {
      return { chartData: [] as { label: string; price: number }[], averagePrice: 0, summaryKey: 'stable' as const }
    }
    const data = buildLastSixChartData(trends)
    const avg =
      data.length > 0 ? data.reduce((s, row) => s + row.price, 0) / data.length : 0
    const prices = data.map((d) => d.price)
    const mean = avg || 1
    const variance =
      prices.length > 1
        ? prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / (prices.length - 1)
        : 0
    const cv = Math.sqrt(variance) / mean
    let summaryKey: 'stable' | 'volatile' | 'up' | 'down' = 'stable'
    if (prices.length >= 3) {
      const first = prices[0]
      const last = prices[prices.length - 1]
      const drift = (last - first) / Math.max(mean, 1)
      if (cv > 0.08 && Math.abs(drift) < 0.04) summaryKey = 'volatile'
      else if (drift > 0.04) summaryKey = 'up'
      else if (drift < -0.04) summaryKey = 'down'
      else summaryKey = 'stable'
    }
    return { chartData: data, averagePrice: Math.round(avg), summaryKey }
  }, [trends])

  if (!chartData.length) {
    return null
  }

  const summary =
    summaryKey === 'up'
      ? t('historySummaryUp')
      : summaryKey === 'down'
        ? t('historySummaryDown')
        : summaryKey === 'volatile'
          ? t('historySummaryVolatile')
          : t('historySummaryStable')

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white text-lg">{t('priceHistoryTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <ChartRenderer data={chartData} averagePrice={averagePrice} />
          </Suspense>
        </div>
        <p className="text-xs text-[#94a3b8] mt-4 text-center leading-relaxed">{summary}</p>
        <p className="text-[11px] text-slate-500 mt-2 text-center">{t('historySixMonthNote')}</p>
      </CardContent>
    </Card>
  )
}
