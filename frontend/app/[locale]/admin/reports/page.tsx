"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api'
import { FileText, Download, Calendar } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export default function ReportsPage() {
  const [dailyReport, setDailyReport] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDailyReport()
  }, [selectedDate])

  const loadDailyReport = async () => {
    setLoading(true)
    try {
      const data = await apiClient.getDailyFeedbackReport(selectedDate)
      setDailyReport(data)
    } catch (error) {
      console.error('Error loading daily report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'csv' | 'excel') => {
    // TODO: Implement export
    alert(`${format.toUpperCase()} export coming soon`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <p className="text-gray-400 mt-2">View and export system reports</p>
      </div>

      {/* Daily Feedback Report */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Daily Feedback Summary
          </CardTitle>
          <CardDescription className="text-gray-400">
            Summary of feedback submissions for a specific date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div>
              <Label className="text-gray-300">Select Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white mt-1"
              />
            </div>
            <div className="flex space-x-2 pt-8">
              <Button
                onClick={() => handleExport('csv')}
                variant="outline"
                className="border-gray-600 text-gray-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => handleExport('excel')}
                variant="outline"
                className="border-gray-600 text-gray-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : dailyReport ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700 p-4 rounded">
                <p className="text-sm text-gray-400">Total Feedback</p>
                <p className="text-2xl font-bold text-white">{dailyReport.total_feedback || 0}</p>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <p className="text-sm text-gray-400">Average Rating</p>
                <p className="text-2xl font-bold text-white">
                  {dailyReport.avg_rating?.toFixed(1) || '0.0'}
                </p>
              </div>
              <div className="bg-gray-700 p-4 rounded">
                <p className="text-sm text-gray-400">Accuracy</p>
                <p className="text-2xl font-bold text-white">
                  {dailyReport.accuracy_percent?.toFixed(1) || '0.0'}%
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">No data available</div>
          )}
        </CardContent>
      </Card>

      {/* Predefined Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Weekly Accuracy Report</CardTitle>
            <CardDescription className="text-gray-400">
              Model accuracy trends over the past week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              This report shows accuracy trends over the past 7 days, helping identify patterns and improvements.
            </p>
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleExport('excel')}
            >
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Monthly User Engagement</CardTitle>
            <CardDescription className="text-gray-400">
              User activity and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              Track user registrations, predictions, and feedback submissions over the past month.
            </p>
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleExport('excel')}
            >
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Model Performance Over Time</CardTitle>
            <CardDescription className="text-gray-400">
              Long-term model performance analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              Analyze model accuracy and performance trends over extended periods.
            </p>
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => handleExport('excel')}
            >
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Custom Report Builder</CardTitle>
            <CardDescription className="text-gray-400">
              Create custom reports with selected metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              Select date range, metrics, and export format to generate custom reports.
            </p>
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700"
              onClick={() => alert('Custom report builder coming soon')}
            >
              Open Builder
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
