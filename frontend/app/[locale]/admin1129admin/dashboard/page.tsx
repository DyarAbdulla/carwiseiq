"use client"
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import {
  TrendingUp,
  Users,
  MessageSquare,
  BarChart3,
  Activity,
  Database,
  Cpu
} from 'lucide-react'

const LineChart = dynamic(() => import('recharts').then(m => ({ default: m.LineChart })), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => ({ default: m.Line })), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(m => ({ default: m.BarChart })), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => ({ default: m.Bar })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => ({ default: m.XAxis })), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => ({ default: m.YAxis })), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => ({ default: m.CartesianGrid })), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => ({ default: m.Tooltip })), { ssr: false })
const Legend = dynamic(() => import('recharts').then(m => ({ default: m.Legend })), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })), { ssr: false })

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [predictionsChart, setPredictionsChart] = useState<any[]>([])
  const [ratingsChart, setRatingsChart] = useState<any[]>([])
  const [accuracyChart, setAccuracyChart] = useState<any[]>([])
  const [marketplaceAnalytics, setMarketplaceAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [statsData, predictionsData, ratingsData, accuracyData, marketplaceData] = await Promise.all([
        apiClient.getDashboardStats().catch(err => {
          console.error('Error loading stats:', err)
          return null
        }),
        apiClient.getPredictionsOverTime(30).catch(err => {
          console.error('Error loading predictions chart:', err)
          return []
        }),
        apiClient.getFeedbackRatings().catch(err => {
          console.error('Error loading ratings chart:', err)
          return []
        }),
        apiClient.getAccuracyTrend(30).catch(err => {
          console.error('Error loading accuracy chart:', err)
          return []
        }),
        apiClient.getMarketplaceAnalytics().catch(err => {
          console.error('Error loading marketplace analytics:', err)
          return null
        }),
      ])

      setStats(statsData)
      setPredictionsChart(predictionsData || [])
      setRatingsChart(ratingsData || [])
      setAccuracyChart(accuracyData || [])
      setMarketplaceAnalytics(marketplaceData)
      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-800 rounded w-64 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
        <p className="text-slate-600 dark:text-gray-400 mt-2">Welcome to the admin dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-800 border-slate-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-gray-300">
              Total Predictions
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.predictions?.all_time?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-gray-400 mt-1">
              {stats?.predictions?.today || 0} today
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-800 border-slate-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-gray-300">
              Model Accuracy
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.accuracy?.percent?.toFixed(1) || 0}%
            </div>
            <div className="text-xs text-slate-600 dark:text-gray-400 mt-1">
              Based on {stats?.accuracy?.total_feedback || 0} feedback submissions
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-800 border-slate-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-gray-300">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.users?.total?.toLocaleString() || 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-gray-400 mt-1">
              Registered users
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-800 border-slate-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-gray-300">
              Active Listings
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.listings?.active || 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-gray-400 mt-1">
              Buy & Sell listings
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="backdrop-blur-xl bg-white/80 dark:bg-gray-800 border-slate-200 dark:border-gray-700 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <Activity className={`h-5 w-5 ${
                stats?.system_health?.api === 'healthy' ? 'text-green-500' : 'text-red-500'
              }`} />
              <div>
                <p className="text-sm text-slate-700 dark:text-gray-300">API Status</p>
                <p className="text-xs text-slate-600 dark:text-gray-400 capitalize">
                  {stats?.system_health?.api || 'unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Database className={`h-5 w-5 ${
                stats?.system_health?.database === 'healthy' ? 'text-green-500' : 'text-red-500'
              }`} />
              <div>
                <p className="text-sm text-slate-700 dark:text-gray-300">Database</p>
                <p className="text-xs text-slate-600 dark:text-gray-400 capitalize">
                  {stats?.system_health?.database || 'unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Cpu className={`h-5 w-5 ${
                stats?.system_health?.model === 'healthy' ? 'text-green-500' : 'text-red-500'
              }`} />
              <div>
                <p className="text-sm text-slate-700 dark:text-gray-300">Model</p>
                <p className="text-xs text-slate-600 dark:text-gray-400 capitalize">
                  {stats?.system_health?.model || 'unknown'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Predictions Over Time */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Predictions Over Time</CardTitle>
            <CardDescription className="text-gray-400">
              Last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={predictionsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Predictions"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Feedback Ratings Distribution */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Feedback Ratings Distribution</CardTitle>
            <CardDescription className="text-gray-400">
              User ratings (1-5 stars)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="rating" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="count" fill="#10B981" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Trend */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Accuracy Trend</CardTitle>
          <CardDescription className="text-gray-400">
            Model accuracy over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={accuracyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="accuracy_percent"
                stroke="#10B981"
                strokeWidth={2}
                name="Accuracy %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Feedback */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Feedback</CardTitle>
          <CardDescription className="text-gray-400">
            Latest feedback submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.recent_feedback?.slice(0, 5).map((feedback: any) => (
              <div
                key={feedback.id}
                className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {feedback.car?.make} {feedback.car?.model} ({feedback.car?.year})
                  </p>
                  <p className="text-sm text-gray-400">
                    {feedback.user || 'Anonymous'} • {new Date(feedback.timestamp).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  {feedback.rating && (
                    <div className="text-yellow-500">
                      {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                    </div>
                  )}
                  {feedback.is_accurate !== null && (
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        feedback.is_accurate
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {feedback.is_accurate ? 'Accurate' : 'Inaccurate'}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(!stats?.recent_feedback || stats.recent_feedback.length === 0) && (
              <p className="text-gray-400 text-center py-8">No recent feedback</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Marketplace Analytics */}
      {marketplaceAnalytics && (
        <>
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">Marketplace Analytics</h2>
          </div>

          {/* Marketplace Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">
                  Total Listings
                </CardTitle>
                <Database className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {marketplaceAnalytics.listings_by_status?.active || 0}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Active listings
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">
                  Avg Days to Sell
                </CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {marketplaceAnalytics.average_days_to_sell || 0}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Days
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">
                  Conversion Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {marketplaceAnalytics.conversion_rate || 0}%
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Views to messages
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-300">
                  Sold Listings
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {marketplaceAnalytics.listings_by_status?.sold || 0}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Total sold
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Marketplace Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Listings Over Time */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Listings Over Time</CardTitle>
                <CardDescription className="text-gray-400">
                  Last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={marketplaceAnalytics.listings_over_time || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      name="Listings"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Makes/Models */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Most Viewed Makes/Models</CardTitle>
                <CardDescription className="text-gray-400">
                  Top 10 by views
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={marketplaceAnalytics.top_makes_models || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="make"
                      stroke="#9CA3AF"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="views" fill="#10B981" name="Views" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Geographic Distribution */}
          {marketplaceAnalytics.geographic_distribution && marketplaceAnalytics.geographic_distribution.length > 0 && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Geographic Distribution</CardTitle>
                <CardDescription className="text-gray-400">
                  Top cities by listing count
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {marketplaceAnalytics.geographic_distribution.slice(0, 10).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <span className="text-white">{item.city}</span>
                      <span className="text-gray-400">{item.count} listings</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
