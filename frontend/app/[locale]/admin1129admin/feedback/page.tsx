"use client"
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
// Select component not needed - using native select
import { apiClient } from '@/lib/api'
import { Search, Download, Eye } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function FeedbackManagementPage() {
  const [feedback, setFeedback] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    rating: '',
    accuracy: '',
    make: '',
    search: '',
    date_from: '',
    date_to: '',
  })
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    loadFeedback()
  }, [page, filters])

  const loadFeedback = async () => {
    setLoading(true)
    try {
      const params: { page?: number; page_size?: number; rating?: number; accuracy?: string; make?: string; search?: string; date_from?: string; date_to?: string } = {
        page,
        page_size: pageSize,
      }
      if (filters.rating !== '') {
        const r = Number(filters.rating)
        if (!isNaN(r)) params.rating = r
      }
      if (filters.accuracy) params.accuracy = filters.accuracy
      if (filters.make) params.make = filters.make
      if (filters.search) params.search = filters.search
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      const data = await apiClient.getFeedbackList(params)
      setFeedback(data.items || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error loading feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (feedbackId: number) => {
    try {
      const detail = await apiClient.getFeedbackDetail(feedbackId)
      setSelectedFeedback(detail)
      setDetailOpen(true)
    } catch (error) {
      console.error('Error loading feedback detail:', error)
    }
  }

  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality coming soon')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Feedback Management</h1>
        <p className="text-gray-400 mt-2">Manage and review user feedback</p>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Input
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <select
              value={filters.rating}
              onChange={(e) => setFilters({ ...filters, rating: e.target.value })}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="">All Ratings</option>
              <option value="1">1 Star</option>
              <option value="2">2 Stars</option>
              <option value="3">3 Stars</option>
              <option value="4">4 Stars</option>
              <option value="5">5 Stars</option>
            </select>
            <select
              value={filters.accuracy}
              onChange={(e) => setFilters({ ...filters, accuracy: e.target.value })}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="">All Accuracy</option>
              <option value="accurate">Accurate</option>
              <option value="inaccurate">Inaccurate</option>
              <option value="no_feedback">No Feedback</option>
            </select>
            <Input
              type="date"
              placeholder="Date From"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Input
              type="date"
              placeholder="Date To"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Feedback ({total} total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-300">Date</TableHead>
                      <TableHead className="text-gray-300">User</TableHead>
                      <TableHead className="text-gray-300">Car</TableHead>
                      <TableHead className="text-gray-300">Rating</TableHead>
                      <TableHead className="text-gray-300">Accuracy</TableHead>
                      <TableHead className="text-gray-300">Confidence</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.map((item) => (
                      <TableRow key={item.id} className="border-gray-700">
                        <TableCell className="text-gray-300">
                          {new Date(item.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-gray-300">{item.user}</TableCell>
                        <TableCell className="text-gray-300">
                          {item.car?.make} {item.car?.model} ({item.car?.year})
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.is_accurate !== null ? (
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                item.is_accurate
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {item.is_accurate ? 'Accurate' : 'Inaccurate'}
                            </span>
                          ) : (
                            <span className="text-gray-500">No feedback</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300 capitalize">
                          {item.confidence_level || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(item.id)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-400">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="border-gray-600 text-gray-300"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page * pageSize >= total}
                    className="border-gray-600 text-gray-300"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Feedback Details</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4 text-white">
              <div>
                <h3 className="font-semibold mb-2">Prediction</h3>
                <div className="bg-gray-700 p-4 rounded">
                  <p>
                    <strong>Car:</strong> {selectedFeedback.prediction?.car_features?.make}{' '}
                    {selectedFeedback.prediction?.car_features?.model} (
                    {selectedFeedback.prediction?.car_features?.year})
                  </p>
                  <p>
                    <strong>Predicted Price:</strong> $
                    {selectedFeedback.prediction?.predicted_price?.toLocaleString()}
                  </p>
                  <p>
                    <strong>Confidence:</strong> {selectedFeedback.prediction?.confidence_level}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Feedback</h3>
                <div className="bg-gray-700 p-4 rounded space-y-2">
                  <p>
                    <strong>Rating:</strong>{' '}
                    {selectedFeedback.rating
                      ? '★'.repeat(selectedFeedback.rating) + '☆'.repeat(5 - selectedFeedback.rating)
                      : 'No rating'}
                  </p>
                  <p>
                    <strong>Accuracy:</strong>{' '}
                    {selectedFeedback.is_accurate !== null
                      ? selectedFeedback.is_accurate
                        ? 'Accurate'
                        : 'Inaccurate'
                      : 'No feedback'}
                  </p>
                  {selectedFeedback.correct_price && (
                    <p>
                      <strong>Correct Price:</strong> ${selectedFeedback.correct_price.toLocaleString()}
                    </p>
                  )}
                  {selectedFeedback.feedback_reasons?.length > 0 && (
                    <div>
                      <strong>Reasons:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {selectedFeedback.feedback_reasons.map((reason: string, i: number) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedFeedback.other_details && (
                    <p>
                      <strong>Details:</strong> {selectedFeedback.other_details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
